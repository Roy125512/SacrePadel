import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";


function buildIsoWithOffset(date: string, hhmm: string, offset: string) {
  // date: "YYYY-MM-DD", hhmm: "07:30", offset: "-06:00"
  return `${date}T${hhmm}:00${offset}`;
}

function addMinutesHHMM(hhmm: string, minutesToAdd: number) {
  const [hStr, mStr] = hhmm.split(":");
  const total = Number(hStr) * 60 + Number(mStr) + minutesToAdd;
  const h = Math.floor(total / 60);
  const m = total % 60;
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return `${hh}:${mm}`;
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  // Cruce tipo [): aStart < bEnd && bStart < aEnd
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json(
      { error: "Missing required query param: date (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  const { data: courts, error } = await supabaseAdmin
    .from("courts")
    .select("id,name")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const TZ_OFFSET = "-06:00"; // México centro (por ahora fijo)
  const OPEN = "07:00";
  const CLOSE = "22:00";
  const SLOT_MINUTES = 30;

  // 1) Generar slots del día como ISO
  const slots: { start_at: string; end_at: string }[] = [];
  for (let t = OPEN; t < CLOSE; t = addMinutesHHMM(t, SLOT_MINUTES)) {
    const startHHMM = t;
    const endHHMM = addMinutesHHMM(t, SLOT_MINUTES);

    slots.push({
      start_at: buildIsoWithOffset(date, startHHMM, TZ_OFFSET),
      end_at: buildIsoWithOffset(date, endHHMM, TZ_OFFSET),
    });
  }

  // 2) Traer reservas que bloquean este día (CONFIRMED + HOLD no expirado)
  const dayStartIso = `${date}T07:00:00-06:00`;
  const dayEndIso = `${date}T22:00:00-06:00`;
  const nowIso = new Date().toISOString();

  const { data: bookings, error: bookingsErr } = await supabaseAdmin
    .from("bookings")
    .select("id,court_id,start_at,end_at,status,hold_expires_at")
    .gte("start_at", dayStartIso)
    .lt("start_at", dayEndIso)
    .or(`status.eq.CONFIRMED,and(status.eq.HOLD,hold_expires_at.gt.${nowIso})`);

  if (bookingsErr) {
    return NextResponse.json({ error: bookingsErr.message }, { status: 500 });
  }

  // 3) Agrupar reservas por cancha
  const bookingsByCourt = new Map<string, typeof bookings>();
  for (const b of bookings ?? []) {
    const arr = bookingsByCourt.get(b.court_id) ?? [];
    arr.push(b);
    bookingsByCourt.set(b.court_id, arr);
  }

  // 4) Marcar status por slot
  const courtsWithSlots = (courts ?? []).map((c) => {
    const blockers = bookingsByCourt.get(c.id) ?? [];

    const slotsWithStatus = slots.map((s) => {
      let status: "AVAILABLE" | "HOLD" | "TAKEN" = "AVAILABLE";

      for (const b of blockers) {
        if (overlaps(s.start_at, s.end_at, b.start_at, b.end_at)) {
          if (b.status === "CONFIRMED") {
            status = "TAKEN";
            break;
          } else {
            status = "HOLD";
          }
        }
      }

      return { ...s, status };
    });

    return {
      court_id: c.id,
      court_name: c.name,
      slots: slotsWithStatus,
    };
  });

  return NextResponse.json(
    {
      date,
      slot_minutes: SLOT_MINUTES,
      hours: { open: OPEN, close: CLOSE },
      timezone_offset: TZ_OFFSET,
      bookings_count: (bookings ?? []).length,
      courts: courtsWithSlots,
    },
    { status: 200 }
  );
}
