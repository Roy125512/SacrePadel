import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@/lib/supabaseServer";
import { leaveMatch } from "@/lib/openMatches";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { dbErrorResponse } from "@/lib/apiError";

// Un jugador se sale de un partido abierto al que se unió (con reembolso).
const BodySchema = z.object({ token: z.string().uuid() });

export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit(`split-leave:${clientIp(req)}`, 10, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "Demasiadas solicitudes. Espera unos segundos." }, { status: 429 });

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

    const { data: b, error } = await supabaseAdmin
      .from("bookings")
      .select("id")
      .eq("split_token", parsed.data.token)
      .maybeSingle();
    if (error) return dbErrorResponse("POST /api/web/split/leave", error);
    if (!b) return NextResponse.json({ error: "No encontramos este partido." }, { status: 404 });

    const r = await leaveMatch(b.id, auth.user.id);
    if (!r.ok) return NextResponse.json({ error: r.message }, { status: 409 });
    return NextResponse.json({ ok: true, refunded_mxn: r.refundedMXN });
  } catch (e) {
    return dbErrorResponse("POST /api/web/split/leave", e);
  }
}
