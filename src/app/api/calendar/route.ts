import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildIcs } from "@/lib/calendar";
import { SITE } from "@/lib/site";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Archivo .ics de una reserva o partido, para la liga del correo. Se busca
// por la liga de cancelación (quien reservó) o la del partido/pago dividido.
export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get("t") ?? "";
  if (!UUID.test(t)) return NextResponse.json({ error: "Liga inválida." }, { status: 400 });

  const select = "id, start_at, end_at, status, is_open_match, split_token, courts ( name )";
  let { data: b } = await supabaseAdmin.from("bookings").select(select).eq("cancel_token", t).maybeSingle();
  if (!b) ({ data: b } = await supabaseAdmin.from("bookings").select(select).eq("split_token", t).maybeSingle());
  if (!b || b.status === "CANCELLED") return NextResponse.json({ error: "No encontramos esta reserva." }, { status: 404 });

  const court = (b.courts as { name: string } | null)?.name ?? "Cancha";
  const ics = buildIcs({
    uid: `${b.id}@sacrepadel.com`,
    title: `${b.is_open_match ? "Partido" : "Pádel"} · ${court} — Sacré Pádel`,
    start: b.start_at,
    end: b.end_at,
    details: b.split_token ? `${SITE.url}/reserva/pagar?t=${b.split_token}` : SITE.url,
  });
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="sacre-padel.ics"',
      "Cache-Control": "no-store",
    },
  });
}
