import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireReceptionAccess } from "@/lib/guards/reception";
import { BUSINESS_TZ_OFFSET } from "@/lib/config";
import { toIsoAt } from "@/lib/availability";
import { computeExpectedAmountMXN } from "@/lib/pricing-shared";
import { normalizePhoneToE164 } from "@/lib/phone";
import { dbErrorResponse } from "@/lib/apiError";

const ORIGINS = new Set(["PHONE", "WHATSAPP", "WALK_IN"]);

export async function POST(req: Request) {
  const gate = await requireReceptionAccess({ asJson: true });
  if (!gate.ok) return gate.res;

  const body = await req.json().catch(() => ({}));

  const court_id = String(body.court_id ?? "").trim();
  const date = String(body.date ?? "").trim(); // YYYY-MM-DD
  const start_time = String(body.start_time ?? "").trim(); // HH:MM
  const duration_minutes = Number(body.duration_minutes ?? 0);
  const origin = String(body.origin ?? "").trim().toUpperCase();
  const full_name = String(body.full_name ?? "").trim();
  const phoneRaw = String(body.phone ?? "").trim();

  if (!court_id || !date || !start_time || !duration_minutes) {
    return NextResponse.json(
      { error: "Faltan datos: cancha, fecha, hora y duración son obligatorios." },
      { status: 400 }
    );
  }
  if (!ORIGINS.has(origin)) {
    return NextResponse.json({ error: "Origen inválido." }, { status: 400 });
  }
  if (!full_name) {
    return NextResponse.json({ error: "El nombre del cliente es obligatorio." }, { status: 400 });
  }

  const [hh, mm] = start_time.split(":").map((x) => Number(x));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) {
    return NextResponse.json({ error: "Hora inválida." }, { status: 400 });
  }

  const startMinutes = hh * 60 + mm;
  // A propósito SIN validar que la hora ya haya pasado — a diferencia del
  // sitio público, recepción registra reservas de clientes que están ahí
  // mismo (llamando o presentes), incluido "ahora mismo" o unos minutos
  // atrás si ya empezaron a jugar.
  const start_at = toIsoAt(date, startMinutes, BUSINESS_TZ_OFFSET);
  const end_at = toIsoAt(date, startMinutes + duration_minutes, BUSINESS_TZ_OFFSET);

  const phone_e164 = phoneRaw ? normalizePhoneToE164(phoneRaw) : null;

  try {
    // Cliente: buscar por teléfono o crear uno nuevo (igual que /api/customers).
    let customer_id: string | null = null;
    if (phone_e164) {
      const { data: existing, error: findErr } = await supabaseAdmin
        .from("customers")
        .select("id, full_name")
        .eq("phone_e164", phone_e164)
        .maybeSingle();
      if (findErr) return dbErrorResponse("POST /api/reception/create-booking find customer", findErr);

      if (existing) {
        customer_id = existing.id;
        if (existing.full_name?.trim() !== full_name) {
          await supabaseAdmin.from("customers").update({ full_name }).eq("id", existing.id);
        }
      }
    }

    if (!customer_id) {
      const { data: created, error: createErr } = await supabaseAdmin
        .from("customers")
        .insert({ full_name, phone_e164: phone_e164 || null, is_active: true })
        .select("id")
        .single();
      if (createErr) return dbErrorResponse("POST /api/reception/create-booking create customer", createErr);
      customer_id = created.id;
    }

    const amount = computeExpectedAmountMXN(start_at, end_at);

    const { data: booking, error: insErr } = await supabaseAdmin
      .from("bookings")
      .insert({
        court_id,
        start_at,
        end_at,
        status: "CONFIRMED",
        source: origin,
        kind: "STANDARD",
        payment_status: "UNPAID",
        customer_id,
      })
      .select("id, court_id, start_at, end_at, status, source, customer_id")
      .single();

    if (insErr) {
      const friendly = insErr.message.includes("bookings_no_overlap")
        ? "Ese horario ya está ocupado en esa cancha."
        : undefined;
      return friendly
        ? NextResponse.json({ error: friendly }, { status: 409 })
        : dbErrorResponse("POST /api/reception/create-booking insert booking", insErr, 409);
    }

    return NextResponse.json({ booking: { ...booking, amount } }, { status: 201 });
  } catch (e: any) {
    return dbErrorResponse("POST /api/reception/create-booking", e);
  }
}
