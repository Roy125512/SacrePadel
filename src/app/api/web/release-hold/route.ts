import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { dbErrorResponse } from "@/lib/apiError";
import { settleMpHold } from "@/lib/mpBookings";
import { DEMO } from "@/lib/demo/flag";

export async function POST(req: Request) {
  try {
    const rl = await rateLimit(`release-hold:${clientIp(req)}`, 20, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Espera unos segundos e intenta de nuevo." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const booking_id = String(body.booking_id ?? "").trim();

    if (!booking_id) {
      return NextResponse.json({ error: "booking_id es obligatorio." }, { status: 400 });
    }

    // Si ya se abrió el pago en línea, el cliente pudo haber pagado aunque
    // el navegador diga lo contrario (p. ej. cerró el checkout justo
    // después de pagar): nunca se borra sin preguntarle a Mercado Pago.
    const { data: current, error: readErr } = await supabaseAdmin
      .from("bookings")
      .select("id, mp_preference_id")
      .eq("id", booking_id)
      .eq("status", "HOLD")
      .eq("source", "WEB")
      .maybeSingle();

    if (readErr) return dbErrorResponse("POST /api/web/release-hold fetch", readErr);
    if (!current) return NextResponse.json({ ok: true, released: false }, { status: 200 });

    if (current.mp_preference_id && !DEMO) {
      const outcome = await settleMpHold(booking_id);
      return NextResponse.json({ ok: true, released: outcome === "deleted" }, { status: 200 });
    }

    // ✅ Liberar HOLD = BORRARLO (no CANCELLED)
    const { data, error } = await supabaseAdmin
      .from("bookings")
      .delete()
      .eq("id", booking_id)
      .eq("status", "HOLD")
      .eq("source", "WEB")
      .select("id")
      .maybeSingle();

    if (error) return dbErrorResponse("POST /api/web/release-hold", error);

    // Si ya no estaba, no es error
    if (!data) return NextResponse.json({ ok: true, released: false }, { status: 200 });

    return NextResponse.json({ ok: true, released: true }, { status: 200 });
  } catch (e: any) {
    return dbErrorResponse("POST /api/web/release-hold", e);
  }
}
