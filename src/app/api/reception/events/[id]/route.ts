import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReceptionAccess } from "@/lib/guards/reception";
import { cancelEvent, generateEventRounds, saveEventScore, setEventStatus } from "@/lib/events";
import { dbErrorResponse } from "@/lib/apiError";

// Recepción: acciones sobre un evento.
const BodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cancel") }),
  z.object({ action: z.literal("status"), status: z.enum(["OPEN", "CLOSED", "FINISHED"]) }),
  z.object({ action: z.literal("rounds"), rounds: z.number().int().min(1).max(12) }),
  z.object({
    action: z.literal("score"),
    round: z.number().int().min(1),
    court: z.number().int().min(0),
    score_a: z.number().int().min(0).max(99).nullable(),
    score_b: z.number().int().min(0).max(99).nullable(),
  }),
]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireReceptionAccess({ asJson: true });
  if (!gate.ok) return gate.res;
  try {
    const { id } = await params;
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    const b = parsed.data;
    const r =
      b.action === "cancel"
        ? await cancelEvent(id)
        : b.action === "status"
          ? await setEventStatus(id, b.status)
          : b.action === "rounds"
            ? await generateEventRounds(id, b.rounds)
            : await saveEventScore(id, b.round, b.court, b.score_a, b.score_b);
    if (!r.ok) return NextResponse.json({ error: r.message }, { status: 409 });
    return NextResponse.json(r);
  } catch (e) {
    return dbErrorResponse("POST /api/reception/events/[id]", e);
  }
}
