import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { BUSINESS_TZ_OFFSET, OPEN_HOUR, CLOSE_HOUR, STEP_MINUTES, MIN_BOOKING_MINUTES } from "@/lib/config";
import { buildSlots, fetchActiveCourts, fetchBlockingBookings, overlapsIso, toIsoAt } from "@/lib/availability";
import { dbErrorResponse } from "@/lib/apiError";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = (searchParams.get("date") || "").trim();

  if (!date) return NextResponse.json({ error: "date (YYYY-MM-DD) es obligatorio." }, { status: 400 });

  const tzOffset = BUSINESS_TZ_OFFSET;

  const rangeStartIso = toIsoAt(date, OPEN_HOUR * 60, tzOffset);
  const rangeEndIso = toIsoAt(date, CLOSE_HOUR * 60, tzOffset);

  try {
    const courts = await fetchActiveCourts(supabaseAdmin);
    const blockers = await fetchBlockingBookings(supabaseAdmin, { rangeStartIso, rangeEndIso });

    const slots = buildSlots(date, OPEN_HOUR, CLOSE_HOUR, STEP_MINUTES, tzOffset);

    const stepMs = STEP_MINUTES * 60_000;
    const minMs = MIN_BOOKING_MINUTES * 60_000;
    const closeMs = new Date(toIsoAt(date, CLOSE_HOUR * 60, tzOffset)).getTime();

    const availability = courts.map((court) => {
      const courtBookings = blockers.filter((b) => b.court_id === court.id);

      const base = slots.map((s) => {
        const blocked = courtBookings.some((b) => overlapsIso(s.start_at, s.end_at, b.start_at, b.end_at));
        return { ...s, available: !blocked };
      });

      const freeByStartMs = new Map<number, boolean>();
      for (const x of base) freeByStartMs.set(new Date(x.start_at).getTime(), x.available);

      const courtSlots = base.map((s) => {
        const startMs = new Date(s.start_at).getTime();
        const minEndMs = startMs + minMs;

        let can_start = true;
        if (!s.available) can_start = false;
        else if (minEndMs > closeMs) can_start = false;

        if (can_start) {
          for (let t = startMs; t < minEndMs; t += stepMs) {
            if (!freeByStartMs.get(t)) {
              can_start = false;
              break;
            }
          }
        }

        return { ...s, can_start };
      });

      return { court_id: court.id, court_name: court.name, slots: courtSlots };
    });

    return NextResponse.json(
      {
        date,
        timezone_offset: tzOffset,
        step_minutes: STEP_MINUTES,
        open_hour: OPEN_HOUR,
        close_hour: CLOSE_HOUR,
        availability,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return dbErrorResponse("GET /api/web/availability", e);
  }
}
