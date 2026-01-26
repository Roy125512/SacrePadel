import { NextResponse, NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@/lib/supabaseServer";
import { sendEmail } from "@/lib/mailer";
import { buildBookingConfirmationEmail } from "@/lib/bookingEmail";

type ConfirmBody = {
  booking_id?: string;
  full_name?: string;
  phone?: string;
  email?: string; // invitado (opcional)
};

const TOLERANCE_MINUTES = 15;

// precios
const DAY_RATE = 350; // 07:00 - 17:59
const EVENING_RATE = 400; // 18:00 - 21:59
const SWITCH_HOUR = 18;
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

function getLocalHourMinute(d: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return { hh, mm };
}

function rateAt(date: Date) {
  const { hh } = getLocalHourMinute(date);
  return hh >= SWITCH_HOUR ? EVENING_RATE : DAY_RATE;
}

/**
 * Calcula monto prorrateado por minuto con regla:
 * 07:00–17:59 => 350/h
 * 18:00–21:59 => 400/h
 */
function computeExpectedAmountMXN(startIso: string, endIso: string) {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;

  let total = 0;
  // minuto a minuto (súper seguro para cruces de 18:00)
  for (let t = startMs; t < endMs; t += 60_000) {
    const next = Math.min(t + 60_000, endMs);
    const hours = (next - t) / 3_600_000;
    total += hours * rateAt(new Date(t));
  }
  return Math.round(total * 100) / 100;
}

export async function POST(req: NextRequest) {
  try {
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
      .select("id, status, source, hold_expires_at, court_id, start_at, end_at")
      .eq("id", booking_id)
      .maybeSingle();

    if (bookingErr) return NextResponse.json({ error: bookingErr.message }, { status: 500 });
    if (!booking) return NextResponse.json({ error: "HOLD no encontrado" }, { status: 404 });

    if (booking.source !== "WEB") return NextResponse.json({ error: "Esta reserva no es de WEB" }, { status: 409 });
    if (booking.status !== "HOLD") return NextResponse.json({ error: "Esta reserva ya no está en HOLD" }, { status: 409 });

    const now = new Date();
    const exp = booking.hold_expires_at ? new Date(booking.hold_expires_at) : null;
    if (exp && exp.getTime() <= now.getTime()) {
      // ✅ Si expiró, bórralo para que no bloquee el constraint
      await supabaseAdmin.from("bookings").delete().eq("id", booking_id).eq("status", "HOLD").eq("source", "WEB");
      return NextResponse.json({ error: "El HOLD expiró. Vuelve a seleccionar el horario." }, { status: 409 });
    }

    // ✅ monto dinámico
    const expected_amount = computeExpectedAmountMXN(booking.start_at, booking.end_at);

    // customer upsert
    let customer_id: string | null = null;

    const { data: existingCustomer, error: custFindErr } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("phone_e164", phone_e164)
      .maybeSingle();

    if (custFindErr) return NextResponse.json({ error: custFindErr.message }, { status: 500 });

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

      if (custInsertErr) return NextResponse.json({ error: custInsertErr.message }, { status: 500 });
      customer_id = newCustomer.id;
    }

    const { data: confirmed, error: confirmErr } = await supabaseAdmin
      .from("bookings")
      .update({
        status: "CONFIRMED",
        customer_id,
        user_id: user?.id ?? null,
        hold_expires_at: null,
      })

      .eq("id", booking_id)
      .eq("status", "HOLD")
      .select("id, court_id, start_at, end_at, status, customer_id, user_id")
      .single();

    if (confirmErr) return NextResponse.json({ error: confirmErr.message }, { status: 409 });

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
        // si tu template lo soporta, podrías pasar también expected_amount aquí
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
    console.error("CONFIRM 500:", e);
    return NextResponse.json({ error: e?.message ?? "Error interno" }, { status: 500 });
  }
}
