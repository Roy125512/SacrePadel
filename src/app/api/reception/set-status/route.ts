import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireReceptionAccess } from "@/lib/guards/reception";


export async function POST(req: Request) {
  const gate = await requireReceptionAccess({ asJson: true, nextPath: "/reception" });
  if (!gate.ok) return gate.res;

  try {
    const body = await req.json();
    const booking_id = body?.booking_id as string | undefined;
    const status = body?.status as string | undefined;

    const { data: current, error: readErr } = await supabaseAdmin
      .from("bookings")
      .select("id, status, payment_status")
      .eq("id", booking_id)
      .single();

    if (readErr) {
      return NextResponse.json({ error: readErr.message }, { status: 500 });
    }

    const curStatus = current.status as string;
    const paid = (current.payment_status ?? "UNPAID") === "PAID";

    // No permitir cancelar si está pagado
    if (status === "CANCELLED" && paid) {
      return NextResponse.json({ error: "No se puede cancelar una reserva pagada." }, { status: 409 });
    }

    // No permitir cambios de estado si ya se capturó asistencia
    if ((curStatus === "COMPLETED" || curStatus === "NO_SHOW") && status === "CANCELLED") {
      return NextResponse.json({ error: "No se puede cancelar después de capturar asistencia." }, { status: 409 });
    }

    // Prioridad a cobrar: no permitir marcar asistencia si no está pagado
    if ((status === "COMPLETED" || status === "NO_SHOW") && !paid) {
      return NextResponse.json({ error: "Primero debes cobrar antes de marcar asistencia." }, { status: 409 });
    }

    // Asistencia solo desde CONFIRMED
    if ((status === "COMPLETED" || status === "NO_SHOW") && curStatus !== "CONFIRMED") {
      return NextResponse.json({ error: "Solo puedes marcar asistencia desde Confirmada." }, { status: 409 });
    }


    if (!booking_id || !status) {
      return NextResponse.json({ error: "booking_id and status are required" }, { status: 400 });
    }

    const patch: Record<string, any> = { status };

    if (status === "CANCELLED") {
      patch.cancelled_by = "RECEPTION";
    } else {
      patch.cancelled_by = null;
    }

    // Intento con cancelled_by
    let res = await supabaseAdmin.from("bookings").update(patch).eq("id", booking_id);

    // Fallback si cancelled_by no existe
    if (res.error && String(res.error.message).toLowerCase().includes("cancelled_by")) {
      res = await supabaseAdmin.from("bookings").update({ status }).eq("id", booking_id);
    }

    if (res.error) {
      return NextResponse.json({ error: res.error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
