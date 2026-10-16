import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireReceptionAccess } from "@/lib/guards/reception";
import { loadPricing, saveOffPeak } from "@/lib/pricingSettings";
import { dbErrorResponse } from "@/lib/apiError";

// Horas valle: verlas (recepción) y cambiarlas (solo el dueño).
export async function GET() {
  const gate = await requireReceptionAccess({ asJson: true });
  if (!gate.ok) return gate.res;
  return NextResponse.json({ off_peak: await loadPricing(), can_edit: gate.role === "owner" });
}

const BodySchema = z.object({
  enabled: z.boolean(),
  rate: z.number().positive().max(5000),
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  startHour: z.number().int().min(0).max(23),
  endHour: z.number().int().min(1).max(24),
});

export async function POST(req: Request) {
  const gate = await requireReceptionAccess({ asJson: true });
  if (!gate.ok) return gate.res;
  if (gate.role !== "owner") {
    return NextResponse.json({ error: "Solo el dueño puede cambiar las tarifas." }, { status: 403 });
  }
  try {
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success || parsed.data.endHour <= parsed.data.startHour) {
      return NextResponse.json({ error: "Revisa el horario: el fin debe ser después del inicio." }, { status: 400 });
    }
    const cfg = await saveOffPeak(parsed.data, gate.userId);
    // La portada muestra las tarifas.
    revalidatePath("/inicio");
    return NextResponse.json({ ok: true, off_peak: cfg });
  } catch (e) {
    return dbErrorResponse("POST /api/reception/pricing", e);
  }
}
