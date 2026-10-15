import { PaymentRefund } from "mercadopago";
import { mpConfig, mpPayment } from "@/lib/mercadopago";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/mailer";
import { buildSharePaidEmail } from "@/lib/bookingEmail";
import { alertOwner, mxParts } from "@/lib/bookingNotifications";
import { computeExpectedAmountMXN } from "@/lib/pricing-shared";
import { SPLIT_DEBT_GRACE_HOURS, formatMXN, splitAmounts } from "@/lib/config";
import { SITE } from "@/lib/site";
import { DEMO } from "@/lib/demo/flag";

/**
 * Pago dividido (como el "sistema de deuda" de Playtomic en México):
 *
 * - Quien reserva elige dividir entre 2, 3 o 4 y paga en línea solo su parte
 *   (la 1). Con eso la cancha queda confirmada.
 * - Comparte la liga /reserva/pagar?t=<split_token>; cada compañero paga una
 *   (o varias) partes con Mercado Pago, sin cuenta.
 * - Lo que falte se puede cobrar en recepción. Si a las
 *   SPLIT_DEBT_GRACE_HOURS de terminado el partido sigue faltando, queda como
 *   deuda de quien reservó y no puede volver a reservar hasta cubrirla.
 * - Si se cancela a tiempo, se reembolsa a cada quien lo que pagó.
 *
 * Cada pago de partes lleva external_reference "shares:<booking>:<id>,<id>".
 */

export const SHARES_REF_PREFIX = "shares:";
const CHECKOUT_MINUTES = 20;
const refunds = new PaymentRefund(mpConfig);

type MpPayment = Awaited<ReturnType<typeof mpPayment.get>>;

