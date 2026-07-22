import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { mpPreference } from "@/lib/mercadopago";
import { computeExpectedAmountMXN } from "@/lib/pricing-shared";
import { DEMO } from "@/lib/demo/flag";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { dbErrorResponse } from "@/lib/apiError";

const BodySchema = z.object({
  booking_id: z.string().uuid(),
});

export async function POST(req: Request) {
  try {
    const rl = rateLimit(`create-mp-preference:${clientIp(req)}`, 10, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Espera unos segundos e intenta de nuevo." },
        { status: 429 }
      );
    }

    if (DEMO) {
      return NextResponse.json(
        { error: "El pago en línea no está disponible en modo demo. Usa 'Pagar en recepción'." },
        { status: 503 },
      );
    }

    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Cuerpo de la solicitud inválido.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { booking_id } = parsed.data;

    // 1) Read HOLD
    const { data: booking, error: readErr } = await supabaseAdmin
      .from("bookings")
      .select("id, status, source, hold_expires_at, start_at, end_at, court_id, mp_preference_id, courts ( name )")
      .eq("id", booking_id)
      .maybeSingle();

    if (readErr || !booking) {
      return NextResponse.json({ error: "HOLD no encontrado." }, { status: 404 });
    }

    if (booking.source !== "WEB") {
      return NextResponse.json({ error: "Esta reserva no es de WEB." }, { status: 409 });
    }

    if (booking.status !== "HOLD") {
      return NextResponse.json({ error: "Esta reserva ya no está en HOLD." }, { status: 409 });
    }

    // Check expiration
    const now = new Date();
    const exp = booking.hold_expires_at ? new Date(booking.hold_expires_at) : null;
    if (exp && exp.getTime() <= now.getTime()) {
      await supabaseAdmin
        .from("bookings")
        .delete()
        .eq("id", booking_id)
        .eq("status", "HOLD")
        .eq("source", "WEB");
      return NextResponse.json(
        { error: "El HOLD expiró. Vuelve a seleccionar el horario." },
        { status: 409 },
      );
    }

    // 2) Compute amount server-side (never trust client)
    const amount_mxn = computeExpectedAmountMXN(booking.start_at, booking.end_at);

    if (amount_mxn <= 0) {
      return NextResponse.json({ error: "Monto inválido." }, { status: 400 });
    }

    const courtName = (booking as any).courts?.name ?? "cancha";
    const origin = new URL(req.url).origin;
    const isHttps = origin.startsWith("https://");

    const preferenceBody = {
      items: [
        {
          id: booking_id,
          title: `Reserva ${courtName} — Sacré Pádel`,
          quantity: 1,
          currency_id: "MXN",
          unit_price: amount_mxn,
        },
      ],
      external_reference: booking_id,
      back_urls: {
        success: `${origin}/reservar`,
        pending: `${origin}/reservar`,
        failure: `${origin}/reservar`,
      },
      notification_url: `${origin}/api/mercadopago/webhook`,
      // El HOLD solo se renueva unos minutos (ver abajo) — se excluyen
      // métodos de pago lentos (OXXO/efectivo, que pueden tardar hasta 3
      // días en acreditarse) para que nunca haya una reserva "pagando"
      // colgada más tiempo del que el HOLD puede sostener.
      payment_methods: {
        excluded_payment_types: [{ id: "ticket" }],
      },
      // auto_return exige back_urls en HTTPS — en desarrollo local
      // (http://localhost) Mercado Pago lo rechaza con "back_url.success
      // must be defined". En local el cliente solo verá un botón para
      // volver al sitio en vez de que lo regrese solo; en producción
      // (HTTPS) sí vuelve automáticamente.
      ...(isHttps ? { auto_return: "approved" } : {}),
    };

    let init_point: string | null | undefined;

    // 3) Idempotent: reuse existing preference if present
    if (booking.mp_preference_id) {
      const updated = await mpPreference.update({
        id: booking.mp_preference_id,
        updatePreferenceRequest: preferenceBody,
      });
      init_point = updated.init_point ?? updated.sandbox_init_point;
    } else {
      const created = await mpPreference.create({ body: preferenceBody });

      await supabaseAdmin
        .from("bookings")
        .update({ mp_preference_id: created.id })
        .eq("id", booking_id);

      init_point = created.init_point ?? created.sandbox_init_point;
    }

    if (!init_point) {
      return NextResponse.json({ error: "Mercado Pago no devolvió un link de pago." }, { status: 502 });
    }

    // 4) Renew hold expiration (+10 min) to give time for the checkout
    const newExpiry = new Date(Date.now() + 10 * 60_000).toISOString();
    await supabaseAdmin
      .from("bookings")
      .update({ hold_expires_at: newExpiry })
      .eq("id", booking_id);

    return NextResponse.json({ init_point }, { status: 200 });
  } catch (e: any) {
    return dbErrorResponse("POST /api/web/create-mp-preference", e);
  }
}
