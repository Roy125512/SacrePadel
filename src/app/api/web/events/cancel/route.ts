import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabaseServer";
import { cancelMyRegistration } from "@/lib/events";
import { dbErrorResponse } from "@/lib/apiError";

// Cancelar mi inscripción (hasta 24 h antes, con reembolso).
const BodySchema = z.object({ event_id: z.string().uuid() });

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data?.user) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    const r = await cancelMyRegistration(parsed.data.event_id, data.user.id);
    if (!r.ok) return NextResponse.json({ error: r.message }, { status: 409 });
    return NextResponse.json({ ok: true, refunded_mxn: r.refundedMXN });
  } catch (e) {
    return dbErrorResponse("POST /api/web/events/cancel", e);
  }
}
