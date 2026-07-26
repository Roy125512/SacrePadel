import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireReceptionAccess } from "@/lib/guards/reception";
import { dbErrorResponse } from "@/lib/apiError";

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
      return dbErrorResponse("POST /api/reception/set-status fetch booking", readErr);
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

    // Prioridad a cobrar: no permitir marcar "Asistió" si no está pagado.
    // NO_SHOW es la excepción — un cliente que nunca llegó tampoco pagó, y
    // aun así debe poder quedar registrado como no-show (no solo cancelado).
    if (status === "COMPLETED" && !paid) {
      return NextResponse.json({ error: "Primero debes cobrar antes de marcar asistencia." }, { status: 409 });
    }

    // Asistencia solo desde CONFIRMED
    if ((status === "COMPLETED" || status === "NO_SHOW") && curStatus !== "CONFIRMED") {
      return NextResponse.json({ error: "Solo puedes marcar asistencia desde Confirmada." }, { status: 409 });
    }


    if (!booking_id || !status) {
      return NextResponse.json({ error: "booking_id y status son obligatorios." }, { status: 400 });
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
      return dbErrorResponse("POST /api/reception/set-status update", res.error);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return dbErrorResponse("POST /api/reception/set-status", e);
  }
}
