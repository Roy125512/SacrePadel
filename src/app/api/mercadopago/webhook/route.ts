import { NextResponse } from "next/server";
import { WebhookSignatureValidator, InvalidWebhookSignatureError } from "mercadopago";
import { mpPayment } from "@/lib/mercadopago";
import { finalizeMpBooking } from "@/lib/mpBookings";

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
  const topic = body?.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  if (topic && topic !== "payment") {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  let payment;
  try {
    payment = await mpPayment.get({ id: dataId });
  } catch (err) {
    // 500 para que Mercado Pago reintente: si se contesta 200 aquí, un pago
    // aprobado durante una falla momentánea nunca se confirmaría.
    console.error("MP webhook: no se pudo obtener el pago", dataId, err);
    return NextResponse.json({ error: "Temporary error" }, { status: 500 });
  }

  if (payment.status !== "approved") {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const booking_id = payment.external_reference;
  if (!booking_id) {
    console.warn("MP webhook: pago aprobado sin external_reference:", payment.id);
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // Confirma, registra el monto realmente cobrado y manda los correos
  // (una sola vez) — también cuando el cliente cerró el navegador y nunca
  // regresó al sitio. Idempotente frente a reintentos de Mercado Pago.
  const result = await finalizeMpBooking(booking_id, payment);

  // Un error de base de datos sí se reporta como fallo para que Mercado
  // Pago reintente más tarde; todo lo demás ya quedó resuelto o avisado.
  if (!result.ok && result.reason === "db_error") {
    return NextResponse.json({ error: "Temporary error" }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
