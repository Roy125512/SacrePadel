"use client";

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
  return (
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
                    "rounded-lg border px-2 py-2.5 text-xs font-medium transition-all duration-150",
                    "focus:outline-none focus:ring-2",
                    isBooked
                    ? "cursor-not-allowed border-transparent bg-[var(--surface-2)] line-through opacity-40"
                    : isSelected
                    ? "border-[var(--brand-600)] text-white shadow-md ring-2 ring-[var(--brand-200)]"
                    : isStartDisabled
                    ? "cursor-not-allowed border-transparent bg-[var(--surface-2)] opacity-30"
                    : "border-[rgba(120,46,21,0.10)] bg-white hover:border-[var(--brand-200)] hover:bg-[var(--brand-50)] hover:shadow-sm active:scale-[0.97]"
                )}
                style={
                    isSelected
                    ? { background: "linear-gradient(135deg, var(--brand-highlight), var(--brand))" }
                    : undefined
                }
                title={`${parseISOToLocalTime(s.start_at)}\u2013${parseISOToLocalTime(s.end_at)} (30m)`}
                >
                {parseISOToLocalTime(s.start_at)}
                </button>
            );
            })}
            </div>
        </div>
        </div>
    ))}
    </div>
  );
}
