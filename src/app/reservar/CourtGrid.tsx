"use client";

import { isOffPeak, OFF_PEAK_RATE } from "@/lib/pricing-shared";
import { cx, parseISOToLocalTime, type CourtAvailability, type SelectedSlot, type Slot } from "./reservarUtils";

/** Cuadrícula de horarios por cancha. */
export default function CourtGrid({
  availability,
  selected,
  disabled,
  onPick,
}: {
  availability: CourtAvailability[];
  selected: SelectedSlot | null;
  disabled: boolean;
  onPick: (court: CourtAvailability, slot: Slot) => void;
}) {
  const anyOffPeak = availability.some((c) => c.slots.some((s) => isOffPeak(s.start_at)));
  return (
    <>
    {anyOffPeak && (
    <p className="mt-6 flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
        <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: "rgb(4,120,87)" }} />
        Hora valle: ${OFF_PEAK_RATE} la hora
    </p>
    )}
    <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
    {availability.map((c) => (
        <div key={c.court_id} className="overflow-hidden rounded-lg border bg-[var(--surface)] transition-colors duration-200 hover:border-[var(--brand-200)]" style={{ borderColor: "rgba(120,46,21,0.14)" }}>
        {/* Court header */}
        <div
            className="flex items-center gap-3 border-b px-5 py-3.5"
            style={{ borderColor: "rgba(120,46,21,0.10)" }}
        >
            <span
                aria-hidden
                className="h-5 w-1"
                style={{ background: "var(--brand)" }}
            />
            <span className="font-display text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                {c.court_name}
            </span>
        </div>

        {/* Slots grid */}
        <div className="p-4">
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {c.slots.map((s) => {
            const isBooked = !s.available;
            const canStart = s.can_start !== false;
            const isStartDisabled = !canStart && !isBooked;

            const isSelected =
                !!selected &&
                selected.court_id === c.court_id &&
                selected.start_at === s.start_at;

            return (
                <button
                key={`${c.court_id}-${s.start_at}`}
                type="button"
                onClick={() => onPick(c, s)}
                disabled={isBooked || isStartDisabled || disabled}
                className={cx(
                    "rounded-full border px-2 py-2 text-[0.8rem] font-semibold tabular-nums transition-all duration-150",
                    "focus:outline-none focus:ring-2",
                    isBooked
                    ? "cursor-not-allowed border-transparent bg-[var(--surface-2)] line-through opacity-40"
                    : isSelected
                    ? "border-transparent text-white shadow-md ring-2 ring-[var(--brand-200)]"
                    : isStartDisabled
                    ? "cursor-not-allowed border-transparent bg-[var(--surface-2)] opacity-30"
                    : "border-[var(--line)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--brand)] hover:bg-[var(--brand-50)] active:scale-[0.97]"
                )}
                style={
                    isSelected
                    ? { background: "linear-gradient(180deg, #C2643A, #9C4622)" }
                    : undefined
                }
                title={`${parseISOToLocalTime(s.start_at)}\u2013${parseISOToLocalTime(s.end_at)} (30m)${isOffPeak(s.start_at) ? " · hora valle" : ""}`}
                >
                <span className="relative">
                {parseISOToLocalTime(s.start_at)}
                {isOffPeak(s.start_at) && !isBooked && (
                    <span aria-label="hora valle" className="absolute -right-2 -top-0.5 h-1.5 w-1.5 rounded-full" style={{ background: "rgb(4,120,87)" }} />
                )}
                </span>
                </button>
            );
            })}
            </div>
        </div>
        </div>
    ))}
    </div>
    </>
  );
}
