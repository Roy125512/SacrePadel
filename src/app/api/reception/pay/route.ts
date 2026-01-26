import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireReceptionAccess } from "@/lib/guards/reception";


const BodySchema = z.object({
  booking_id: z.string().uuid(),
  paid_amount: z.number().positive(),
  payment_method: z.enum(["CASH", "CARD", "TRANSFER"]),
});

export async function POST(req: Request) {
  const gate = await requireReceptionAccess({ asJson: true, nextPath: "/reception" });
  if (!gate.ok) return gate.res;

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { booking_id, paid_amount, payment_method } = parsed.data;
  const nowIso = new Date().toISOString();

  // ✅ UPDATE atómico: solo cobra si está CONFIRMED/COMPLETED + UNPAID
  const { data: updated, error: updErr } = await supabaseAdmin
    .from("bookings")
    .update({
      payment_status: "PAID",
      paid_amount,
      payment_method,
      paid_at: nowIso,
    })
    .eq("id", booking_id)
    .in("status", ["CONFIRMED", "COMPLETED"])
    .eq("payment_status", "UNPAID")
    .select(
      "id,status,payment_status,paid_amount,payment_method,paid_at,start_at,end_at,court_id"
    )
    .maybeSingle();

  if (updErr) {
    return NextResponse.json(
      { error: "Could not register payment", details: updErr.message },
      { status: 500 }
    );
  }

  // Si no actualizó, puede ser: no existe, ya pagado, o no confirmado
  if (!updated) {
    // Leemos el booking para dar un error más claro a la UI
    const { data: booking, error: readErr } = await supabaseAdmin
      .from("bookings")
      .select("id,status,payment_status,paid_amount,payment_method,paid_at")
      .eq("id", booking_id)
      .maybeSingle();

    if (readErr || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.payment_status === "PAID") {
      return NextResponse.json(
        { error: "Booking already paid", booking },
        { status: 409 }
      );
    }

    if (booking.status !== "CONFIRMED" && booking.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Only CONFIRMED/COMPLETED bookings can be paid", booking },
        { status: 409 }
      );
    }

    // fallback (raro)
    return NextResponse.json(
      { error: "Payment could not be applied", booking },
      { status: 409 }
    );
  }

  return NextResponse.json({ booking: updated }, { status: 200 });
}

