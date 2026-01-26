import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Actualiza el rango de un HOLD (principalmente end_at) y renueva su expiración.
// Si hay conflicto por overlap (exclusion constraint), debe regresar 409.

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const booking_id = String(body.booking_id ?? "").trim();
  const end_at = String(body.end_at ?? "").trim();

  if (!booking_id || !end_at) {
    return NextResponse.json({ error: "booking_id and end_at are required" }, { status: 400 });
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
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  return NextResponse.json({ booking: data }, { status: 200 });
}
