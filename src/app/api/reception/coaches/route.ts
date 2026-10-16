import { NextResponse } from "next/server";
import { requireReceptionAccess } from "@/lib/guards/reception";
import { listCoaches, saveCoach } from "@/lib/classes";
import { CoachSchema } from "./schema";
import { dbErrorResponse } from "@/lib/apiError";

// Recepción: entrenadores (lista y alta).
export async function GET() {
  const gate = await requireReceptionAccess({ asJson: true });
  if (!gate.ok) return gate.res;
  try {
    return NextResponse.json({ coaches: await listCoaches(true) });
  } catch (e) {
    return dbErrorResponse("GET /api/reception/coaches", e);
  }
}

export async function POST(req: Request) {
  const gate = await requireReceptionAccess({ asJson: true });
  if (!gate.ok) return gate.res;
  try {
    const parsed = CoachSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Revisa los datos del entrenador." }, { status: 400 });
    const r = await saveCoach(null, { ...parsed.data, bio: parsed.data.bio ?? null, rate_pair: parsed.data.rate_pair ?? null });
    if (!r.ok) return NextResponse.json({ error: r.message }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return dbErrorResponse("POST /api/reception/coaches", e);
  }
}
