import { PaymentRefund } from "mercadopago";
import { mpConfig, mpPreference } from "@/lib/mercadopago";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/mailer";
import { alertOwner, mxParts } from "@/lib/bookingNotifications";
import { joinBlock } from "@/lib/openMatches";
import { generateAmericana, type AmericanaRound } from "@/lib/americana";
import { CANCEL_NOTICE_HOURS, withinCancelWindow } from "@/lib/config";
import { SITE } from "@/lib/site";
import { DEMO } from "@/lib/demo/flag";

/**
 * Torneos y americanas. El club crea el evento desde recepción; se apartan
 * sus canchas con reservas kind = 'EVENT'. Los jugadores con cuenta se
 * inscriben en /torneos/<id> y pagan con Mercado Pago (external_reference
 * "event:<registration id>"); si es gratis, quedan inscritos directo.
 * Pueden cancelar hasta CANCEL_NOTICE_HOURS antes, con reembolso.
 */

export const EVENT_REF_PREFIX = "event:";
const CHECKOUT_MINUTES = 20;
const refunds = new PaymentRefund(mpConfig);

export type EventKind = "AMERICANA" | "TORNEO" | "SOCIAL";
export const EVENT_KIND_LABEL: Record<EventKind, string> = {
  AMERICANA: "Americana",
  TORNEO: "Torneo",
  SOCIAL: "Social",
};

export type EventRow = {
  id: string;
  title: string;
  kind: EventKind;
  description: string | null;
  starts_at: string;
  ends_at: string;
  court_ids: string[];
  entry: "INDIVIDUAL" | "PAIR";
  capacity: number;
  price: number;
  level_min: number | null;
  level_max: number | null;
  gender: string;
  status: "OPEN" | "CLOSED" | "CANCELLED" | "FINISHED";
  rounds: AmericanaRound[] | null;
};

const EVENT_COLS =
  "id, title, kind, description, starts_at, ends_at, court_ids, entry, capacity, price, level_min, level_max, gender, status, rounds";

export type Result<T = object> = ({ ok: true } & T) | { ok: false; message: string };

export function eventUrl(id: string) {
  return `${SITE.url}/torneos/${id}`;
}

export async function getEvent(id: string): Promise<EventRow | null> {
  const { data } = await supabaseAdmin.from("events").select(EVENT_COLS).eq("id", id).maybeSingle();
  return data ? ({ ...data, price: Number(data.price) } as unknown as EventRow) : null;
}

/** Inscripciones activas: confirmadas y las que están pagando ahora. */
export async function activeRegistrations(eventId: string) {
  const { data } = await supabaseAdmin
    .from("event_registrations")
    .select("id, user_id, player_name, partner_name, status, payment_status, checkout_until, amount, created_at")
    .eq("event_id", eventId)
    .neq("status", "CANCELLED")
    .order("created_at", { ascending: true });
  const now = Date.now();
  return (data ?? []).filter(
    (r) => r.status === "CONFIRMED" || (r.checkout_until && new Date(r.checkout_until).getTime() > now)
  );
}

// ───────────────────────── Club (recepción) ─────────────────────────

export type NewEvent = {
  title: string;
  kind: EventKind;
  description?: string | null;
  starts_at: string;
  ends_at: string;
  court_ids: string[];
  entry: "INDIVIDUAL" | "PAIR";
  capacity: number;
  price: number;
  level_min?: number | null;
  level_max?: number | null;
  gender?: "ANY" | "MALE" | "FEMALE";
};

