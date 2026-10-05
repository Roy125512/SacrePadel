import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@/lib/supabaseServer";
import { mpPreference } from "@/lib/mercadopago";
import { computeExpectedAmountMXN } from "@/lib/pricing-shared";
import { normalizePhoneToE164 } from "@/lib/phone";
import { profileCustomerFields, resolveWebCustomer } from "@/lib/customers";
import { MP_CHECKOUT_MINUTES } from "@/lib/mpBookings";
import { DEMO } from "@/lib/demo/flag";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { dbErrorResponse } from "@/lib/apiError";

const BodySchema = z.object({
  booking_id: z.string().uuid(),
  full_name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(1).max(40),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
});

export async function POST(req: Request) {
  try {
    const rl = await rateLimit(`create-mp-preference:${clientIp(req)}`, 10, 60_000);
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
        { error: "Revisa tu nombre, teléfono y correo e intenta de nuevo." },
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

    // Check expiration. Un HOLD vencido que ya tenía link de pago no se
    // borra aquí: la limpieza (settleMpHold) primero revisa si se pagó.
    const exp = booking.hold_expires_at ? new Date(booking.hold_expires_at) : null;
    if (exp && exp.getTime() <= Date.now()) {
      if (!booking.mp_preference_id) {
        await supabaseAdmin
          .from("bookings")
          .delete()
          .eq("id", booking_id)
          .eq("status", "HOLD")
          .eq("source", "WEB");
      }
      return NextResponse.json(
        { error: "El HOLD expiró. Vuelve a seleccionar el horario." },
        { status: 409 },
      );
    }

    // 2) Datos del cliente — se guardan en la reserva ANTES de mandarlo a
    // pagar. Si después cierra el navegador o regresa desde otro
    // dispositivo, el webhook igual tiene a quién ligar la reserva y a qué
    // correo mandar la confirmación.
    let userId: string | null = null;
    let userEmail: string | null = null;
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      userId = data?.user?.id ?? null;
      userEmail = data?.user?.email ?? null;
    } catch {}

    const profile = userId ? await profileCustomerFields(userId) : null;
    const phone_e164 =
      (profile?.phone_e164 && normalizePhoneToE164(profile.phone_e164)) || normalizePhoneToE164(parsed.data.phone);
    if (!phone_e164) {
      return NextResponse.json({ error: "Escribe un teléfono válido (10 dígitos)." }, { status: 400 });
    }
    const contact_email = userEmail || parsed.data.email || null;

    const customer = await resolveWebCustomer(
      {
        full_name: profile?.full_name || parsed.data.full_name,
        phone_e164,
        email: contact_email,
        birthday: profile?.birthday,
        player_notes: profile?.player_notes,
        sex: profile?.sex,
        division: profile?.division,
      },
      userId
    );
    if ("error" in customer) return dbErrorResponse("POST /api/web/create-mp-preference resolve customer", customer.error);

    // 3) Compute amount server-side (never trust client)
    const amount_mxn = computeExpectedAmountMXN(booking.start_at, booking.end_at);

    if (amount_mxn <= 0) {
      return NextResponse.json({ error: "Monto inválido." }, { status: 400 });
    }

    const courtName = booking.courts?.name ?? "cancha";
    const origin = new URL(req.url).origin;
    const isHttps = origin.startsWith("https://");

    // El link de pago vence exactamente cuando vence el HOLD: así no se
    // puede pagar un horario que ya se liberó para otros clientes.
    const now = new Date();
    const expiresAt = new Date(now.getTime() + MP_CHECKOUT_MINUTES * 60_000);

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
      expires: true,
      expiration_date_from: now.toISOString(),
      expiration_date_to: expiresAt.toISOString(),
      // Se excluyen métodos de pago lentos (OXXO/efectivo, que pueden tardar
      // hasta 3 días en acreditarse) para que nunca haya una reserva
      // "pagando" colgada más tiempo del que el HOLD puede sostener.
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
    let preferenceId = booking.mp_preference_id as string | null;

    // 4) Idempotent: reuse existing preference if present
    if (preferenceId) {
      const updated = await mpPreference.update({
        id: preferenceId,
        updatePreferenceRequest: preferenceBody,
      });
      init_point = updated.init_point ?? updated.sandbox_init_point;
    } else {
      const created = await mpPreference.create({ body: preferenceBody });
      preferenceId = created.id ?? null;
      init_point = created.init_point ?? created.sandbox_init_point;
    }

    if (!init_point || !preferenceId) {
      return NextResponse.json({ error: "Mercado Pago no devolvió un link de pago." }, { status: 502 });
    }

    // 5) Liga cliente + correo, guarda la preferencia y alarga el HOLD lo
    // mismo que dura el link de pago. Solo si sigue siendo nuestro HOLD.
    const { data: saved, error: saveErr } = await supabaseAdmin
      .from("bookings")
      .update({
        mp_preference_id: preferenceId,
        customer_id: customer.id,
        user_id: userId,
        contact_email,
        hold_expires_at: expiresAt.toISOString(),
      })
      .eq("id", booking_id)
      .eq("status", "HOLD")
      .select("id")
      .maybeSingle();

    if (saveErr) return dbErrorResponse("POST /api/web/create-mp-preference save booking", saveErr);
    if (!saved) {
      return NextResponse.json(
        { error: "Tu apartado ya no está activo. Vuelve a seleccionar el horario." },
        { status: 409 },
      );
    }

    return NextResponse.json({ init_point }, { status: 200 });
  } catch (e) {
    return dbErrorResponse("POST /api/web/create-mp-preference", e);
  }
}
