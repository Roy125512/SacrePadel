import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@/lib/supabaseServer";
import { submitResult } from "@/lib/levels";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { dbErrorResponse } from "@/lib/apiError";

// Un jugador captura el resultado de un partido competitivo.
const BodySchema = z.object({
  token: z.string().uuid(),
  partner_id: z.string().uuid(),
  sets: z.array(z.tuple([z.number().int().min(0).max(7), z.number().int().min(0).max(7)])).min(2).max(3),
});

export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit(`match-result:${clientIp(req)}`, 10, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "Demasiadas solicitudes." }, { status: 429 });
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Revisa el marcador y tu pareja." }, { status: 400 });

    const { data: b, error } = await supabaseAdmin
      .from("bookings")
      .select("id")
      .eq("split_token", parsed.data.token)
      .maybeSingle();
    if (error) return dbErrorResponse("POST /api/web/match-result", error);
    if (!b) return NextResponse.json({ error: "No encontramos este partido." }, { status: 404 });

    const r = await submitResult(b.id, auth.user.id, parsed.data.partner_id, parsed.data.sets);
    if (!r.ok) return NextResponse.json({ error: r.message }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return dbErrorResponse("POST /api/web/match-result", e);
  }
}
