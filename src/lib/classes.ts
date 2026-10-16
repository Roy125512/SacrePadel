import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { mpPreference } from "@/lib/mercadopago";
import { fetchActiveCourts, fetchBlockingBookings, overlapsIso, toIsoAt } from "@/lib/availability";
import { cleanupExpiredWebHolds } from "@/lib/holdCleanup";
import { profileCustomerFields, resolveWebCustomer } from "@/lib/customers";
import { normalizePhoneToE164 } from "@/lib/phone";
import { sendBookingConfirmationEmails } from "@/lib/bookingNotifications";
import { MP_CHECKOUT_MINUTES } from "@/lib/mpBookings";
import { debtMessage, findOutstandingDebt } from "@/lib/splitPayments";
import { weekdayOfYMD } from "@/lib/businessTime";
import { BUSINESS_TZ_OFFSET, CLOSE_HOUR, OPEN_HOUR } from "@/lib/config";
import { DEMO } from "@/lib/demo/flag";

/**
 * Clases con entrenador. El jugador elige entrenador, día y hora; se busca
 * una cancha libre y se aparta como reserva (kind = 'CLASS', coach_id,
 * list_price = precio de la clase). Se paga en línea (Mercado Pago, con el
 * mismo flujo y webhook que las reservas) o en recepción.
 */

export type CoachWindow = { dow: number; start: string; end: string };
export type Coach = {
  id: string;
  name: string;
  bio: string | null;
  rate_individual: number;
  rate_pair: number | null;
  weekly_hours: CoachWindow[];
  active: boolean;
};
export type ClassType = "INDIVIDUAL" | "PAIR";
export const CLASS_DURATIONS = [60, 90] as const;
const STEP = 30;
const MIN_NOTICE_MIN = 60; // no se reserva una clase que empieza en menos de 1 h
const MAX_UNPAID_CLASSES = 2;

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

export function classPrice(coach: Pick<Coach, "rate_individual" | "rate_pair">, type: ClassType, minutes: number): number | null {
  const rate = type === "PAIR" ? coach.rate_pair : coach.rate_individual;
  if (!rate) return null;
  return Math.round((Number(rate) * minutes) / 60);
}

/**
 * Horas de inicio posibles para una clase de `minutes`: dentro del horario
 * del entrenador ese día, con el entrenador libre y al menos una cancha libre.
 */
export function coachStartTimes(args: {
  windows: CoachWindow[];
  ymd: string;
  minutes: number;
  nowMs: number;
  coachBusy: { start_at: string; end_at: string }[];
  courtBusy: { court_id: string; start_at: string; end_at: string }[];
  courtIds: string[];
}): string[] {
  const dow = weekdayOfYMD(args.ymd);
  const out = new Set<string>();
  for (const w of args.windows.filter((x) => x.dow === dow)) {
    const from = Math.max(toMin(w.start), OPEN_HOUR * 60);
    const to = Math.min(toMin(w.end), CLOSE_HOUR * 60);
    for (let t = from; t + args.minutes <= to; t += STEP) {
      const start = toIsoAt(args.ymd, t, BUSINESS_TZ_OFFSET);
      const end = toIsoAt(args.ymd, t + args.minutes, BUSINESS_TZ_OFFSET);
      if (new Date(start).getTime() < args.nowMs + MIN_NOTICE_MIN * 60_000) continue;
      if (args.coachBusy.some((b) => overlapsIso(start, end, b.start_at, b.end_at))) continue;
      const freeCourt = args.courtIds.some(
        (c) => !args.courtBusy.some((b) => b.court_id === c && overlapsIso(start, end, b.start_at, b.end_at))
      );
      if (freeCourt) out.add(start);
    }
  }
  return [...out].sort();
}

function parseCoach(row: Record<string, unknown>): Coach {
  return {
    id: row.id as string,
    name: row.name as string,
    bio: (row.bio as string | null) ?? null,
    rate_individual: Number(row.rate_individual),
    rate_pair: row.rate_pair == null ? null : Number(row.rate_pair),
    weekly_hours: Array.isArray(row.weekly_hours) ? (row.weekly_hours as CoachWindow[]) : [],
    active: row.active !== false,
  };
}

