import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { dbErrorResponse } from "@/lib/apiError";

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

    if (error) return dbErrorResponse("POST /api/web/release-hold", error);

    // Si ya no estaba, no es error
    if (!data) return NextResponse.json({ ok: true, released: false }, { status: 200 });

    return NextResponse.json({ ok: true, released: true }, { status: 200 });
  } catch (e: any) {
    return dbErrorResponse("POST /api/web/release-hold", e);
  }
}
