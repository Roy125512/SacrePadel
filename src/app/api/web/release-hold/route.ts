import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const booking_id = String(body.booking_id ?? "").trim();

    if (!booking_id) {
      return NextResponse.json({ error: "booking_id es obligatorio." }, { status: 400 });
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

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Si ya no estaba, no es error
    if (!data) return NextResponse.json({ ok: true, released: false }, { status: 200 });

    // Log evento (opcional) - best effort
    try {
      await supabaseAdmin.from("booking_events").insert({
        booking_id,
        event_type: "WEB_HOLD_RELEASED",
        payload: {},
      });
    } catch (e) {
      console.warn("Falló el insert en booking_events (ignorado):", e);
    }

    return NextResponse.json({ ok: true, released: true }, { status: 200 });
  } catch (e: any) {
    console.error("release-hold error:", e);
    return NextResponse.json({ error: e?.message ?? "Error interno" }, { status: 500 });
  }
}
