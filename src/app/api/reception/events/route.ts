import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireReceptionAccess } from "@/lib/guards/reception";
import { activeRegistrations, createEvent } from "@/lib/events";
import { dbErrorResponse } from "@/lib/apiError";

// Recepción: lista de eventos (con inscritos) y crear evento.
export async function GET() {
  const gate = await requireReceptionAccess({ asJson: true });
  if (!gate.ok) return gate.res;
  try {
    const { data, error } = await supabaseAdmin
      .from("events")
      .select("id, title, kind, starts_at, ends_at, court_ids, entry, capacity, price, level_min, level_max, gender, status, rounds")
      .gte("ends_at", new Date(Date.now() - 60 * 86400_000).toISOString())
      .order("starts_at", { ascending: true })
      .limit(100);
    if (error) return dbErrorResponse("GET /api/reception/events", error);
    const events = [];
    for (const e of data ?? []) {
      const regs = await activeRegistrations(e.id);
      events.push({ ...e, price: Number(e.price), registrations: regs });
    }
    return NextResponse.json({ events });
  } catch (e) {
    return dbErrorResponse("GET /api/reception/events", e);
  }
}

const BodySchema = z.object({
  title: z.string().trim().min(3).max(120),
  kind: z.enum(["AMERICANA", "TORNEO", "SOCIAL"]),
  description: z.string().trim().max(2000).optional().nullable(),
  starts_at: z.string().datetime({ offset: true }),
  ends_at: z.string().datetime({ offset: true }),
  court_ids: z.array(z.string().min(1)).min(1).max(8),
  entry: z.enum(["INDIVIDUAL", "PAIR"]),
  capacity: z.number().int().min(2).max(64),
  price: z.number().min(0).max(20000),
  level_min: z.number().int().min(1).max(6).optional().nullable(),
  level_max: z.number().int().min(1).max(6).optional().nullable(),
  gender: z.enum(["ANY", "MALE", "FEMALE"]).optional(),
});

export async function POST(req: Request) {
  const gate = await requireReceptionAccess({ asJson: true });
  if (!gate.ok) return gate.res;
  try {
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Revisa los datos del evento." }, { status: 400 });
    const { data: prof } = await supabaseAdmin.from("profiles").select("full_name").eq("id", gate.userId).maybeSingle();
    const r = await createEvent(parsed.data, gate.userId, prof?.full_name ?? null);
    if (!r.ok) return NextResponse.json({ error: r.message }, { status: 409 });
    return NextResponse.json({ ok: true, id: r.id });
  } catch (e) {
    return dbErrorResponse("POST /api/reception/events", e);
  }
}
