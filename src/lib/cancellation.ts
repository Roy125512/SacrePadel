import { PaymentRefund } from "mercadopago";
import { mpConfig } from "@/lib/mercadopago";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/mailer";
import { buildCancellationEmail } from "@/lib/bookingEmail";
import { alertOwner, mxParts } from "@/lib/bookingNotifications";
import { withinCancelWindow } from "@/lib/config";
import { DEMO } from "@/lib/demo/flag";

/**
 * Cancelación de reservas con reembolso automático (como Playtomic):
 *
 * - El cliente cancela él mismo (desde su perfil o la liga del correo) hasta
 *   CANCEL_NOTICE_HOURS antes. Si pagó en línea, se le devuelve el pago
 *   completo por Mercado Pago en el momento.
 * - Recepción puede cancelar en cualquier momento (casos especiales: lluvia,
 *   mantenimiento); si el pago fue en línea, también se reembolsa.
 * - Lo pagado en recepción (efectivo/tarjeta/transferencia) no se reembolsa
 *   aquí: lo devuelve el club a mano.
 */

export type CancelBy = "CUSTOMER" | "RECEPTION";

export type CancelResult =
  | { ok: true; refund: "none" | "refunded" | "failed"; refundedMXN: number | null }
  | { ok: false; reason: CancelRejection; message: string };

export type CancelRejection = "not_found" | "not_cancellable" | "too_late" | "paid_at_club" | "conflict" | "db_error";

const refunds = new PaymentRefund(mpConfig);

function escHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

type BookingForCancel = {
  id: string;
  status: string;
  start_at: string;
  end_at: string;
  payment_status: string;
  payment_method: string | null;
  paid_amount: number | null;
  mp_payment_id: string | null;
  contact_email: string | null;
  courts: { name: string } | null;
  customers: { full_name: string | null } | null;
};

const SELECT =
  "id, status, start_at, end_at, payment_status, payment_method, paid_amount, mp_payment_id, contact_email, courts ( name ), customers:customer_id ( full_name )";

const MESSAGES: Record<CancelRejection, string> = {
  not_found: "No encontramos esa reserva.",
  not_cancellable: "Esta reserva ya no se puede cancelar.",
  too_late:
    "Faltan menos de 24 horas para tu reserva, así que ya no se puede cancelar en línea. Escríbenos por WhatsApp y lo revisamos.",
  paid_at_club: "Esta reserva se pagó en recepción. Para cancelarla, contacta al club.",
  conflict: "La reserva cambió mientras tanto. Actualiza e intenta de nuevo.",
  db_error: "No se pudo cancelar. Intenta de nuevo en un momento.",
};

function reject(reason: CancelRejection): CancelResult {
  return { ok: false, reason, message: MESSAGES[reason] };
}

/** Por qué (o si) el cliente puede cancelar en línea esta reserva ahora. */
export function customerCancelBlock(
  b: { status: string; start_at: string; payment_status: string; payment_method: string | null },
  nowMs = Date.now()
): CancelRejection | null {
  if (b.status !== "CONFIRMED") return "not_cancellable";
  if (!withinCancelWindow(b.start_at, nowMs)) return "too_late";
  if (b.payment_status === "PAID" && b.payment_method !== "MERCADOPAGO") return "paid_at_club";
  return null;
}

