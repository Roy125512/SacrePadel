import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@/lib/supabaseServer";
import { reviewResult } from "@/lib/levels";
import { dbErrorResponse } from "@/lib/apiError";

// La pareja contraria confirma (y se ajustan los niveles) o rechaza el resultado.
const BodySchema = z.object({ token: z.string().uuid(), accept: z.boolean() });

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

    const { data: b, error } = await supabaseAdmin
      .from("bookings")
      .select("id")
      .eq("split_token", parsed.data.token)
      .maybeSingle();
    if (error) return dbErrorResponse("POST /api/web/match-result/review", error);
    if (!b) return NextResponse.json({ error: "No encontramos este partido." }, { status: 404 });

    const r = await reviewResult(b.id, auth.user.id, parsed.data.accept);
    if (!r.ok) return NextResponse.json({ error: r.message }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return dbErrorResponse("POST /api/web/match-result/review", e);
  }
}