export async function listCoaches(includeInactive = false): Promise<Coach[]> {
  let q = supabaseAdmin
    .from("coaches")
    .select("id, name, bio, rate_individual, rate_pair, weekly_hours, active")
    .order("name", { ascending: true });
  if (!includeInactive) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => parseCoach(r as Record<string, unknown>));
}

export async function getCoach(id: string): Promise<Coach | null> {
  const { data } = await supabaseAdmin
    .from("coaches")
    .select("id, name, bio, rate_individual, rate_pair, weekly_hours, active")
    .eq("id", id)
    .maybeSingle();
  return data ? parseCoach(data as Record<string, unknown>) : null;
}

async function busyFor(coachId: string, ymd: string) {
  const dayStart = `${ymd}T00:00:00${BUSINESS_TZ_OFFSET}`;
  const dayEnd = `${ymd}T23:59:59${BUSINESS_TZ_OFFSET}`;
  const [courts, blockers] = await Promise.all([
    fetchActiveCourts(supabaseAdmin),
    fetchBlockingBookings(supabaseAdmin, { rangeStartIso: dayStart, rangeEndIso: dayEnd }),
  ]);
  const { data: coachRows } = await supabaseAdmin
    .from("bookings")
    .select("start_at, end_at, status, hold_expires_at")
    .eq("coach_id", coachId)
    .in("status", ["HOLD", "CONFIRMED", "COMPLETED"])
    .lt("start_at", dayEnd)
    .gt("end_at", dayStart);
  const now = Date.now();
  const coachBusy = (coachRows ?? []).filter(
    (b) => b.status !== "HOLD" || !b.hold_expires_at || new Date(b.hold_expires_at).getTime() > now
  );
  return { courts, blockers, coachBusy };
}

export async function availableClassTimes(coach: Coach, ymd: string, minutes: number) {
  const { courts, blockers, coachBusy } = await busyFor(coach.id, ymd);
  return coachStartTimes({
    windows: coach.weekly_hours,
    ymd,
    minutes,
    nowMs: Date.now(),
    coachBusy,
    courtBusy: blockers,
    courtIds: courts.map((c) => c.id),
  });
}

export type BookClassResult =
  | { ok: true; init_point?: string; confirmed?: boolean }
  | { ok: false; message: string; debt_url?: string | null };