export async function cancelBooking(bookingId: string, by: CancelBy): Promise<CancelResult> {
  const { data, error } = await supabaseAdmin.from("bookings").select(SELECT).eq("id", bookingId).maybeSingle();
  if (error) {
    console.error("cancelBooking fetch", bookingId, error);
    return reject("db_error");
  }
  const b = data as unknown as BookingForCancel | null;
  if (!b) return reject("not_found");

  if (by === "CUSTOMER") {
    const block = customerCancelBlock(b);
    if (block) return reject(block);
  } else if (b.status !== "CONFIRMED") {
    return reject("not_cancellable");
  } else if (b.payment_status === "PAID" && b.payment_method !== "MERCADOPAGO") {
    // Cobrado en recepción: primero se devuelve el dinero a mano.
    return reject("paid_at_club");
  }

  // 1) Liberar el horario. Condicionado al estado leído: si el webhook o
  //    recepción lo cambió en medio, no se pisa.
  const { data: claimed, error: upErr } = await supabaseAdmin
    .from("bookings")
    .update({ status: "CANCELLED", cancelled_by: by, cancelled_at: new Date().toISOString() })
    .eq("id", bookingId)
    .eq("status", "CONFIRMED")
    .eq("payment_status", b.payment_status)
    .select("id")
    .maybeSingle();
  if (upErr) {
    console.error("cancelBooking update", bookingId, upErr);
    return reject("db_error");
  }
  if (!claimed) return reject("conflict");

  // 2) Reembolso automático si pagó en línea.
  let refund: "none" | "refunded" | "failed" = "none";
  let refundedMXN: number | null = null;
  if (b.payment_status === "PAID" && b.payment_method === "MERCADOPAGO" && b.mp_payment_id && !DEMO) {
    try {
      const r = await refunds.total({
        payment_id: b.mp_payment_id,
        // Si se reintenta, Mercado Pago no devuelve dos veces.
        requestOptions: { idempotencyKey: `refund-${bookingId}` },
      });
      refundedMXN = Number(r.amount ?? b.paid_amount ?? 0);
      refund = "refunded";
      await supabaseAdmin
        .from("bookings")
        .update({
          payment_status: "REFUNDED",
          refunded_amount: refundedMXN,
          refunded_at: new Date().toISOString(),
          mp_refund_id: r.id != null ? String(r.id) : null,
        })
        .eq("id", bookingId);
    } catch (e) {
      refund = "failed";
      console.error("cancelBooking refund", bookingId, e);
      await alertOwner("Reembolso automático fallido — hacerlo a mano", [
        `La reserva ${bookingId} se canceló (${by === "CUSTOMER" ? "por el cliente" : "en recepción"}),`,
        `pero Mercado Pago no aceptó el reembolso del pago ${b.mp_payment_id} por $${b.paid_amount ?? "?"} MXN.`,
        "Reembólsalo desde el panel de Mercado Pago y avísale al cliente.",
      ]);
    }
  }

  // 3) Avisos (best-effort: la cancelación ya quedó hecha).
  const s = mxParts(b.start_at);
  const e = mxParts(b.end_at);
  const courtName = b.courts?.name ?? "Cancha";
  const fullName = (b.customers?.full_name ?? "").trim() || "Cliente";
  if (b.contact_email) {
    const mail = buildCancellationEmail({
      fullName,
      courtName,
      dateLocal: s.dateLocal,
      startTimeLocal: s.timeLocal,
      endTimeLocal: e.timeLocal,
      cancelledBy: by,
      refundedMXN,
      refundPending: refund === "failed",
    });
    const sent = await sendEmail({ to: b.contact_email, subject: mail.subject, html: mail.html, text: mail.text });
    if (!sent.ok) console.error("cancellation email failed", bookingId, sent.error);
  }
  if (by === "CUSTOMER") {
    const notify = (process.env.NOTIFY_EMAIL ?? "").trim();
    if (notify) {
      const lines = [
        `${fullName} canceló su reserva.`,
        `Cancha: ${courtName} · ${s.dateLocal} · ${s.timeLocal}–${e.timeLocal}`,
        refund === "refunded" ? `Se le reembolsaron $${refundedMXN} MXN por Mercado Pago.` : "No había pago en línea.",
        "El horario ya quedó libre para otras reservas.",
      ];
      await sendEmail({
        to: notify,
        subject: `Reserva cancelada - ${courtName} ${s.dateLocal} ${s.timeLocal}`,
        text: lines.join("\n"),
        html: `<div style="font-family:sans-serif;font-size:14px">${lines.map((l) => `<p>${escHtml(l)}</p>`).join("")}</div>`,
      });
    }
  }

  return { ok: true, refund, refundedMXN };
}
