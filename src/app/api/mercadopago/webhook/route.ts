import { NextResponse } from "next/server";
import { WebhookSignatureValidator, InvalidWebhookSignatureError } from "mercadopago";
import { mpPayment } from "@/lib/mercadopago";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { computeExpectedAmountMXN } from "@/lib/pricing-shared";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const dataId = url.searchParams.get("data.id") ?? url.searchParams.get("id");
  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

  if (!secret) {
    // Misconfiguration on our side — log loudly, but still 200 so Mercado
    // Pago doesn't hammer us with retries while we notice and fix it.
    console.error("MERCADOPAGO_WEBHOOK_SECRET no está configurado.");
    return NextResponse.json({ received: true }, { status: 200 });
  }

  try {
    WebhookSignatureValidator.validate({ xSignature, xRequestId, dataId, secret });
  } catch (err) {
    if (err instanceof InvalidWebhookSignatureError) {
      console.error("MP webhook: firma inválida", { reason: err.reason, requestId: err.requestId });
    } else {
      console.error("MP webhook: error validando firma", err);
    }
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (!dataId) {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // Solo nos interesan notificaciones de pagos (la única suscripción que
  // pedimos configurar en el panel de Mercado Pago).
  const body = await req.json().catch(() => null);
  if (body?.type && body.type !== "payment") {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  let payment;
  try {
    payment = await mpPayment.get({ id: dataId });
  } catch (err) {
    console.error("MP webhook: no se pudo obtener el pago", dataId, err);
    return NextResponse.json({ received: true }, { status: 200 });
  }

  if (payment.status !== "approved") {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const booking_id = payment.external_reference;
  if (!booking_id) {
    console.warn("MP webhook: pago aprobado sin external_reference:", payment.id);
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select("id, status, payment_status, start_at, end_at")
    .eq("id", booking_id)
    .maybeSingle();

  if (!booking) {
    console.warn("MP webhook: reserva no encontrada para", booking_id);
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // Idempotente: si ya está pagada (p. ej. la confirmó primero el propio
  // navegador al regresar del checkout), no hay nada que hacer.
  if (booking.payment_status === "PAID") {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // No resucitar una reserva que recepción ya canceló — Mercado Pago puede
  // reintentar esta notificación por varios días.
  if (booking.status === "CANCELLED") {
    console.warn("MP webhook: la reserva fue cancelada después del pago aprobado, se deja cancelada:", booking_id);
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const amount_mxn = computeExpectedAmountMXN(booking.start_at, booking.end_at);
  const nowIso = new Date().toISOString();

  await supabaseAdmin
    .from("bookings")
    .update({
      status: "CONFIRMED",
      payment_status: "PAID",
      payment_method: "MERCADOPAGO",
      paid_amount: amount_mxn,
      paid_at: nowIso,
      hold_expires_at: null,
      mp_payment_id: String(payment.id),
    })
    .eq("id", booking_id)
    .neq("status", "CANCELLED");

  // Siempre 200 para confirmar recepción.
  return NextResponse.json({ received: true }, { status: 200 });
}
