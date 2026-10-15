import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireReceptionAccess } from "@/lib/guards/reception";
import { dbErrorResponse } from "@/lib/apiError";
import { cancelBooking } from "@/lib/cancellation";

// Únicas transiciones que recepción puede hacer. Antes se aceptaba cualquier
// estado, así que una llamada directa podía, por ejemplo, "des-cancelar" una
// reserva (encimándola con otra) o regresarla a HOLD.
const BodySchema = z.object({
  booking_id: z.string().uuid(),
  status: z.enum(["CANCELLED", "COMPLETED", "NO_SHOW"]),
});

export async function POST(req: Request) {
  const gate = await requireReceptionAccess({ asJson: true, nextPath: "/reception" });
  if (!gate.ok) return gate.res;

  try {
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "booking_id y status son obligatorios y deben ser válidos." }, { status: 400 });
    }
    const { booking_id, status } = parsed.data;

    const { data: current, error: readErr } = await supabaseAdmin
      .from("bookings")
      .select("id, status, payment_status, payment_method")
      .eq("id", booking_id)
      .maybeSingle();

    if (readErr) return dbErrorResponse("POST /api/reception/set-status fetch booking", readErr);
    if (!current) return NextResponse.json({ error: "Reserva no encontrada." }, { status: 404 });

    const curStatus = current.status as string;
    const paid = (current.payment_status ?? "UNPAID") === "PAID";

    if (status === "CANCELLED") {
      // Pagada en línea: se cancela y Mercado Pago reembolsa automáticamente.
      if (paid && current.payment_method === "MERCADOPAGO") {
        const result = await cancelBooking(booking_id, "RECEPTION");
        if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.reason === "db_error" ? 500 : 409 });
        return NextResponse.json({ ok: true, refund: result.refund, refunded_mxn: result.refundedMXN }, { status: 200 });
      }
      if (paid) {
        return NextResponse.json(
          { error: "Se cobró en recepción: devuelve el dinero al cliente antes de cancelar." },
          { status: 409 }
        );
      }
      if (curStatus === "COMPLETED" || curStatus === "NO_SHOW") {
        return NextResponse.json({ error: "No se puede cancelar después de capturar asistencia." }, { status: 409 });
      }
      if (curStatus === "CANCELLED") {
        return NextResponse.json({ error: "La reserva ya estaba cancelada." }, { status: 409 });
      }
    } else {
      // Asistencia solo desde CONFIRMED.
      if (curStatus !== "CONFIRMED") {
        return NextResponse.json({ error: "Solo puedes marcar asistencia desde Confirmada." }, { status: 409 });
      }
      // Prioridad a cobrar: no permitir marcar "Asistió" si no está pagado.
      // NO_SHOW es la excepción — un cliente que nunca llegó tampoco pagó, y
      // aun así debe poder quedar registrado como no-show (no solo cancelado).
      if (status === "COMPLETED" && !paid) {
        return NextResponse.json({ error: "Primero debes cobrar antes de marcar asistencia." }, { status: 409 });
      }
    }

    // Condicionado al estado leído arriba: si alguien más lo cambió en medio
    // (otra recepcionista, el webhook de pago), no se pisa.
    let update = supabaseAdmin
      .from("bookings")
      .update({
        status,
        cancelled_by: status === "CANCELLED" ? "RECEPTION" : null,
        cancelled_at: status === "CANCELLED" ? new Date().toISOString() : null,
      })
      .eq("id", booking_id)
      .eq("status", curStatus);
    if (status === "CANCELLED") update = update.neq("payment_status", "PAID");

    const { data: updated, error: upErr } = await update.select("id").maybeSingle();

    if (upErr) return dbErrorResponse("POST /api/reception/set-status update", upErr);
    if (!updated) {
      return NextResponse.json(
        { error: "La reserva cambió mientras tanto. Actualiza la pantalla e intenta de nuevo." },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    return dbErrorResponse("POST /api/reception/set-status", e);
  }
}
