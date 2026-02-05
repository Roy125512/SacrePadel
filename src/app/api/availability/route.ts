import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { BUSINESS_TZ_OFFSET, OPEN_HOUR, CLOSE_HOUR, STEP_MINUTES } from "@/lib/config";
import { buildSlots, fetchActiveCourts, fetchBlockingBookings, overlapsIso, toIsoAt } from "@/lib/availability";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json({ error: "Missing required query param: date (YYYY-MM-DD)" }, { status: 400 });
  }

  const tzOffset = BUSINESS_TZ_OFFSET;
  const rangeStartIso = toIsoAt(date, OPEN_HOUR * 60, tzOffset);
  const rangeEndIso = toIsoAt(date, CLOSE_HOUR * 60, tzOffset);

  try {
    const courts = await fetchActiveCourts(supabaseAdmin);
    const blockers = await fetchBlockingBookings(supabaseAdmin, { rangeStartIso, rangeEndIso });

    const slots = buildSlots(date, OPEN_HOUR, CLOSE_HOUR, STEP_MINUTES, tzOffset);

    const blockersByCourt = new Map<string, typeof blockers>();
    for (const b of blockers) {
      const arr = blockersByCourt.get(b.court_id) ?? [];
      arr.push(b);
      blockersByCourt.set(b.court_id, arr);
    }

    const courtsWithSlots = courts.map((c) => {
      const courtBlockers = blockersByCourt.get(c.id) ?? [];

      const slotsWithStatus = slots.map((s) => {
        let status: "AVAILABLE" | "HOLD" | "TAKEN" = "AVAILABLE";

        for (const b of courtBlockers) {
          if (overlapsIso(s.start_at, s.end_at, b.start_at, b.end_at)) {
            if (b.status === "HOLD") status = "HOLD";
            else {
              status = "TAKEN";
              break;
            }
          }
        }
        return { ...s, status };
      });

      return { court_id: c.id, court_name: c.name, slots: slotsWithStatus };
    });

    return NextResponse.json(
      {
        date,
        slot_minutes: STEP_MINUTES,
        hours: {
          open: `${String(OPEN_HOUR).padStart(2, "0")}:00`,
          close: `${String(CLOSE_HOUR).padStart(2, "0")}:00`,
        },
        timezone_offset: tzOffset,
        bookings_count: blockers.length,
        courts: courtsWithSlots,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unexpected error" }, { status: 500 });
  }
}
