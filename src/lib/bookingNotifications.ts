import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/mailer";
import { buildBookingConfirmationEmail, buildOwnerNotificationEmail } from "@/lib/bookingEmail";
import { computeExpectedAmountMXN } from "@/lib/pricing-shared";

export const TOLERANCE_MINUTES = 15;

const TZ = "America/Mexico_City";

export function mxParts(iso: string) {
  const dt = new Date(iso);
  const dateLocal = dt.toLocaleDateString("es-MX", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeLocal = dt.toLocaleTimeString("es-MX", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return { dateLocal, timeLocal };
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export type EmailResult = { email_to: string | null; email_sent: boolean; email_error: string | null };

/**
 * Manda los correos de confirmación (cliente + dueño) de una reserva web ya
 * CONFIRMED, una sola vez. La puede llamar tanto el navegador (al confirmar)
 * como el webhook de Mercado Pago: quien "gane" el UPDATE condicional sobre
 * confirmation_email_sent_at es quien manda; el otro solo reporta el estado.
 * `displayName` permite usar el nombre que escribió el cliente en el
 * formulario en vez del guardado en customers (que puede ser de otra
 * captura).
 */
export async function sendBookingConfirmationEmails(
  bookingId: string,
  opts?: { displayName?: string }
): Promise<EmailResult> {
  const { data: claimed, error: claimErr } = await supabaseAdmin
    .from("bookings")
    .update({ confirmation_email_sent_at: new Date().toISOString() })
    .eq("id", bookingId)
    .eq("status", "CONFIRMED")
    .is("confirmation_email_sent_at", null)
    .select(
      "id, start_at, end_at, payment_status, payment_method, paid_amount, contact_email, courts ( name ), customers:customer_id ( full_name, phone_e164 )"
    )
    .maybeSingle();

  if (claimErr) {
    console.error("sendBookingConfirmationEmails claim", bookingId, claimErr);
    return { email_to: null, email_sent: false, email_error: "No se pudo enviar el correo." };
  }

  if (!claimed) {
    // Ya los mandó otra llamada (o la reserva no está confirmada).
    const { data: b } = await supabaseAdmin
      .from("bookings")
      .select("contact_email, confirmation_email_sent_at")
      .eq("id", bookingId)
      .maybeSingle();
    const to = (b?.contact_email as string | null) ?? null;
    return { email_to: to, email_sent: !!(to && b?.confirmation_email_sent_at), email_error: null };
  }

  const b = claimed as any;
  const courtName = String(b.courts?.name ?? "Cancha");
  const fullName = opts?.displayName?.trim() || String(b.customers?.full_name ?? "").trim() || "Cliente";
  const phone = String(b.customers?.phone_e164 ?? "");
  const paidOnline = b.payment_status === "PAID" && b.payment_method === "MERCADOPAGO";
  const amountMXN = paidOnline ? Number(b.paid_amount ?? 0) : computeExpectedAmountMXN(b.start_at, b.end_at);
  const s = mxParts(b.start_at);
  const e = mxParts(b.end_at);
  const to = (b.contact_email as string | null) ?? null;

  let email_sent = false;
  let email_error: string | null = null;

  if (to) {
    const mail = buildBookingConfirmationEmail({
      clubName: "Sacré Pádel",
      fullName,
      courtName,
      dateLocal: s.dateLocal,
      startTimeLocal: s.timeLocal,
      endTimeLocal: e.timeLocal,
      toleranceMinutes: TOLERANCE_MINUTES,
      paymentMethod: paidOnline ? "MERCADOPAGO" : "RECEPTION",
      amountMXN,
    });
    const sent = await sendEmail({ to, subject: mail.subject, html: mail.html, text: mail.text });
    if (sent.ok) email_sent = true;
    else email_error = sent.error;
  }

  const notifyEmail = (process.env.NOTIFY_EMAIL ?? "").trim();
  if (notifyEmail) {
    const ownerMail = buildOwnerNotificationEmail({
      clubName: "Sacre Padel",
      customerName: fullName,
      customerPhone: phone,
      customerEmail: to || undefined,
      courtName,
      dateLocal: s.dateLocal,
      startTimeLocal: s.timeLocal,
      endTimeLocal: e.timeLocal,
      paymentMethod: paidOnline ? "MERCADOPAGO" : "RECEPTION",
      amountMXN,
    });
    const sent = await sendEmail({ to: notifyEmail, subject: ownerMail.subject, html: ownerMail.html, text: ownerMail.text });
    if (!sent.ok) console.error("Owner notification email failed:", sent.error);
  }

  return { email_to: to, email_sent, email_error };
}

/**
 * Aviso al dueño de algo que requiere revisión manual (p. ej. un pago
 * aprobado sin reserva, o un monto que no coincide). Best-effort.
 */
export async function alertOwner(subject: string, lines: string[]) {
  const notifyEmail = (process.env.NOTIFY_EMAIL ?? "").trim();
  console.error(`[ALERTA] ${subject}`, lines);
  if (!notifyEmail) return;

  const text = [...lines, "", "— Aviso automático del sitio de reservas"].join("\n");
  const html = `<div style="font-family:sans-serif;font-size:14px">${lines
    .map((l) => `<p>${esc(l)}</p>`)
    .join("")}<p style="color:#888">— Aviso automático del sitio de reservas</p></div>`;

  const sent = await sendEmail({ to: notifyEmail, subject: `⚠️ ${subject}`, html, text });
  if (!sent.ok) console.error("alertOwner email failed:", sent.error);
}
