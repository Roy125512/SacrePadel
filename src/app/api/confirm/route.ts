import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabaseServer";

type ConfirmBody = {
  booking_id?: string;
  full_name?: string;
  phone?: string;
};

async function normalizePhoneToE164(phoneRaw: string): Promise<string> {
  const input = (phoneRaw ?? "").trim();

  if (/^\+\d{8,15}$/.test(input)) return input;

  try {
    const mod = await import("libphonenumber-js");
    const parsePhoneNumberFromString = mod.parsePhoneNumberFromString;
    const p = parsePhoneNumberFromString(input, "MX");
    if (p && p.isValid()) return p.number;
  } catch {}

  const digits = input.replace(/[^\d]/g, "");
  if (digits.length === 10) return `+52${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return input;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as ConfirmBody;

  const booking_id = String(body.booking_id ?? "").trim();
  let full_name = String(body.full_name ?? "").trim();
  const phone_input = String(body.phone ?? "").trim();

  if (!booking_id) return NextResponse.json({ error: "booking_id es requerido" }, { status: 400 });
  if (!full_name) return NextResponse.json({ error: "full_name es requerido" }, { status: 400 });
  if (!phone_input) return NextResponse.json({ error: "phone es requerido" }, { status: 400 });

  const supa = supabaseServer();
  const { data: userData } = await supa.auth.getUser();
  const user = userData?.user ?? null;

  let profFullName: string | null = null;
  let profPhoneE164: string | null = null;
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

    profFullName = (prof?.full_name ?? null) as any;
    profPhoneE164 = (prof?.phone_e164 ?? null) as any;
    profBirthDate = (prof?.birth_date ?? null) as any;
    profNotes = (prof?.notes ?? null) as any;
    profSex = (prof?.sex ?? null) as any;
    profDivision = (prof?.division ?? null) as any;

    if (profFullName) full_name = String(profFullName);
  }

  const phone_e164 = profPhoneE164 ? String(profPhoneE164) : await normalizePhoneToE164(phone_input);

  const { data: booking, error: bookingErr } = await supabaseAdmin
    .from("bookings")
    .select("id, status, source, hold_expires_at")
    .eq("id", booking_id)
    .maybeSingle();

  if (bookingErr) return NextResponse.json({ error: bookingErr.message }, { status: 500 });
  if (!booking) return NextResponse.json({ error: "HOLD no encontrado" }, { status: 404 });

  if (booking.source !== "WEB") return NextResponse.json({ error: "Esta reserva no es de WEB" }, { status: 409 });
  if (booking.status !== "HOLD") return NextResponse.json({ error: "Esta reserva ya no está en HOLD" }, { status: 409 });

  const now = new Date();
  const exp = booking.hold_expires_at ? new Date(booking.hold_expires_at) : null;
  if (exp && exp.getTime() <= now.getTime()) {
    await supabaseAdmin.from("bookings").update({ status: "CANCELLED", hold_expires_at: null }).eq("id", booking_id);
    return NextResponse.json({ error: "El HOLD expiró. Vuelve a seleccionar el horario." }, { status: 409 });
  }

  let customer_id: string | null = null;

  const { data: existingCustomer, error: custFindErr } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("phone_e164", phone_e164)
    .maybeSingle();

  if (custFindErr) return NextResponse.json({ error: custFindErr.message }, { status: 500 });

  const birthday = profBirthDate ?? null;
  const player_notes = profNotes ?? null;
  const sex = profSex ?? null;
  const division = profDivision ?? null;

  if (existingCustomer?.id) {
    customer_id = existingCustomer.id;

    await supabaseAdmin
      .from("customers")
      .update({ full_name, birthday, player_notes, sex, division })
      .eq("id", customer_id);
  } else {
    const { data: newCustomer, error: custInsertErr } = await supabaseAdmin
      .from("customers")
      .insert({ full_name, phone_e164, birthday, player_notes, sex, division })
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
    .select("id, status, customer_id, user_id, start_at, end_at, court_id")
    .single();

  if (confirmErr) return NextResponse.json({ error: confirmErr.message }, { status: 409 });

  return NextResponse.json({ booking: confirmed }, { status: 200 });
}
