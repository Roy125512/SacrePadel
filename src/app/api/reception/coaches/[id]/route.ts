import { NextResponse } from "next/server";
import { requireReceptionAccess } from "@/lib/guards/reception";
import { saveCoach } from "@/lib/classes";
import { CoachSchema } from "../schema";
import { dbErrorResponse } from "@/lib/apiError";

// Recepción: editar un entrenador.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireReceptionAccess({ asJson: true });
  if (!gate.ok) return gate.res;
  try {
    const { id } = await params;
    const parsed = CoachSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Revisa los datos del entrenador." }, { status: 400 });
    const r = await saveCoach(id, { ...parsed.data, bio: parsed.data.bio ?? null, rate_pair: parsed.data.rate_pair ?? null });
    if (!r.ok) return NextResponse.json({ error: r.message }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return dbErrorResponse("POST /api/reception/coaches/[id]", e);
  }
}