/** Crea el evento y aparta sus canchas. Si alguna ya está ocupada, no crea nada. */
export async function createEvent(input: NewEvent, createdBy: string, createdByName: string | null): Promise<Result<{ id: string }>> {
  if (new Date(input.ends_at) <= new Date(input.starts_at)) return { ok: false, message: "La hora de fin debe ser después del inicio." };
  if (input.court_ids.length === 0) return { ok: false, message: "Elige al menos una cancha." };
  if (input.kind === "AMERICANA" && input.entry !== "INDIVIDUAL") return { ok: false, message: "La americana es individual." };

  const { data: ev, error } = await supabaseAdmin
    .from("events")
    .insert({
      title: input.title,
      kind: input.kind,
      description: input.description ?? null,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      court_ids: input.court_ids,
      entry: input.entry,
      capacity: input.capacity,
      price: input.price,
      level_min: input.level_min ?? null,
      level_max: input.level_max ?? null,
      gender: input.gender ?? "ANY",
      created_by: createdBy,
    })
    .select("id")
    .single();
  if (error || !ev) {
    console.error("createEvent", error);
    return { ok: false, message: "No se pudo crear el evento." };
  }

  // Apartar las canchas (como reservas de recepción, sin cobro).
  const { error: bErr } = await supabaseAdmin.from("bookings").insert(
    input.court_ids.map((court_id) => ({
      court_id,
      start_at: input.starts_at,
      end_at: input.ends_at,
      status: "CONFIRMED",
      source: "RECEPTION",
      kind: "EVENT",
      payment_status: "PAID",
      paid_amount: 0,
      event_id: ev.id,
      created_by_name: createdByName ? `${createdByName} · ${input.title}` : input.title,
    }))
  );
  if (bErr) {
    await supabaseAdmin.from("bookings").delete().eq("event_id", ev.id);
    await supabaseAdmin.from("events").delete().eq("id", ev.id);
    const overlap = /overlap|bookings_no_overlap|exclusion/i.test(bErr.message ?? "");
    return {
      ok: false,
      message: overlap ? "Alguna de esas canchas ya tiene reservas en ese horario." : "No se pudieron apartar las canchas.",
    };
  }
  return { ok: true, id: ev.id };
}

/** Cancela el evento: libera canchas y reembolsa a quienes pagaron. */
export async function cancelEvent(eventId: string): Promise<Result<{ refunded: number }>> {
  const ev = await getEvent(eventId);
  if (!ev) return { ok: false, message: "No encontramos el evento." };
  if (ev.status === "CANCELLED") return { ok: false, message: "El evento ya estaba cancelado." };
  await supabaseAdmin.from("events").update({ status: "CANCELLED" }).eq("id", eventId);
  await supabaseAdmin
    .from("bookings")
    .update({ status: "CANCELLED", cancelled_by: "RECEPTION", cancelled_at: new Date().toISOString() })
    .eq("event_id", eventId)
    .neq("status", "CANCELLED");

  const { data: regs } = await supabaseAdmin
    .from("event_registrations")
    .select("id")
    .eq("event_id", eventId)
    .neq("status", "CANCELLED");
  let refunded = 0;
  for (const r of regs ?? []) {
    const res = await cancelRegistrationById(r.id, "CLUB");
    if (res.ok && res.refundedMXN > 0) refunded++;
  }
  return { ok: true, refunded };
}

export async function setEventStatus(eventId: string, status: "OPEN" | "CLOSED" | "FINISHED"): Promise<Result> {
  const { data } = await supabaseAdmin
    .from("events")
    .update({ status })
    .eq("id", eventId)
    .neq("status", "CANCELLED")
    .select("id")
    .maybeSingle();
  return data ? { ok: true } : { ok: false, message: "No se pudo cambiar el estado." };
}

/** Americana: arma las rondas con los inscritos confirmados. */
export async function generateEventRounds(eventId: string, rounds: number): Promise<Result> {
  const ev = await getEvent(eventId);
  if (!ev || ev.kind !== "AMERICANA") return { ok: false, message: "Solo las americanas tienen rondas." };
  if (ev.rounds?.some((r) => r.matches.some((m) => m.scoreA != null))) {
    return { ok: false, message: "Ya hay marcadores capturados: no se pueden rehacer las rondas." };
  }
  const regs = (await activeRegistrations(eventId)).filter((r) => r.status === "CONFIRMED");
  if (regs.length < 4) return { ok: false, message: "Se necesitan al menos 4 jugadores confirmados." };
  const generated = generateAmericana(
    regs.map((r) => r.user_id),
    ev.court_ids.length,
    Math.max(1, Math.min(12, rounds))
  );
  await supabaseAdmin.from("events").update({ rounds: generated, status: "CLOSED" }).eq("id", eventId);
  return { ok: true };
}

