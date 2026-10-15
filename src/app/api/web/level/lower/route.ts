import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabaseServer";
import { lowerLevel } from "@/lib/levels";
import { dbErrorResponse } from "@/lib/apiError";

// Bajar mi nivel a mano (subirlo solo se gana jugando partidos competitivos).
const BodySchema = z.object({ level: z.number().min(0).max(7) });

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data?.user) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Nivel inválido." }, { status: 400 });
    const r = await lowerLevel(data.user.id, parsed.data.level);
    if (!r.ok) return NextResponse.json({ error: r.message }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return dbErrorResponse("POST /api/web/level/lower", e);
  }
}
