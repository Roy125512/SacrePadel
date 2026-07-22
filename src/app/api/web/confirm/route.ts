import { NextResponse, NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@/lib/supabaseServer";
import { sendEmail } from "@/lib/mailer";
import { buildBookingConfirmationEmail, buildOwnerNotificationEmail } from "@/lib/bookingEmail";
import { computeExpectedAmountMXN } from "@/lib/pricing-shared";
import { mpPayment } from "@/lib/mercadopago";
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

const TOLERANCE_MINUTES = 15;

const TZ = "America/Mexico_City";

function isValidEmail(e: string) {
  const s = (e ?? "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function mxParts(iso: string) {
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

async function normalizePhoneToE164(phoneRaw: string): Promise<string> {
  const input = (phoneRaw ?? "").trim();
  if (/^\+\d{8,15}$/.test(input)) return input;

  try {
    const mod = await import("libphonenumber-js");
    const p = mod.parsePhoneNumberFromString(input, "MX");
    if (p && p.isValid()) return p.number;
  } catch {}

  const onlyDigits = input.replace(/[^\d]/g, "");
  if (onlyDigits.length === 10) return `+52${onlyDigits}`;
  if (onlyDigits.length >= 11 && onlyDigits.length <= 15) return `+${onlyDigits}`;
  return input;
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
    let full_name = String(body.full_name ?? "").trim();
    const phone_input = String(body.phone ?? "").trim();
    const email_body = String(body.email ?? "").trim();

    if (!booking_id) return NextResponse.json({ error: "booking_id es requerido" }, { status: 400 });
    if (!full_name) return NextResponse.json({ error: "full_name es requerido" }, { status: 400 });
    if (!phone_input) return NextResponse.json({ error: "phone es requerido" }, { status: 400 });

    // usuario logueado (si hay sesión)
    let user: any = null;
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      user = data?.user ?? null;
    } catch {}

    const emailToSend =
      (user?.email && isValidEmail(user.email) ? user.email : "") ||
      (email_body && isValidEmail(email_body) ? email_body : "");

    // traer perfil (solo para datos extra / normalización)
    let profilePhone: string | null = null;
    let profBirthDate: string | null = null;
    let profNotes: string | null = null;
    let profSex: string | null = null;
    let profDivision: string | null = null;

    if (user) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("full_name, phone_e164, birth_date, notes, sex, division")
        .eq("id", user.id)
        .maybeSingle();

      if (prof?.full_name) full_name = String(prof.full_name);
      if (prof?.phone_e164) profilePhone = String(prof.phone_e164);
      profBirthDate = (prof?.birth_date ?? null) as any;
      profNotes = (prof?.notes ?? null) as any;
      profSex = (prof?.sex ?? null) as any;
      profDivision = (prof?.division ?? null) as any;
    }

    const phone_e164 = profilePhone ?? (await normalizePhoneToE164(phone_input));

    const { data: booking, error: bookingErr } = await supabaseAdmin
      .from("bookings")
      .select("id, status, payment_status, source, hold_expires_at, court_id, start_at, end_at, mp_payment_id")
      .eq("id", booking_id)
      .maybeSingle();

    if (bookingErr) return dbErrorResponse("POST /api/web/confirm fetch booking", bookingErr);
    if (!booking) return NextResponse.json({ error: "HOLD no encontrado" }, { status: 404 });

    if (booking.source !== "WEB") return NextResponse.json({ error: "Esta reserva no es de WEB" }, { status: 409 });

    // Race recovery: the Mercado Pago webhook can confirm+pay this booking
    // before the browser makes it back from the Checkout Pro redirect.
    // Treat that as success here too (idempotent) instead of 409ing a
    // customer who already paid — this is also where customer_id/email get
    // attached, which the webhook can't do.
    const mpAlreadyFinalized =
      booking.status === "CONFIRMED" &&
      booking.payment_status === "PAID" &&
      (body.payment_method ?? "RECEPTION") === "MERCADOPAGO" &&
      !!booking.mp_payment_id;

    const alreadyFinalized = mpAlreadyFinalized;

    if (booking.status !== "HOLD" && !alreadyFinalized) {
      return NextResponse.json({ error: "Esta reserva ya no está en HOLD" }, { status: 409 });
    }

    if (!alreadyFinalized) {
      const now = new Date();
      const exp = booking.hold_expires_at ? new Date(booking.hold_expires_at) : null;
      if (exp && exp.getTime() <= now.getTime()) {
        // ✅ Si expiró, bórralo para que no bloquee el constraint
        await supabaseAdmin.from("bookings").delete().eq("id", booking_id).eq("status", "HOLD").eq("source", "WEB");
        return NextResponse.json({ error: "El HOLD expiró. Vuelve a seleccionar el horario." }, { status: 409 });
      }
    }

    // ✅ monto dinámico
    const expected_amount = computeExpectedAmountMXN(booking.start_at, booking.end_at);

    // MERCADOPAGO path: verify the payment actually succeeded server-side
    // before confirming — never trust what the client claims.
    const paymentMethod = body.payment_method ?? "RECEPTION";
    let isMpPaid = false;

    if (paymentMethod === "MERCADOPAGO" && DEMO) {
      return NextResponse.json(
        { error: "El pago en línea no está disponible en modo demo." },
        { status: 503 },
      );
    }

    if (paymentMethod === "MERCADOPAGO" && !mpAlreadyFinalized) {
      const mpPaymentId = String(body.mp_payment_id ?? "").trim();
      if (!mpPaymentId) {
        return NextResponse.json({ error: "Falta el identificador del pago de Mercado Pago." }, { status: 409 });
      }

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

      // Defense in depth: verify the amount actually paid matches what this
      // booking currently costs (start/end could have changed after the
      // preference was created).
      const paidAmount = Math.round(payment.transaction_amount ?? 0);
      if (paidAmount !== Math.round(expected_amount)) {
        console.error("CONFIRM MP amount mismatch:", {
          booking_id,
          mp_amount: paidAmount,
          expected_amount,
        });
        return NextResponse.json(
          {
            error:
              "El monto pagado no coincide con esta reserva. Contacta a recepción para resolverlo antes de continuar.",
          },
          { status: 409 },
        );
      }

      isMpPaid = true;
    }

    // customer upsert
    let customer_id: string | null = null;

    const { data: existingCustomer, error: custFindErr } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("phone_e164", phone_e164)
      .maybeSingle();

    if (custFindErr) return dbErrorResponse("POST /api/web/confirm find customer", custFindErr);

    if (existingCustomer?.id) {
      customer_id = existingCustomer.id;
      // Si tu tabla customers SÍ tiene email, lo guardamos (best-effort, sin romper si no existe)
      const updatePayload: any = {
        full_name,
        birthday: profBirthDate ?? null,
        player_notes: profNotes ?? null,
        sex: profSex ?? null,
        division: profDivision ?? null,
      };
      if (emailToSend) updatePayload.email = emailToSend;

      await supabaseAdmin.from("customers").update(updatePayload).eq("id", customer_id);
    } else {
      const insertPayload: any = {
        full_name,
        phone_e164,
        birthday: profBirthDate ?? null,
        player_notes: profNotes ?? null,
        sex: profSex ?? null,
        division: profDivision ?? null,
      };
      if (emailToSend) insertPayload.email = emailToSend;

      const { data: newCustomer, error: custInsertErr } = await supabaseAdmin
        .from("customers")
        .insert(insertPayload)
        .select("id")
        .single();

      if (custInsertErr) return dbErrorResponse("POST /api/web/confirm insert customer", custInsertErr);
      customer_id = newCustomer.id;
    }

    const updatePayloadBooking: Record<string, unknown> = {
      status: "CONFIRMED",
      customer_id,
      user_id: user?.id ?? null,
      hold_expires_at: null,
    };

    if (isMpPaid) {
      updatePayloadBooking.payment_status = "PAID";
      updatePayloadBooking.payment_method = "MERCADOPAGO";
      updatePayloadBooking.paid_amount = expected_amount;
      updatePayloadBooking.paid_at = new Date().toISOString();
      updatePayloadBooking.mp_payment_id = String(body.mp_payment_id ?? "").trim();
    }

    let confirmUpdate = supabaseAdmin.from("bookings").update(updatePayloadBooking).eq("id", booking_id);
    if (!alreadyFinalized) {
      // Normal path: only flip a row that is still the HOLD we validated
      // above. When alreadyFinalized, a webhook already made this
      // transition — this call only needs to attach customer_id/user_id.
      confirmUpdate = confirmUpdate.eq("status", "HOLD");
    }

    const { data: confirmed, error: confirmErr } = await confirmUpdate
      .select("id, court_id, start_at, end_at, status, customer_id, user_id")
      .single();

    if (confirmErr) {
      return dbErrorResponse("POST /api/web/confirm update booking", confirmErr, 409);
    }

    // nombre de cancha (opcional)
    let courtName = "Cancha";
    try {
      const { data: court } = await supabaseAdmin.from("courts").select("name").eq("id", confirmed.court_id).maybeSingle();
      if (court?.name) courtName = String(court.name);
    } catch {}

    // enviar email (best-effort)
    let email_sent = false;
    let email_error: string | null = null;

    if (emailToSend) {
      const s = mxParts(confirmed.start_at);
      const e = mxParts(confirmed.end_at);

      const mail = buildBookingConfirmationEmail({
        clubName: "Sacré Pádel",
        fullName: full_name,
        courtName,
        dateLocal: s.dateLocal,
        startTimeLocal: s.timeLocal,
        endTimeLocal: e.timeLocal,
        toleranceMinutes: TOLERANCE_MINUTES,
        paymentMethod: isMpPaid ? "MERCADOPAGO" : "RECEPTION",
        amountMXN: expected_amount,
      });

      const sent = await sendEmail({
        to: emailToSend,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      });

      if (sent.ok) email_sent = true;
      else email_error = sent.error;
    }

    // Notify owner/admin about the new booking (best-effort)
    const notifyEmail = (process.env.NOTIFY_EMAIL ?? "").trim();
    if (notifyEmail) {
      try {
        const s = mxParts(confirmed.start_at);
        const e = mxParts(confirmed.end_at);

        const ownerMail = buildOwnerNotificationEmail({
          clubName: "Sacre Padel",
          customerName: full_name,
          customerPhone: phone_e164,
          customerEmail: emailToSend || undefined,
          courtName,
          dateLocal: s.dateLocal,
          startTimeLocal: s.timeLocal,
          endTimeLocal: e.timeLocal,
          paymentMethod: isMpPaid ? "MERCADOPAGO" : "RECEPTION",
          amountMXN: expected_amount,
        });

        await sendEmail({
          to: notifyEmail,
          subject: ownerMail.subject,
          html: ownerMail.html,
          text: ownerMail.text,
        });
      } catch (notifyErr) {
        console.error("Owner notification email failed:", notifyErr);
      }
    }

    return NextResponse.json(
      {
        booking: confirmed,
        tolerance_minutes: TOLERANCE_MINUTES,
        email_to: emailToSend || null,
        email_sent,
        email_error,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return dbErrorResponse("POST /api/web/confirm", e);
  }
}