export type Share = {
  id: string;
  seq: number;
  amount: number;
  status: string;
  payer_name: string | null;
  payment_method: string | null;
  checkout_until: string | null;
  user_id: string | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function sharesRef(bookingId: string, shareIds: string[]) {
  return `${SHARES_REF_PREFIX}${bookingId}:${shareIds.join(",")}`;
}

export function parseSharesRef(ref: string | null | undefined): { bookingId: string; shareIds: string[] } | null {
  if (!ref?.startsWith(SHARES_REF_PREFIX)) return null;
  const [bookingId, ids] = ref.slice(SHARES_REF_PREFIX.length).split(":");
  const shareIds = (ids ?? "").split(",").filter(Boolean);
  if (!bookingId || shareIds.length === 0) return null;
  return { bookingId, shareIds };
}

export function splitUrl(token: string) {
  return `${SITE.url}/reserva/pagar?t=${token}`;
}

export async function getShares(bookingId: string): Promise<Share[]> {
  const { data, error } = await supabaseAdmin
    .from("booking_shares")
    .select("id, seq, amount, status, payer_name, payment_method, checkout_until, user_id")
    .eq("booking_id", bookingId)
    .order("seq", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((s) => ({ ...s, amount: Number(s.amount) }));
}

/**
 * Prepara (o quita) el pago dividido de un HOLD antes de mandar a quien
 * reserva a pagar su parte. Devuelve lo que se le cobra ahora.
 */
export async function prepareSplit(
  bookingId: string,
  total: number,
  parts: number | null,
  existingToken: string | null
): Promise<{ chargeNow: number; token: string | null }> {
  await supabaseAdmin.from("booking_shares").delete().eq("booking_id", bookingId);
  if (!parts || parts < 2) {
    await supabaseAdmin.from("bookings").update({ split_parts: null }).eq("id", bookingId);
    return { chargeNow: total, token: null };
  }
  const amounts = splitAmounts(total, parts);
  const { error } = await supabaseAdmin
    .from("booking_shares")
    .insert(amounts.map((amount, i) => ({ booking_id: bookingId, seq: i + 1, amount })));
  if (error) throw error;
  const token = existingToken ?? crypto.randomUUID();
  const { error: upErr } = await supabaseAdmin
    .from("bookings")
    .update({ split_parts: parts, split_token: token })
    .eq("id", bookingId);
  if (upErr) throw upErr;
  return { chargeNow: amounts[0], token };
}

/**
 * Recalcula lo pagado de la reserva a partir de sus partes. Idempotente:
 * se llama después de cada pago (también en reintentos del webhook) y
 * repara lo que una carrera haya dejado atrás.
 */
export async function syncBookingFromShares(bookingId: string) {
  const shares = await getShares(bookingId);
  if (shares.length === 0) return null;
  const paid = shares.filter((s) => s.status === "PAID");
  const paidSum = round2(paid.reduce((a, s) => a + s.amount, 0));
  const onlineSum = round2(paid.filter((s) => s.payment_method === "MERCADOPAGO").reduce((a, s) => a + s.amount, 0));
  const allPaid = paid.length === shares.length;
  const payment_status = allPaid ? "PAID" : paidSum > 0 ? "PARTIAL" : "UNPAID";
  await supabaseAdmin
    .from("bookings")
    .update({ paid_amount: paidSum, online_paid_amount: onlineSum, payment_status })
    .eq("id", bookingId)
    .in("payment_status", ["UNPAID", "PARTIAL", "PAID"])
    .neq("status", "CANCELLED");
  return { shares, paidSum, onlineSum, allPaid, pending: shares.length - paid.length };
}

export type ClaimResult =
  | { ok: true; shareIds: string[]; amount: number }
  | { ok: false; message: string };

/**
 * Aparta `count` partes pendientes para un checkout (20 min). Si otra
 * persona está pagando en ese momento, esas partes no se ofrecen.
 */
export async function claimSharesForCheckout(bookingId: string, count: number): Promise<ClaimResult> {
  const nowIso = new Date().toISOString();
  const free = `checkout_until.is.null,checkout_until.lt.${nowIso}`;
  const { data: candidates, error } = await supabaseAdmin
    .from("booking_shares")
    .select("id, amount")
    .eq("booking_id", bookingId)
    .eq("status", "PENDING")
    .or(free)
    .order("seq", { ascending: true })
    .limit(count);
  if (error) throw error;

  const { count: pendingTotal } = await supabaseAdmin
    .from("booking_shares")
    .select("id", { count: "exact", head: true })
    .eq("booking_id", bookingId)
    .eq("status", "PENDING");

  if (!candidates || candidates.length < count) {
    const available = candidates?.length ?? 0;
    if ((pendingTotal ?? 0) === 0) return { ok: false, message: "Ya se pagaron todas las partes. ¡Nos vemos en la cancha!" };
    if (available === 0)
      return { ok: false, message: "Alguien está pagando en este momento. Intenta de nuevo en unos minutos." };
    return {
      ok: false,
      message: `Solo ${available === 1 ? "queda 1 parte disponible" : `quedan ${available} partes disponibles`} para pagar ahora.`,
    };
  }

  const ids = candidates.map((c) => c.id);
  const until = new Date(Date.now() + CHECKOUT_MINUTES * 60_000).toISOString();
  // Condicional: si dos personas llegan a la vez, solo una se queda con cada parte.
  const { data: claimed, error: upErr } = await supabaseAdmin
    .from("booking_shares")
    .update({ checkout_until: until })
    .in("id", ids)
    .eq("status", "PENDING")
    .or(free)
    .select("id, amount");
  if (upErr) throw upErr;
  if ((claimed ?? []).length < ids.length) {
    await releaseShares((claimed ?? []).map((c) => c.id));
    return { ok: false, message: "Alguien está pagando en este momento. Intenta de nuevo en unos minutos." };
  }
  return { ok: true, shareIds: ids, amount: round2(candidates.reduce((a, c) => a + Number(c.amount), 0)) };
}

/** Libera partes apartadas cuyo checkout no se completó. */
export async function releaseShares(shareIds: string[]) {
  if (shareIds.length === 0) return;
  await supabaseAdmin.from("booking_shares").update({ checkout_until: null }).in("id", shareIds).eq("status", "PENDING");
}

/** Marca la parte 1 (la de quien reserva) como pagada con el pago de la reserva. */
export async function markOwnerSharePaid(bookingId: string, payment: MpPayment, payerName: string | null) {
  const { data: b } = await supabaseAdmin.from("bookings").select("user_id").eq("id", bookingId).maybeSingle();
  await supabaseAdmin
    .from("booking_shares")
    .update({
      status: "PAID",
      payment_method: "MERCADOPAGO",
      mp_payment_id: String(payment.id),
      paid_at: payment.date_approved ?? new Date().toISOString(),
      payer_name: payerName,
      user_id: b?.user_id ?? null,
    })
    .eq("booking_id", bookingId)
    .eq("seq", 1)
    .eq("status", "PENDING");
  return syncBookingFromShares(bookingId);
}

export type SharesFinalizeResult =
  | { ok: true; assigned: number; extraRefunded: number }
  | { ok: false; reason: "not_approved" | "bad_reference" | "not_found" | "cancelled" | "duplicate" | "db_error" };

/**
 * Registra un pago aprobado de partes. Idempotente (webhook + regreso del
 * navegador). Si mientras tanto alguien más pagó esas partes, se toman otras
 * pendientes; si ya no queda ninguna, se le devuelve el excedente.
 */
export async function finalizeSharesPayment(payment: MpPayment): Promise<SharesFinalizeResult> {
  if (payment.status !== "approved") return { ok: false, reason: "not_approved" };
  const ref = parseSharesRef(payment.external_reference);
  if (!ref) return { ok: false, reason: "bad_reference" };
  const paymentId = String(payment.id);
  const meta = (payment.metadata ?? {}) as { payer_name?: string; payer_email?: string; user_id?: string };
  const payerName = (meta.payer_name ?? "").trim().slice(0, 120) || null;
  const payerEmail = (meta.payer_email ?? "").trim().slice(0, 200) || null;
  // Partidos abiertos: quién ocupa el lugar.
  const userId = /^[0-9a-f-]{36}$/i.test(meta.user_id ?? "") ? meta.user_id! : null;

  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .select("id, status, start_at, end_at, contact_email, split_token, courts ( name ), customers:customer_id ( full_name )")
    .eq("id", ref.bookingId)
    .maybeSingle();
  if (error) {
    console.error("finalizeSharesPayment fetch", ref.bookingId, error);
    return { ok: false, reason: "db_error" };
  }
  if (!booking) {
    await alertOwner("Pago de una parte sin reserva — revisar y reembolsar", [
      `Mercado Pago aprobó el pago ${paymentId} por $${payment.transaction_amount ?? "?"} MXN,`,
      `pero la reserva ${ref.bookingId} ya no existe.`,
    ]);
    return { ok: false, reason: "not_found" };
  }

  // Ya registrado (reintento del webhook o regreso del navegador).
  const { data: already } = await supabaseAdmin.from("booking_shares").select("id").eq("mp_payment_id", paymentId);
  if ((already ?? []).length > 0) {
    await syncBookingFromShares(ref.bookingId);
    return { ok: true, assigned: already!.length, extraRefunded: 0 };
  }

  if (booking.status === "CANCELLED") {
    await refundWhole(paymentId, `La reserva ${ref.bookingId} ya estaba cancelada cuando entró el pago de una parte.`);
    return { ok: false, reason: "cancelled" };
  }

  // Ya está en el partido (pagó dos veces, p. ej. desde dos pestañas).
  if (userId) {
    const { data: dup } = await supabaseAdmin
      .from("booking_shares")
      .select("id")
      .eq("booking_id", ref.bookingId)
      .eq("user_id", userId)
      .eq("status", "PAID")
      .limit(1);
    if ((dup ?? []).length > 0) {
      await refundWhole(paymentId, `Un jugador pagó dos veces su lugar en el partido ${ref.bookingId}.`);
      return { ok: false, reason: "duplicate" };
    }
  }

  const paidFields = {
    status: "PAID",
    payment_method: "MERCADOPAGO",
    mp_payment_id: paymentId,
    paid_at: payment.date_approved ?? new Date().toISOString(),
    payer_name: payerName,
    payer_email: payerEmail,
    user_id: userId,
    checkout_until: null,
  };

  const { data: got, error: e1 } = await supabaseAdmin
    .from("booking_shares")
    .update(paidFields)
    .in("id", ref.shareIds)
    .eq("booking_id", ref.bookingId)
    .eq("status", "PENDING")
    .select("id, amount");
  if (e1) {
    console.error("finalizeSharesPayment claim", ref.bookingId, e1);
    return { ok: false, reason: "db_error" };
  }
  const assigned = [...(got ?? [])];

  // Alguien más pagó alguna de esas partes mientras tanto: tomar otras.
  let missing = ref.shareIds.length - assigned.length;
  if (missing > 0) {
    const { data: others } = await supabaseAdmin
      .from("booking_shares")
      .select("id")
      .eq("booking_id", ref.bookingId)
      .eq("status", "PENDING")
      .order("seq", { ascending: true })
      .limit(missing);
    if (others && others.length > 0) {
      const { data: got2 } = await supabaseAdmin
        .from("booking_shares")
        .update(paidFields)
        .in(
          "id",
          others.map((o) => o.id)
        )
        .eq("status", "PENDING")
        .select("id, amount");
      assigned.push(...(got2 ?? []));
    }
    missing = ref.shareIds.length - assigned.length;
  }

  const covered = round2(assigned.reduce((a, s) => a + Number(s.amount), 0));
  const charged = Number(payment.transaction_amount ?? 0);
  let extraRefunded = 0;
  if (charged - covered > 0.009) {
    extraRefunded = round2(charged - covered);
    if (covered === 0) {
      await refundWhole(paymentId, `Se pagaron partes de la reserva ${ref.bookingId} que ya estaban cubiertas.`);
    } else if (!DEMO) {
      try {
        await refunds.create({
          payment_id: paymentId,
          body: { amount: extraRefunded },
          requestOptions: { idempotencyKey: `refund-extra-${paymentId}` },
        });
      } catch (e) {
        console.error("finalizeSharesPayment partial refund", paymentId, e);
        await alertOwner("Devolver excedente de un pago dividido — hacerlo a mano", [
          `El pago ${paymentId} cubrió $${covered} MXN de la reserva ${ref.bookingId}, pero se cobraron $${charged}.`,
          `Devuelve $${extraRefunded} MXN desde el panel de Mercado Pago.`,
        ]);
      }
    }
  }

  const sync = await syncBookingFromShares(ref.bookingId);

  // Avisos: recibo a quien pagó y, si ya está todo, a quien reservó.
  const s = mxParts(booking.start_at);
  const court = (booking.courts as { name: string } | null)?.name ?? "Cancha";
  if (payerEmail && covered > 0) {
    const mail = buildSharePaidEmail({
      fullName: payerName ?? "Hola",
      courtName: court,
      dateLocal: s.dateLocal,
      startTimeLocal: s.timeLocal,
      endTimeLocal: mxParts(booking.end_at).timeLocal,
      paidMXN: covered,
      parts: assigned.length,
      allPaid: !!sync?.allPaid,
    });
    await sendEmail({ to: payerEmail, subject: mail.subject, html: mail.html, text: mail.text }).catch(() => null);
  }
  if (sync?.allPaid && booking.contact_email && booking.contact_email !== payerEmail) {
    const owner = (booking.customers as { full_name: string | null } | null)?.full_name?.trim() || "Hola";
    const mail = buildSharePaidEmail({
      fullName: owner,
      courtName: court,
      dateLocal: s.dateLocal,
      startTimeLocal: s.timeLocal,
      endTimeLocal: mxParts(booking.end_at).timeLocal,
      paidMXN: null,
      parts: 0,
      allPaid: true,
    });
    await sendEmail({ to: booking.contact_email, subject: mail.subject, html: mail.html, text: mail.text }).catch(() => null);
  }

  return { ok: true, assigned: assigned.length, extraRefunded };
}

async function refundWhole(paymentId: string, why: string) {
  if (DEMO) return;
  try {
    await refunds.total({ payment_id: paymentId, requestOptions: { idempotencyKey: `refund-share-${paymentId}` } });
  } catch (e) {
    console.error("refundWhole", paymentId, e);
    await alertOwner("Reembolso de una parte fallido — hacerlo a mano", [why, `Reembolsa el pago ${paymentId} desde Mercado Pago.`]);
  }
}

/**
 * Reembolsa todo lo pagado en línea de una reserva dividida (al cancelarla).
 * Un pago puede cubrir varias partes; se reembolsa cada pago una vez.
 */
export async function refundSplitBooking(bookingId: string): Promise<{
  refundedMXN: number;
  failed: boolean;
  payers: { email: string; name: string | null; amount: number }[];
  /** Lo reembolsado por cada pago de Mercado Pago. */
  byPayment: Record<string, number>;
}> {
  const { data } = await supabaseAdmin
    .from("booking_shares")
    .select("id, amount, status, payment_method, mp_payment_id, payer_email, payer_name")
    .eq("booking_id", bookingId);
  const shares = data ?? [];
  const online = shares.filter((s) => s.status === "PAID" && s.payment_method === "MERCADOPAGO" && s.mp_payment_id);
  const byPayment = new Map<string, typeof online>();
  for (const s of online) byPayment.set(s.mp_payment_id!, [...(byPayment.get(s.mp_payment_id!) ?? []), s]);

  let refundedMXN = 0;
  let failed = false;
  const refundedByPayment: Record<string, number> = {};
  const payers = new Map<string, { email: string; name: string | null; amount: number }>();
  for (const [paymentId, group] of byPayment) {
    const amount = round2(group.reduce((a, s) => a + Number(s.amount), 0));
    try {
      if (!DEMO) {
        await refunds.total({ payment_id: paymentId, requestOptions: { idempotencyKey: `refund-${paymentId}` } });
      }
      refundedMXN = round2(refundedMXN + amount);
      refundedByPayment[paymentId] = amount;
      await supabaseAdmin
        .from("booking_shares")
        .update({ status: "REFUNDED", refunded_at: new Date().toISOString() })
        .in(
          "id",
          group.map((s) => s.id)
        );
      const email = group[0].payer_email;
      if (email) {
        const prev = payers.get(email);
        payers.set(email, { email, name: group[0].payer_name, amount: round2((prev?.amount ?? 0) + amount) });
      }
    } catch (e) {
      failed = true;
      console.error("refundSplitBooking", bookingId, paymentId, e);
      await alertOwner("Reembolso automático fallido — hacerlo a mano", [
        `La reserva dividida ${bookingId} se canceló, pero Mercado Pago no aceptó el reembolso del pago ${paymentId} ($${amount} MXN).`,
        "Reembólsalo desde el panel de Mercado Pago.",
      ]);
    }
  }
  await supabaseAdmin
    .from("booking_shares")
    .update({ status: "CANCELLED", checkout_until: null })
    .eq("booking_id", bookingId)
    .eq("status", "PENDING");
  return { refundedMXN, failed, payers: [...payers.values()], byPayment: refundedByPayment };
}

export type Debt = { bookingId: string; token: string | null; remaining: number; startAt: string };

/**
 * Partes sin pagar de partidos de este cliente que ya terminaron hace más de
 * SPLIT_DEBT_GRACE_HOURS: quedan a su cargo y bloquean nuevas reservas.
 */
export async function findOutstandingDebt(customerId: string): Promise<Debt | null> {
  const cutoff = new Date(Date.now() - SPLIT_DEBT_GRACE_HOURS * 3600_000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("id, split_token, start_at, end_at, paid_amount")
    .eq("customer_id", customerId)
    .eq("payment_status", "PARTIAL")
    .in("status", ["CONFIRMED", "COMPLETED", "NO_SHOW"])
    .lt("end_at", cutoff)
    .order("start_at", { ascending: true })
    .limit(1);
  if (error) throw error;
  const b = data?.[0];
  if (!b) return null;
  return {
    bookingId: b.id,
    token: b.split_token,
    remaining: round2(computeExpectedAmountMXN(b.start_at, b.end_at) - Number(b.paid_amount ?? 0)),
    startAt: b.start_at,
  };
}

export function debtMessage(d: Debt) {
  return `Tienes ${formatMXN(d.remaining)} MXN pendientes de tu reserva del ${mxParts(d.startAt).dateLocal} (las partes que no se pagaron). Cúbrelas para volver a reservar, en línea o en recepción.`;
}
