import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { dbErrorResponse } from "@/lib/apiError";
import { MAX_BOOKING_MINUTES } from "@/lib/config";

// Actualiza el rango de un HOLD (principalmente end_at) y renueva su expiración.
// Si hay conflicto por overlap (exclusion constraint), debe regresar 409.

export async function POST(req: Request) {
  const rl = rateLimit(`update-hold:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Espera unos segundos e intenta de nuevo." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const booking_id = String(body.booking_id ?? "").trim();
  const end_at = String(body.end_at ?? "").trim();

  if (!booking_id || !end_at) {
    return NextResponse.json({ error: "booking_id y end_at son obligatorios." }, { status: 400 });
  }

  // Mismo límite de duración que /api/web/hold — ver comentario ahí.
  const { data: current } = await supabaseAdmin
    .from("bookings")
    .select("start_at")
    .eq("id", booking_id)
    .eq("status", "HOLD")
    .eq("source", "WEB")
    .maybeSingle();

  if (current) {
    const durationMinutes = (new Date(end_at).getTime() - new Date(current.start_at).getTime()) / 60_000;
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0 || durationMinutes > MAX_BOOKING_MINUTES) {
      return NextResponse.json(
        { error: `La duración debe ser de máximo ${MAX_BOOKING_MINUTES} minutos.` },
        { status: 400 }
      );
    }
  }

  const holdMinutes = 10;
  const hold_expires_at = new Date(Date.now() + holdMinutes * 60_000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .update({ end_at, hold_expires_at })
    .eq("id", booking_id)
    .eq("status", "HOLD")
    .eq("source", "WEB")
    .select("id, court_id, start_at, end_at, status, hold_expires_at")
    .single();

  if (error) {
    // Cuando choca por overlap, normalmente llega como error del constraint.
    return dbErrorResponse("POST /api/web/update-hold", error, 409);
  }

  return NextResponse.json({ booking: data }, { status: 200 });
}