/** Americana: marcador de un partido (puntos o juegos de cada pareja). */
export async function saveEventScore(
  eventId: string,
  round: number,
  court: number,
  scoreA: number | null,
  scoreB: number | null
): Promise<Result> {
  const ev = await getEvent(eventId);
  if (!ev?.rounds) return { ok: false, message: "Este evento no tiene rondas." };
  const rounds = ev.rounds.map((r) =>
    r.round !== round ? r : { ...r, matches: r.matches.map((m) => (m.court !== court ? m : { ...m, scoreA, scoreB })) }
  );
  await supabaseAdmin.from("events").update({ rounds }).eq("id", eventId);
  return { ok: true };
}

// ───────────────────────── Jugadores ─────────────────────────

export type RegisterResult = Result<{ init_point?: string; confirmed?: boolean }>;

export async function registerForEvent(
  eventId: string,
  user: { id: string; email: string | null },
  partnerName: string | null,
  origin: string
): Promise<RegisterResult> {
  const ev = await getEvent(eventId);
  if (!ev) return { ok: false, message: "No encontramos este evento." };
  if (ev.status !== "OPEN") return { ok: false, message: "Las inscripciones están cerradas." };
  if (new Date(ev.starts_at).getTime() <= Date.now()) return { ok: false, message: "Este evento ya empezó." };
  if (ev.entry === "PAIR" && !partnerName?.trim()) return { ok: false, message: "Escribe el nombre de tu pareja." };

  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("full_name, sex, division, level")
    .eq("id", user.id)
    .maybeSingle();
  const block = joinBlock(
    { match_gender: ev.gender, match_level_min: ev.level_min, match_level_max: ev.level_max },
    { sex: prof?.sex ?? null, division: prof?.division ?? null, level: prof?.level ?? null }
  );
  if (block) return { ok: false, message: block.replace("partido", "evento") };

  const regs = await activeRegistrations(eventId);
  const mine = regs.find((r) => r.user_id === user.id);
  if (mine?.status === "CONFIRMED") return { ok: false, message: "Ya estás inscrito." };
  if (!mine && regs.length >= ev.capacity) return { ok: false, message: "Ya se llenó el cupo." };

  const playerName = (prof?.full_name ?? "").trim() || user.email?.split("@")[0] || "Jugador";
  const free = ev.price <= 0;
  const until = new Date(Date.now() + CHECKOUT_MINUTES * 60_000).toISOString();
  let regId = mine?.id ?? null;
  if (!regId) {
    // Una inscripción vieja cancelada o vencida no estorba: se crea otra.
    await supabaseAdmin
      .from("event_registrations")
      .update({ status: "CANCELLED", cancelled_at: new Date().toISOString() })
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .eq("status", "PENDING");
    const { data, error } = await supabaseAdmin
      .from("event_registrations")
      .insert({
        event_id: eventId,
        user_id: user.id,
        player_name: playerName,
        partner_name: ev.entry === "PAIR" ? partnerName!.trim().slice(0, 120) : null,
        contact_email: user.email,
        status: free ? "CONFIRMED" : "PENDING",
        amount: ev.price,
        checkout_until: free ? null : until,
      })
      .select("id")
      .single();
    if (error || !data) return { ok: false, message: "No se pudo inscribirte. Intenta de nuevo." };
    regId = data.id;
    // Dos personas a la vez por el último lugar: la que sobra se retira.
    const after = await activeRegistrations(eventId);
    if (after.length > ev.capacity && after.findIndex((r) => r.id === regId) >= ev.capacity) {
      await supabaseAdmin.from("event_registrations").update({ status: "CANCELLED" }).eq("id", regId);
      return { ok: false, message: "Ya se llenó el cupo." };
    }
  } else {
    await supabaseAdmin.from("event_registrations").update({ checkout_until: until }).eq("id", regId);
  }

  if (free) {
    await sendRegistrationEmail(ev, user.email, playerName);
    return { ok: true, confirmed: true };
  }
  if (DEMO) return { ok: false, message: "El pago en línea no está disponible en modo demo." };

  const back = `${origin}/torneos/${eventId}`;
  try {
    const pref = await mpPreference.create({
      body: {
        items: [
          {
            id: eventId,
            title: `Inscripción: ${ev.title} — Sacré Pádel`,
            quantity: 1,
            currency_id: "MXN",
            unit_price: ev.price,
          },
        ],
        external_reference: `${EVENT_REF_PREFIX}${regId}`,
        ...(user.email ? { payer: { email: user.email } } : {}),
        back_urls: { success: back, pending: back, failure: back },
        notification_url: `${origin}/api/mercadopago/webhook`,
        expires: true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: until,
        payment_methods: { excluded_payment_types: [{ id: "ticket" }] },
        ...(origin.startsWith("https://") ? { auto_return: "approved" } : {}),
      },
    });
    const init_point = pref.init_point ?? pref.sandbox_init_point;
    if (!init_point) throw new Error("sin init_point");
    return { ok: true, init_point };
  } catch (e) {
    console.error("registerForEvent preference", eventId, e);
    await supabaseAdmin.from("event_registrations").update({ checkout_until: null }).eq("id", regId).eq("status", "PENDING");
    return { ok: false, message: "Mercado Pago no respondió. Intenta de nuevo." };
  }
}

