import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabaseServer";
import { registerForEvent } from "@/lib/events";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { dbErrorResponse } from "@/lib/apiError";

// Inscribirse a un torneo o americana (con cuenta).
const BodySchema = z.object({
  event_id: z.string().uuid(),
  partner_name: z.string().trim().max(120).optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit(`event-register:${clientIp(req)}`, 10, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "Demasiadas solicitudes." }, { status: 429 });
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data?.user) return NextResponse.json({ error: "Inicia sesión para inscribirte." }, { status: 401 });
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    const r = await registerForEvent(
      parsed.data.event_id,
      { id: data.user.id, email: data.user.email ?? null },
      parsed.data.partner_name ?? null,
      new URL(req.url).origin
    );
    if (!r.ok) return NextResponse.json({ error: r.message }, { status: 409 });
    return NextResponse.json(r);
  } catch (e) {
    return dbErrorResponse("POST /api/web/events/register", e);
  }
}
