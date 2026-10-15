import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@/lib/supabaseServer";
import { cancelBooking } from "@/lib/cancellation";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { dbErrorResponse } from "@/lib/apiError";

// El cliente cancela su reserva: con sesión (desde "Mis reservas") o con la
// liga del correo de confirmación (token), que sirve también a invitados.
const BodySchema = z.union([
  z.object({ booking_id: z.string().uuid() }),
  z.object({ token: z.string().uuid() }),
]);

export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit(`cancel:${clientIp(req)}`, 10, 60_000);
    if (!rl.ok) {
      return NextResponse.json({ error: "Demasiadas solicitudes. Espera unos segundos." }, { status: 429 });
    }

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

    let bookingId: string | null = null;
    if ("token" in parsed.data) {
      const { data, error } = await supabaseAdmin
        .from("bookings")
        .select("id")
        .eq("cancel_token", parsed.data.token)
        .maybeSingle();
      if (error) return dbErrorResponse("POST /api/web/cancel-booking token", error);
      bookingId = data?.id ?? null;
    } else {
      const supabase = await createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return NextResponse.json({ error: "Inicia sesión para cancelar." }, { status: 401 });
      // Solo el dueño de la reserva.
      const { data, error } = await supabaseAdmin
        .from("bookings")
        .select("id")
        .eq("id", parsed.data.booking_id)
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (error) return dbErrorResponse("POST /api/web/cancel-booking owner", error);
      bookingId = data?.id ?? null;
    }

    if (!bookingId) return NextResponse.json({ error: "No encontramos esa reserva." }, { status: 404 });

    const result = await cancelBooking(bookingId, "CUSTOMER");
    if (!result.ok) {
      const status = result.reason === "db_error" ? 500 : result.reason === "not_found" ? 404 : 409;
      return NextResponse.json({ error: result.message, reason: result.reason }, { status });
    }
    return NextResponse.json({ ok: true, refund: result.refund, refunded_mxn: result.refundedMXN, split: !!result.split });
  } catch (e) {
    return dbErrorResponse("POST /api/web/cancel-booking", e);
  }
}
