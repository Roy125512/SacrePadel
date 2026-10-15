import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabaseServer";
import { myLevel, setInitialLevel } from "@/lib/levels";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { dbErrorResponse } from "@/lib/apiError";

// Mi nivel (GET) y nivel inicial con el cuestionario (POST, una sola vez).
async function currentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
    return NextResponse.json(await myLevel(user.id));
  } catch (e) {
    return dbErrorResponse("GET /api/web/level", e);
  }
}

const BodySchema = z.object({ answers: z.array(z.number().int().min(0).max(9)).max(10) });

export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit(`level:${clientIp(req)}`, 10, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "Demasiadas solicitudes." }, { status: 429 });
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Responde todas las preguntas." }, { status: 400 });
    const r = await setInitialLevel(user.id, parsed.data.answers);
    if (!r.ok) return NextResponse.json({ error: r.message }, { status: 409 });
    return NextResponse.json({ ok: true, level: r.level });
  } catch (e) {
    return dbErrorResponse("POST /api/web/level", e);
  }
}