type MpPayment = Awaited<ReturnType<typeof import("@/lib/mercadopago").mpPayment.get>>;

/** Pago aprobado de una inscripción (webhook o regreso del navegador). Idempotente. */
export async function finalizeEventPayment(payment: MpPayment): Promise<Result> {
  if (payment.status !== "approved") return { ok: false, message: "not_approved" };
  const regId = (payment.external_reference ?? "").slice(EVENT_REF_PREFIX.length);
  const { data: reg } = await supabaseAdmin
    .from("event_registrations")
    .select("id, event_id, status, payment_status, contact_email, player_name, mp_payment_id")
    .eq("id", regId)
    .maybeSingle();
  if (!reg) {
    await alertOwner("Pago de inscripción sin registro — revisar y reembolsar", [
      `Mercado Pago aprobó el pago ${payment.id} ($${payment.transaction_amount ?? "?"} MXN) de la inscripción ${regId}, que no existe.`,
    ]);
    return { ok: false, message: "not_found" };
  }
  if (reg.payment_status === "PAID") return { ok: true };

  const ev = await getEvent(reg.event_id);
  const paidFields = {
    payment_status: "PAID",
    mp_payment_id: String(payment.id),
    paid_at: payment.date_approved ?? new Date().toISOString(),
    checkout_until: null,
  };
  // Evento cancelado, inscripción cancelada o cupo lleno: se devuelve.
  const regs = ev ? await activeRegistrations(ev.id) : [];
  const confirmedOthers = regs.filter((r) => r.status === "CONFIRMED" && r.id !== reg.id).length;
  if (!ev || ev.status === "CANCELLED" || reg.status === "CANCELLED" || confirmedOthers >= ev.capacity) {
    await supabaseAdmin
      .from("event_registrations")
      .update({ ...paidFields, status: "CANCELLED", cancelled_at: new Date().toISOString() })
      .eq("id", reg.id);
    await refundRegistration(reg.id, String(payment.id), Number(payment.transaction_amount ?? 0));
    return { ok: false, message: "full_or_cancelled" };
  }

  const { data: done } = await supabaseAdmin
    .from("event_registrations")
    .update({ ...paidFields, status: "CONFIRMED" })
    .eq("id", reg.id)
    .neq("payment_status", "PAID")
    .select("id")
    .maybeSingle();
  if (done) await sendRegistrationEmail(ev, reg.contact_email, reg.player_name);
  return { ok: true };
}

async function refundRegistration(regId: string, paymentId: string, amount: number) {
  if (!DEMO) {
    try {
      await refunds.total({ payment_id: paymentId, requestOptions: { idempotencyKey: `refund-event-${regId}` } });
    } catch (e) {
      console.error("refundRegistration", regId, e);
      await alertOwner("Reembolso de inscripción fallido — hacerlo a mano", [
        `Inscripción ${regId}: reembolsa $${amount} MXN del pago ${paymentId} desde Mercado Pago.`,
      ]);
      return false;
    }
  }
  await supabaseAdmin
    .from("event_registrations")
    .update({ payment_status: "REFUNDED", refunded_at: new Date().toISOString() })
    .eq("id", regId);
  return true;
}

