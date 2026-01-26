import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function friendlyOverlap(msg: string) {
  return msg.includes("bookings_no_overlap")
    ? "Ese horario ya fue tomado. Da clic en “Ver disponibilidad” y elige otro horario."
    : msg;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const court_id = String(body.court_id ?? "").trim();
    const start_at = String(body.start_at ?? "").trim();
    const end_at = String(body.end_at ?? "").trim();

    if (!court_id || !start_at || !end_at) {
      return NextResponse.json(
        { error: "court_id, start_at, end_at are required" },
        { status: 400 }
      );
    }

    const holdMinutes = 10;
    const hold_expires_at = new Date(Date.now() + holdMinutes * 60_000).toISOString();

    // ✅ Limpieza: borrar HOLDS expirados para que no sigan bloqueando el overlap
    const nowIso = new Date().toISOString();
    const { error: cleanErr } = await supabaseAdmin
      .from("bookings")
      .delete()
      .eq("status", "HOLD")
      .eq("source", "WEB")
      .lt("hold_expires_at", nowIso);

    if (cleanErr) {
      return NextResponse.json({ error: cleanErr.message }, { status: 500 });
    }

    const { data, error } = await supabaseAdmin
      .from("bookings")
      .insert({
        court_id,
        start_at,
        end_at,
        status: "HOLD",
        source: "WEB",
        kind: "STANDARD",
        hold_expires_at,
      })
      .select("id, court_id, start_at, end_at, status, hold_expires_at")
      .single();

    if (error) {
      return NextResponse.json({ error: friendlyOverlap(error.message) }, { status: 409 });
    }

    return NextResponse.json({ booking: data }, { status: 201 });
  } catch (e: any) {
    console.error("WEB HOLD 500:", e);
    return NextResponse.json({ error: e?.message ?? "Internal error" }, { status: 500 });
  }
}
