import { mpPayment } from "@/lib/mercadopago";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { computeExpectedAmountMXN, paddleRentalTotal } from "@/lib/pricing-shared";
import { alertOwner, sendBookingConfirmationEmails, type EmailResult } from "@/lib/bookingNotifications";
import { getShares, markOwnerSharePaid } from "@/lib/splitPayments";

// Minutos que un HOLD con pago en línea iniciado se mantiene apartado. La
// preferencia de Mercado Pago se crea con la MISMA fecha de expiración (ver
// create-mp-preference), así que no se puede pagar un HOLD que ya venció —
// sin eso, un cliente podía pagar después de que el horario se liberó.
export const MP_CHECKOUT_MINUTES = 20;

type MpPayment = Awaited<ReturnType<typeof mpPayment.get>>;

export type FinalizeResult =
  | { ok: true; emails: EmailResult }
  | { ok: false; reason: "not_approved" | "wrong_booking" | "not_found" | "cancelled" | "db_error" };

/**
 * Marca una reserva como CONFIRMED/PAID a partir de un pago aprobado de
 * Mercado Pago y manda los correos (una sola vez). Idempotente: la pueden
 * llamar el webhook, el regreso del navegador y la limpieza de HOLDs en
 * cualquier orden.
 *
 * Se registra como pagado lo que Mercado Pago dice que se cobró
 * (transaction_amount), nunca el precio calculado: si no coinciden, se avisa
 * al dueño en vez de inflar los ingresos.
 */
export async function finalizeMpBooking(
  bookingId: string,
  payment: MpPayment,
  opts?: { displayName?: string }
): Promise<FinalizeResult> {
  if (payment.status !== "approved") return { ok: false, reason: "not_approved" };
  if (payment.external_reference !== bookingId) return { ok: false, reason: "wrong_booking" };

  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .select("id, status, payment_status, start_at, end_at, split_parts, paddle_rentals")
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    console.error("finalizeMpBooking fetch", bookingId, error);
    return { ok: false, reason: "db_error" };
  }

  if (!booking) {
    await alertOwner("Pago aprobado sin reserva — revisar y reembolsar", [
      `Mercado Pago aprobó el pago ${payment.id} por $${payment.transaction_amount ?? "?"} MXN,`,
      `pero la reserva ${bookingId} ya no existe en el sistema.`,
      "Revisa el pago en el panel de Mercado Pago y contacta al cliente o reembólsalo.",
    ]);
    return { ok: false, reason: "not_found" };
  }

  if (booking.status === "CANCELLED") {
    // Mercado Pago reintenta notificaciones por días: no resucitar una
    // reserva que recepción ya canceló.
    // Solo si nunca se registró el pago: una reserva ya reembolsada
    // (REFUNDED) no necesita alerta.
    if (booking.payment_status === "UNPAID") {
      await alertOwner("Pago aprobado de una reserva cancelada", [
        `La reserva ${bookingId} está cancelada, pero Mercado Pago aprobó el pago ${payment.id}`,
        `por $${payment.transaction_amount ?? "?"} MXN. Revisa si hay que reembolsar.`,
      ]);
    }
    return { ok: false, reason: "cancelled" };
  }

  if (booking.payment_status === "UNPAID") {
    const paidAmount = Number(payment.transaction_amount ?? 0);
    // Pago dividido: este pago es solo la parte de quien reservó.
    const split = (booking.split_parts ?? 0) > 1;
    const ownerShare = split ? (await getShares(bookingId)).find((s) => s.seq === 1) : undefined;
    // Con pago completo, las palas rentadas van en el mismo cobro.
    const expected = ownerShare
      ? ownerShare.amount
      : computeExpectedAmountMXN(booking.start_at, booking.end_at) + paddleRentalTotal(booking.paddle_rentals);

    const { data: updated, error: upErr } = await supabaseAdmin
      .from("bookings")
      .update({
        status: "CONFIRMED",
        payment_status: split ? "PARTIAL" : "PAID",
        payment_method: "MERCADOPAGO",
        paid_amount: paidAmount,
        paid_at: payment.date_approved ?? new Date().toISOString(),
        mp_payment_id: String(payment.id),
        hold_expires_at: null,
      })
      .eq("id", bookingId)
      .neq("status", "CANCELLED")
      .eq("payment_status", "UNPAID")
      .select("id")
      .maybeSingle();

    if (upErr) {
      console.error("finalizeMpBooking update", bookingId, upErr);
      return { ok: false, reason: "db_error" };
    }

    if (updated && split) await markOwnerSharePaid(bookingId, payment, opts?.displayName ?? null);

    // Solo quien hizo la transición avisa (webhook y navegador pueden correr
    // a la vez).
    if (updated && Math.abs(paidAmount - expected) > 0.5) {
      await alertOwner("Monto pagado distinto al precio de la reserva", [
        `Reserva ${bookingId}: se cobraron $${paidAmount} MXN por Mercado Pago (pago ${payment.id}),`,
        `pero el precio de ese horario es $${expected} MXN.`,
        "La reserva quedó confirmada. Cobra la diferencia en recepción si corresponde.",
      ]);
    }
  }

  const emails = await sendBookingConfirmationEmails(bookingId, opts);
  return { ok: true, emails };
}

/** Busca un pago aprobado de Mercado Pago para esta reserva (external_reference). */
export async function findApprovedPayment(bookingId: string): Promise<MpPayment | null> {
  const search = await mpPayment.search({ options: { external_reference: bookingId } });
  const approved = (search.results ?? []).find((p) => p.status === "approved");
  if (!approved?.id) return null;
  // El resultado de search no trae exactamente el mismo tipo que get();
  // se vuelve a pedir para trabajar siempre con el pago completo.
  return mpPayment.get({ id: approved.id });
}

/**
 * Para un HOLD web vencido (o que el cliente quiere soltar) que ya inició
 * pago en línea: si Mercado Pago tiene un pago aprobado, se confirma en vez
 * de borrarlo; si no, se borra. Nunca se borra una reserva pagada.
 * Lanza error si no se pudo consultar a Mercado Pago — en ese caso el
 * llamador NO debe borrar el HOLD.
 */
export async function settleMpHold(bookingId: string): Promise<"confirmed" | "deleted"> {
  const payment = await findApprovedPayment(bookingId);
  if (payment) {
    await finalizeMpBooking(bookingId, payment);
    return "confirmed";
  }

  await supabaseAdmin
    .from("bookings")
    .delete()
    .eq("id", bookingId)
    .eq("status", "HOLD")
    .eq("source", "WEB");
  return "deleted";
}
