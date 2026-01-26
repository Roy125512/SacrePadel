import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const TZ = "-06:00";
const OPEN_HOUR = 7;
const CLOSE_HOUR = 22;

const STEP_MIN = 30;        // slots cada 30 min
const MIN_BOOKING_MIN = 60; // mínimo 60 min

function toIso(dateYMD: string, totalMinutes: number) {
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${dateYMD}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00${TZ}`;
}

// Overlap semi-abierto: [start, end)
function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  const as = new Date(aStart).getTime();
  const ae = new Date(aEnd).getTime();
  const bs = new Date(bStart).getTime();
  const be = new Date(bEnd).getTime();
  return as < be && ae > bs;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = (searchParams.get("date") || "").trim(); // YYYY-MM-DD

  if (!date) {
    return NextResponse.json({ error: "date (YYYY-MM-DD) is required" }, { status: 400 });
  }

  const dayStartIso = `${date}T00:00:00${TZ}`;
  const dayEndIso = `${date}T23:59:59${TZ}`;

  // Courts activas
  const { data: courts, error: cErr } = await supabaseAdmin
    .from("courts")
    .select("id, name, is_active")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

  // ✅ IMPORTANTE: traer bookings que SE CRUCEN con el día, no solo los que "empiezan" en el día
  const { data: bookings, error: bErr } = await supabaseAdmin
    .from("bookings")
    .select("id, court_id, start_at, end_at, status, hold_expires_at")
    .in("status", ["HOLD", "CONFIRMED", "COMPLETED", "NO_SHOW"])
    .lt("start_at", dayEndIso)   // start < fin del día
    .gt("end_at", dayStartIso)   // end > inicio del día
    .order("start_at", { ascending: true });

  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });

  // Blockers:
  // - HOLD solo si no expiró
  // - CONFIRMED/COMPLETED/NO_SHOW siempre bloquean
  const nowMs = Date.now();
  const blockers = (bookings ?? []).filter((b: any) => {
    if (b.status === "HOLD") {
      if (!b.hold_expires_at) return true;
      return new Date(b.hold_expires_at).getTime() > nowMs;
    }
    return true;
  });

  // Slots cada 30 min (07:00–22:00) -> último bloque 21:30–22:00
  const slots: { start_at: string; end_at: string }[] = [];
  for (let startMin = OPEN_HOUR * 60; startMin + STEP_MIN <= CLOSE_HOUR * 60; startMin += STEP_MIN) {
    slots.push({
      start_at: toIso(date, startMin),
      end_at: toIso(date, startMin + STEP_MIN),
    });
  }

  const stepMs = STEP_MIN * 60_000;
  const minMs = MIN_BOOKING_MIN * 60_000;
  const closeMs = new Date(toIso(date, CLOSE_HOUR * 60)).getTime(); // 22:00 -06:00

  const availability = (courts ?? []).map((court: any) => {
    const courtBookings = blockers.filter((b: any) => b.court_id === court.id);

    // 1) available = bloque libre real (esto sirve para continuidad y para permitir 90/120/etc)
    const base = slots.map((s) => {
      const blocked = courtBookings.some((b: any) => overlaps(s.start_at, s.end_at, b.start_at, b.end_at));
      return { ...s, available: !blocked };
    });

    // Map por timestamp (ms) -> libre?
    const freeByStartMs = new Map<number, boolean>();
    for (const x of base) freeByStartMs.set(new Date(x.start_at).getTime(), x.available);

    // 2) can_start = desde aquí sí se puede iniciar (mínimo 60 y sin pasar de cierre)
    const courtSlots = base.map((s) => {
      const startMs = new Date(s.start_at).getTime();
      const minEndMs = startMs + minMs;

      let can_start = true;

      if (!s.available) can_start = false;        // ocupado
      else if (minEndMs > closeMs) can_start = false; // ej 21:30 ya no cabe 60

      if (can_start) {
        // Verificar que los bloques del mínimo (60) estén libres
        for (let t = startMs; t < minEndMs; t += stepMs) {
          if (!freeByStartMs.get(t)) {
            can_start = false;
            break;
          }
        }
      }

      return { ...s, can_start };
    });

    return {
      court_id: court.id,
      court_name: court.name,
      slots: courtSlots,
    };
  });

  return NextResponse.json(
    {
      date,
      timezone_offset: TZ,
      step_minutes: STEP_MIN,
      open_hour: OPEN_HOUR,
      close_hour: CLOSE_HOUR,
      availability,
    },
    { status: 200 }
  );
}
