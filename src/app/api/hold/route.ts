import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BodySchema = z.object({
  court_id: z.string().uuid(),
  start_at: z.string(), // ISO with offset, e.g. 2026-01-06T10:00:00-06:00
  end_at: z.string(),   // ISO with offset
  source: z.enum(["WEB", "WHATSAPP", "RECEPTION"]).default("WEB"),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { court_id, start_at, end_at, source } = parsed.data;

  // Validación básica de tiempos
  const start = new Date(start_at);
  const end = new Date(end_at);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: "Invalid ISO timestamps" }, { status: 400 });
  }
  if (end <= start) {
    return NextResponse.json({ error: "end_at must be after start_at" }, { status: 400 });
  }

  // Expira en 10 minutos (ajustable)
  const holdExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // Intentar insertar HOLD.
  // Si choca con otro booking (exclusion constraint), Postgres/Supabase devuelve error.
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .insert({
      court_id,
      start_at,
      end_at,
      status: "HOLD",
      hold_expires_at: holdExpiresAt,
      source,
      kind: "STANDARD",
    })
    .select("id,court_id,start_at,end_at,status,hold_expires_at")
    .single();

  if (error) {
    // Cuando hay choque de horario por constraint, normalmente es un 409 (conflict)
    // No dependemos del texto exacto; solo devolvemos 409 cuando falla la inserción.
    return NextResponse.json(
      { error: "Time slot not available", details: error.message },
      { status: 409 }
    );
  }

  return NextResponse.json({ hold: data }, { status: 201 });
}
