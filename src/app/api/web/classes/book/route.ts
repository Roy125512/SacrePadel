import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabaseServer";
import { bookClass, CLASS_DURATIONS } from "@/lib/classes";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { dbErrorResponse } from "@/lib/apiError";

// Reservar una clase con entrenador (con cuenta).
const BodySchema = z.object({
  coach_id: z.string().uuid(),
  start_at: z.string().datetime({ offset: true }),
  minutes: z.number().int().refine((n) => (CLASS_DURATIONS as readonly number[]).includes(n)),
  type: z.enum(["INDIVIDUAL", "PAIR"]),
  pay: z.enum(["ONLINE", "CLUB"]),
});

export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit(`class-book:${clientIp(req)}`, 10, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "Demasiadas solicitudes." }, { status: 429 });
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data?.user) return NextResponse.json({ error: "Inicia sesión para reservar tu clase." }, { status: 401 });
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    const r = await bookClass({
      coachId: parsed.data.coach_id,
      startAt: parsed.data.start_at,
      minutes: parsed.data.minutes,
      type: parsed.data.type,
      pay: parsed.data.pay,
      user: { id: data.user.id, email: data.user.email ?? null },
      origin: new URL(req.url).origin,
    });
    if (!r.ok) return NextResponse.json({ error: r.message }, { status: 409 });
    return NextResponse.json(r);
  } catch (e) {
    return dbErrorResponse("POST /api/web/classes/book", e);
  }
}
