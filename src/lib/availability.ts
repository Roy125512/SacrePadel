import type { SupabaseClient } from "@supabase/supabase-js";

export type CourtRow = { id: string; name: string };

export type BookingRow = {
  id: string;
  court_id: string;
  start_at: string;
  end_at: string;
  status: "HOLD" | "CONFIRMED" | "COMPLETED" | "NO_SHOW" | string;
  hold_expires_at?: string | null;
};

export type Slot = { start_at: string; end_at: string };

// ISO at business offset, given date and minutes since 00:00.
export function toIsoAt(dateYMD: string, totalMinutes: number, tzOffset: string) {
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${dateYMD}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00${tzOffset}`;
}

// Overlap semi-open: [start, end)
export function overlapsIso(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  const as = new Date(aStart).getTime();
  const ae = new Date(aEnd).getTime();
  const bs = new Date(bStart).getTime();
  const be = new Date(bEnd).getTime();
  return as < be && ae > bs;
}

export function buildSlots(
  dateYMD: string,
  openHour: number,
  closeHour: number,
  stepMinutes: number,
  tzOffset: string
): Slot[] {
  const slots: Slot[] = [];
  for (let startMin = openHour * 60; startMin + stepMinutes <= closeHour * 60; startMin += stepMinutes) {
    slots.push({
      start_at: toIsoAt(dateYMD, startMin, tzOffset),
      end_at: toIsoAt(dateYMD, startMin + stepMinutes, tzOffset),
    });
  }
  return slots;
}

export async function fetchActiveCourts(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("courts")
    .select("id,name")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as CourtRow[];
}

export async function fetchBlockingBookings(
  supabase: SupabaseClient,
  args: { rangeStartIso: string; rangeEndIso: string; nowMs?: number }
) {
  const nowMs = args.nowMs ?? Date.now();

  const { data, error } = await supabase
    .from("bookings")
    .select("id,court_id,start_at,end_at,status,hold_expires_at")
    .in("status", ["HOLD", "CONFIRMED", "COMPLETED", "NO_SHOW"])
    // overlap: start < endRange && end > startRange
    .lt("start_at", args.rangeEndIso)
    .gt("end_at", args.rangeStartIso)
    .order("start_at", { ascending: true });

  if (error) throw new Error(error.message);

  // HOLD solo bloquea si no expiró
  const blockers = (data ?? []).filter((b: any) => {
    if (b.status === "HOLD") {
      if (!b.hold_expires_at) return true;
      return new Date(b.hold_expires_at).getTime() > nowMs;
    }
    return true;
  });

  return blockers as BookingRow[];
}
