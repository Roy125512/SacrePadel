import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BodySchema = z.object({
  booking_id: z.string().uuid(),
  paid_amount: z.number().nonnegative(),
  payment_method: z.enum(["CASH", "CARD", "TRANSFER"]),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { booking_id, paid_amount, payment_method } = parsed.data;

  // 1) Leer reserva (y validar que exista)
  const { data: booking, error: readErr } = await supabaseAdmin
    .from("bookings")
    .select("id,status,payment_status")
    .eq("id", booking_id)
    .single();

  if (readErr || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  // 2) Regla operativa: solo se paga una reserva real (CONFIRMED)
  if (booking.status !== "CONFIRMED") {
    return NextResponse.json(
      { error: "Only CONFIRMED bookings can be marked as paid" },
      { status: 409 }
    );
  }

  // 3) Evitar doble cobro
  if (booking.payment_status === "PAID") {
    return NextResponse.json(
      { error: "Booking is already PAID" },
      { status: 409 }
    );
  }

  // 4) Marcar pago
  const nowIso = new Date().toISOString();

  const { data: updated, error: updErr } = await supabaseAdmin
    .from("bookings")
    .update({
      payment_status: "PAID",
      paid_amount,
      payment_method,
      paid_at: nowIso,
    })
    .eq("id", booking_id)
    .select("id,status,payment_status,paid_amount,payment_method,paid_at")
    .single();

  if (updErr) {
    return NextResponse.json(
      { error: "Could not mark as paid", details: updErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ booking: updated }, { status: 200 });
}