/** El jugador cancela su inscripción (hasta 24 h antes), con reembolso. */
export async function cancelMyRegistration(eventId: string, userId: string) {
  const ev = await getEvent(eventId);
  if (!ev) return { ok: false as const, message: "No encontramos este evento." };
  if (!withinCancelWindow(ev.starts_at)) {
    return { ok: false as const, message: `Faltan menos de ${CANCEL_NOTICE_HOURS} h: escríbenos por WhatsApp.` };
  }
  const { data: reg } = await supabaseAdmin
    .from("event_registrations")
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .neq("status", "CANCELLED")
    .maybeSingle();
  if (!reg) return { ok: false as const, message: "No estás inscrito." };
  return cancelRegistrationById(reg.id, "PLAYER");
}

async function cancelRegistrationById(regId: string, by: "PLAYER" | "CLUB") {
  const { data: reg } = await supabaseAdmin
    .from("event_registrations")
    .select("id, event_id, status, payment_status, mp_payment_id, amount, contact_email, player_name")
    .eq("id", regId)
    .maybeSingle();
  if (!reg || reg.status === "CANCELLED") return { ok: false as const, message: "No estás inscrito." };
  const { data: claimed } = await supabaseAdmin
    .from("event_registrations")
    .update({ status: "CANCELLED", cancelled_at: new Date().toISOString(), checkout_until: null })
    .eq("id", regId)
    .neq("status", "CANCELLED")
    .select("id")
    .maybeSingle();
  if (!claimed) return { ok: false as const, message: "No estás inscrito." };
  let refundedMXN = 0;
  if (reg.payment_status === "PAID" && reg.mp_payment_id) {
    const ok = await refundRegistration(reg.id, reg.mp_payment_id, Number(reg.amount));
    if (ok) refundedMXN = Number(reg.amount);
  }
  if (by === "CLUB" && reg.contact_email) {
    const ev = await getEvent(reg.event_id);
    const text = `Hola ${reg.player_name ?? ""}, el club canceló ${ev?.title ?? "el evento"}.${
      refundedMXN ? ` Te devolvimos $${refundedMXN} MXN a tu método de pago.` : ""
    }`;
    await sendEmail({
      to: reg.contact_email,
      subject: `Se canceló ${ev?.title ?? "el evento"} - Sacré Pádel`,
      text,
      html: `<div style="font-family:sans-serif;font-size:14px;line-height:1.6"><p>${text}</p></div>`,
    }).catch(() => null);
  }
  return { ok: true as const, refundedMXN };
}

async function sendRegistrationEmail(ev: EventRow | null, to: string | null, name: string | null) {
  if (!ev || !to) return;
  const s = mxParts(ev.starts_at);
  const e = mxParts(ev.ends_at);
  await sendEmail({
    to,
    subject: `Estás inscrito: ${ev.title} - Sacré Pádel`,
    text: `Hola ${name ?? ""}, quedaste inscrito en ${ev.title} (${s.dateLocal}, ${s.timeLocal}–${e.timeLocal}). Detalles y rondas: ${eventUrl(ev.id)}. Puedes cancelar sin costo hasta ${CANCEL_NOTICE_HOURS} h antes.`,
    html: `<div style="font-family:sans-serif;font-size:14px;line-height:1.6"><p>Hola ${name ?? ""}, quedaste inscrito en <b>${ev.title}</b>.</p><p>${s.dateLocal}, ${s.timeLocal}–${e.timeLocal}</p><p><a href="${eventUrl(ev.id)}" style="color:#9A6A45;font-weight:700">Ver el evento</a> · Puedes cancelar sin costo hasta ${CANCEL_NOTICE_HOURS} h antes.</p></div>`,
  }).catch(() => null);
}

/** Eventos para la página pública: próximos y terminados recientes. */
export async function listPublicEvents() {
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data } = await supabaseAdmin
    .from("events")
    .select(EVENT_COLS)
    .neq("status", "CANCELLED")
    .gte("ends_at", since)
    .order("starts_at", { ascending: true })
    .limit(50);
  const events = (data ?? []).map((e) => ({ ...e, price: Number(e.price) }) as unknown as EventRow);
  const counts = new Map<string, number>();
  for (const ev of events) counts.set(ev.id, (await activeRegistrations(ev.id)).length);
  return events.map((ev) => ({ ...ev, taken: counts.get(ev.id) ?? 0 }));
}
