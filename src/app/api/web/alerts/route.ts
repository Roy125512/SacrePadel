import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@/lib/supabaseServer";
import { createAlert } from "@/lib/alerts";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { dbErrorResponse } from "@/lib/apiError";

// "Avísame si se libera": un horario, un partido abierto lleno o un torneo lleno.
const BodySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("SLOT"), start_at: z.string().datetime({ offset: true }), email: z.string().email().max(200).optional() }),
  z.object({ kind: z.literal("MATCH"), token: z.string().uuid() }),
  z.object({ kind: z.literal("EVENT"), event_id: z.string().uuid() }),
]);

export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit(`alerts:${clientIp(req)}`, 10, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "Demasiadas solicitudes." }, { status: 429 });
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Revisa tu correo." }, { status: 400 });
    const b = parsed.data;

    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user ?? null;
    const email = user?.email ?? (b.kind === "SLOT" ? b.email : undefined);
    if (!email) {
      return NextResponse.json(
        { error: b.kind === "SLOT" ? "Escribe tu correo para avisarte." : "Inicia sesión para que te avisemos." },
        { status: 400 }
      );
    }

    let refId: string | null = null;
    if (b.kind === "MATCH") {
      const { data } = await supabaseAdmin.from("bookings").select("id").eq("split_token", b.token).maybeSingle();
      if (!data) return NextResponse.json({ error: "No encontramos este partido." }, { status: 404 });
      refId = data.id;
    } else if (b.kind === "EVENT") refId = b.event_id;

    const r = await createAlert({
      kind: b.kind,
      email,
      userId: user?.id ?? null,
      startAt: b.kind === "SLOT" ? b.start_at : null,
      refId,
    });
    if (!r.ok) return NextResponse.json({ error: r.message }, { status: 409 });
    return NextResponse.json({ ok: true, email });
  } catch (e) {
    return dbErrorResponse("POST /api/web/alerts", e);
  }
}
