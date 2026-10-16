import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@/lib/supabaseServer";
import { dbErrorResponse } from "@/lib/apiError";

// Aparecer (o no) en el ranking público del club.
const BodySchema = z.object({ visible: z.boolean() });

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data?.user) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    const { error } = await supabaseAdmin.from("profiles").update({ ranking_visible: parsed.data.visible }).eq("id", data.user.id);
    if (error) return dbErrorResponse("POST /api/web/level/visibility", error);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return dbErrorResponse("POST /api/web/level/visibility", e);
  }
}