export async function bookClass(args: {
  coachId: string;
  startAt: string;
  minutes: number;
  type: ClassType;
  pay: "ONLINE" | "CLUB";
  user: { id: string; email: string | null };
  origin: string;
}): Promise<BookClassResult> {
  const coach = await getCoach(args.coachId);
  if (!coach || !coach.active) return { ok: false, message: "Este entrenador no está disponible." };
  const price = classPrice(coach, args.type, args.minutes);
  if (!price) return { ok: false, message: "Este entrenador no da clases en pareja." };

  const ymd = args.startAt.slice(0, 10);
  const startIso = new Date(args.startAt).toISOString();
  const times = await availableClassTimes(coach, ymd, args.minutes);
  if (!times.some((t) => new Date(t).toISOString() === startIso)) {
    return { ok: false, message: "Ese horario ya no está disponible. Elige otro." };
  }

  // Cliente (con teléfono, como en las reservas).
  const profile = await profileCustomerFields(args.user.id);
  const phone = profile.phone_e164 ? normalizePhoneToE164(profile.phone_e164) : null;
  if (!phone || !profile.full_name) {
    return { ok: false, message: "Completa tu nombre y teléfono en tu perfil para reservar clases." };
  }
  const customer = await resolveWebCustomer(
    { ...profile, full_name: profile.full_name, phone_e164: phone, email: args.user.email },
    args.user.id
  );
  if ("error" in customer) return { ok: false, message: "No se pudo guardar tu reserva. Intenta de nuevo." };

  const debt = await findOutstandingDebt(customer.id);
  if (debt) return { ok: false, message: debtMessage(debt), debt_url: null };

  if (args.pay === "CLUB") {
    const { count } = await supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customer.id)
      .eq("kind", "CLASS")
      .eq("status", "CONFIRMED")
      .eq("payment_status", "UNPAID")
      .gt("start_at", new Date().toISOString());
    if ((count ?? 0) >= MAX_UNPAID_CLASSES) {
      return { ok: false, message: `Ya tienes ${count} clases por pagar en recepción. Para apartar otra, paga en línea.` };
    }
  }

  // Buscar una cancha libre y apartarla (la regla de no encimar reservas de
  // la base de datos evita que dos personas se queden la misma).
  const endIso = new Date(new Date(args.startAt).getTime() + args.minutes * 60_000).toISOString();
  const courts = await fetchActiveCourts(supabaseAdmin);
  const holdUntil = new Date(Date.now() + MP_CHECKOUT_MINUTES * 60_000).toISOString();
  let bookingId: string | null = null;
  for (const c of courts) {
    await cleanupExpiredWebHolds({ courtId: c.id, startIso, endIso }).catch(() => null);
    const { data, error } = await supabaseAdmin
      .from("bookings")
      .insert({
        court_id: c.id,
        start_at: startIso,
        end_at: endIso,
        status: args.pay === "CLUB" ? "CONFIRMED" : "HOLD",
        source: "WEB",
        kind: "CLASS",
        coach_id: coach.id,
        class_type: args.type,
        list_price: price,
        payment_status: "UNPAID",
        customer_id: customer.id,
        user_id: args.user.id,
        contact_email: args.user.email,
        hold_expires_at: args.pay === "CLUB" ? null : holdUntil,
      })
      .select("id")
      .single();
    if (!error && data) {
      bookingId = data.id;
      break;
    }
  }
  if (!bookingId) return { ok: false, message: "Se acaban de ocupar las canchas a esa hora. Elige otro horario." };

  if (args.pay === "CLUB") {
    await sendBookingConfirmationEmails(bookingId, { displayName: profile.full_name ?? undefined });
    return { ok: true, confirmed: true };
  }

  if (DEMO) {
    await supabaseAdmin.from("bookings").delete().eq("id", bookingId).eq("status", "HOLD");
    return { ok: false, message: "El pago en línea no está disponible en modo demo. Elige pagar en recepción." };
  }

  const back = `${args.origin}/clases/${coach.id}`;
  try {
    const pref = await mpPreference.create({
      body: {
        items: [
          {
            id: bookingId,
            title: `Clase con ${coach.name} (${args.minutes} min) — Sacré Pádel`,
            quantity: 1,
            currency_id: "MXN",
            unit_price: price,
          },
        ],
        external_reference: bookingId,
        ...(args.user.email ? { payer: { email: args.user.email } } : {}),
        back_urls: { success: back, pending: back, failure: back },
        notification_url: `${args.origin}/api/mercadopago/webhook`,
        expires: true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: holdUntil,
        payment_methods: { excluded_payment_types: [{ id: "ticket" }] },
        ...(args.origin.startsWith("https://") ? { auto_return: "approved" } : {}),
      },
    });
    const init_point = pref.init_point ?? pref.sandbox_init_point;
    if (!init_point || !pref.id) throw new Error("sin init_point");
    await supabaseAdmin.from("bookings").update({ mp_preference_id: pref.id }).eq("id", bookingId);
    return { ok: true, init_point };
  } catch (e) {
    console.error("bookClass preference", bookingId, e);
    await supabaseAdmin.from("bookings").delete().eq("id", bookingId).eq("status", "HOLD");
    return { ok: false, message: "Mercado Pago no respondió. Intenta de nuevo." };
  }
}

// ───────────────────────── Club ─────────────────────────

export type CoachInput = Omit<Coach, "id">;

export function validWindows(ws: CoachWindow[]) {
  return ws.every((w) => w.dow >= 0 && w.dow <= 6 && /^\d{2}:\d{2}$/.test(w.start) && /^\d{2}:\d{2}$/.test(w.end) && toMin(w.end) > toMin(w.start));
}

export async function saveCoach(id: string | null, c: CoachInput) {
  if (!validWindows(c.weekly_hours)) return { ok: false as const, message: "Revisa los horarios: el fin debe ser después del inicio." };
  const row = {
    name: c.name,
    bio: c.bio,
    rate_individual: c.rate_individual,
    rate_pair: c.rate_pair,
    weekly_hours: c.weekly_hours,
    active: c.active,
  };
  const { error } = id
    ? await supabaseAdmin.from("coaches").update(row).eq("id", id)
    : await supabaseAdmin.from("coaches").insert(row);
  if (error) {
    console.error("saveCoach", error);
    return { ok: false as const, message: "No se pudo guardar." };
  }
  return { ok: true as const };
}
