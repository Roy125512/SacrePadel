import { NextResponse, NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@/lib/supabaseServer";
import { mpPayment } from "@/lib/mercadopago";
import { normalizePhoneToE164 } from "@/lib/phone";
import { profileCustomerFields, resolveWebCustomer } from "@/lib/customers";
import { sendBookingConfirmationEmails, TOLERANCE_MINUTES } from "@/lib/bookingNotifications";
import { finalizeMpBooking, settleMpHold } from "@/lib/mpBookings";
import { DEMO } from "@/lib/demo/flag";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { dbErrorResponse } from "@/lib/apiError";

type ConfirmBody = {
  booking_id?: string;
  full_name?: string;
  phone?: string;
  email?: string; // invitado (opcional)
  payment_method?: "RECEPTION" | "MERCADOPAGO";
  mp_payment_id?: string; // requerido cuando payment_method === "MERCADOPAGO"
};

function isValidEmail(e: string) {
  const s = (e ?? "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function POST(req: NextRequest) {
  try {
    const rl = rateLimit(`confirm:${clientIp(req)}`, 10, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Espera unos segundos e intenta de nuevo." },
        { status: 429 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as ConfirmBody;

    const booking_id = String(body.booking_id ?? "").trim();
    const typedName = String(body.full_name ?? "").trim();
    const phone_input = String(body.phone ?? "").trim();
    const email_body = String(body.email ?? "").trim();
    const paymentMethod = body.payment_method ?? "RECEPTION";

    if (!booking_id) return NextResponse.json({ error: "booking_id es requerido" }, { status: 400 });
    if (!typedName) return NextResponse.json({ error: "full_name es requerido" }, { status: 400 });
    if (!phone_input) return NextResponse.json({ error: "phone es requerido" }, { status: 400 });

    if (paymentMethod === "MERCADOPAGO" && DEMO) {
      return NextResponse.json({ error: "El pago en línea no está disponible en modo demo." }, { status: 503 });
    }

    // usuario logueado (si hay sesión)
    let user: { id: string; email?: string } | null = null;
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      user = data?.user ?? null;
    } catch {}

    const contact_email =
      (user?.email && isValidEmail(user.email) ? user.email : "") ||
      (email_body && isValidEmail(email_body) ? email_body : "") ||
      null;

    const profile = user ? await profileCustomerFields(user.id) : null;
    const full_name = profile?.full_name || typedName;
    const phone_e164 =
      (profile?.phone_e164 && normalizePhoneToE164(profile.phone_e164)) || normalizePhoneToE164(phone_input);
    if (!phone_e164) {
      return NextResponse.json({ error: "Escribe un teléfono válido (10 dígitos)." }, { status: 400 });
    }

    const { data: booking, error: bookingErr } = await supabaseAdmin
      .from("bookings")
      .select("id, status, payment_status, source, hold_expires_at, mp_preference_id, customer_id")
      .eq("id", booking_id)
      .maybeSingle();

    if (bookingErr) return dbErrorResponse("POST /api/web/confirm fetch booking", bookingErr);

    // ===== Pago en línea (regreso del Checkout Pro) =====
    if (paymentMethod === "MERCADOPAGO") {
      const mpPaymentId = String(body.mp_payment_id ?? "").trim();
      if (!mpPaymentId) {
        return NextResponse.json({ error: "Falta el identificador del pago de Mercado Pago." }, { status: 409 });
      }

      // Se verifica el pago con Mercado Pago ANTES de mirar si el HOLD
      // venció: un cliente que ya pagó nunca debe perder su reserva solo
      // porque el checkout tardó más de lo esperado.
      const payment = await mpPayment.get({ id: mpPaymentId });
      if (payment.status !== "approved") {
        return NextResponse.json({ error: "El pago aún no se ha completado." }, { status: 409 });
      }
      if (payment.external_reference !== booking_id) {
        console.error("CONFIRM MP external_reference mismatch:", {
          booking_id,
          mp_external_reference: payment.external_reference,
        });
        return NextResponse.json({ error: "El pago no corresponde a esta reserva." }, { status: 409 });
      }

      if (!booking) {
        // finalizeMpBooking avisa al dueño para que lo resuelva.
        await finalizeMpBooking(booking_id, payment);
        return NextResponse.json(
          {
            error:
              "Tu pago fue aprobado, pero no encontramos la reserva. Ya avisamos al club; escríbenos con tu comprobante y lo resolvemos.",
          },
          { status: 409 }
        );
      }
      if (booking.source !== "WEB") return NextResponse.json({ error: "Esta reserva no es de WEB" }, { status: 409 });

      // Normalmente el cliente ya quedó ligado al crear el link de pago;
      // esto solo cubre links creados antes de ese cambio.
      if (!booking.customer_id) {
        const customer = await resolveWebCustomer(
          { ...profile, full_name, phone_e164, email: contact_email },
          user?.id ?? null
        );
        if ("error" in customer) return dbErrorResponse("POST /api/web/confirm resolve customer", customer.error);
        await supabaseAdmin
          .from("bookings")
          .update({ customer_id: customer.id, user_id: user?.id ?? null, contact_email })
          .eq("id", booking_id);
      }

      const result = await finalizeMpBooking(booking_id, payment, { displayName: full_name });
      if (!result.ok) {
        if (result.reason === "cancelled") {
          return NextResponse.json(
            { error: "Esta reserva fue cancelada. Escríbenos con tu comprobante de pago y lo resolvemos." },
            { status: 409 }
          );
        }
        return dbErrorResponse("POST /api/web/confirm finalize MP", { message: result.reason });
      }

      return NextResponse.json(
        { booking: { id: booking_id }, tolerance_minutes: TOLERANCE_MINUTES, ...result.emails },
        { status: 200 }
      );
    }

    // ===== Pago en recepción =====
    if (!booking) return NextResponse.json({ error: "HOLD no encontrado" }, { status: 404 });
    if (booking.source !== "WEB") return NextResponse.json({ error: "Esta reserva no es de WEB" }, { status: 409 });
    if (booking.status !== "HOLD") {
      return NextResponse.json({ error: "Esta reserva ya no está en HOLD" }, { status: 409 });
    }

    const exp = booking.hold_expires_at ? new Date(booking.hold_expires_at) : null;
    if (exp && exp.getTime() <= Date.now()) {
      // Si el cliente alcanzó a abrir el pago en línea, se revisa si se
      // pagó antes de soltar el horario.
      if (booking.mp_preference_id) {
        const outcome = await settleMpHold(booking_id).catch(() => null);
        if (outcome === "confirmed") {
          return NextResponse.json(
            { error: "Esta reserva ya quedó pagada en línea. Revisa tu correo de confirmación." },
            { status: 409 }
          );
        }
      } else {
        await supabaseAdmin.from("bookings").delete().eq("id", booking_id).eq("status", "HOLD").eq("source", "WEB");
      }
      return NextResponse.json({ error: "El HOLD expiró. Vuelve a seleccionar el horario." }, { status: 409 });
    }

    const customer = await resolveWebCustomer(
      { ...profile, full_name, phone_e164, email: contact_email },
      user?.id ?? null
    );
    if ("error" in customer) return dbErrorResponse("POST /api/web/confirm resolve customer", customer.error);

    const { data: confirmed, error: confirmErr } = await supabaseAdmin
      .from("bookings")
      .update({
        status: "CONFIRMED",
        customer_id: customer.id,
        user_id: user?.id ?? null,
        contact_email,
        hold_expires_at: null,
      })
      .eq("id", booking_id)
      .eq("status", "HOLD")
      .select("id, court_id, start_at, end_at, status, customer_id, user_id")
      .single();

    if (confirmErr) {
      return dbErrorResponse("POST /api/web/confirm update booking", confirmErr, 409);
    }

    const emails = await sendBookingConfirmationEmails(booking_id, { displayName: full_name });

    return NextResponse.json(
      { booking: confirmed, tolerance_minutes: TOLERANCE_MINUTES, ...emails },
      { status: 200 }
    );
  } catch (e: any) {
    return dbErrorResponse("POST /api/web/confirm", e);
  }
}
