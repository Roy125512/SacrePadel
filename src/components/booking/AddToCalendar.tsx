"use client";

import { buildIcs, googleCalendarUrl, type CalendarEvent } from "@/lib/calendar";

/** "Agregar a mi calendario": Google Calendar o archivo .ics (iPhone/Outlook). */
export default function AddToCalendar({ event, className = "" }: { event: CalendarEvent; className?: string }) {
  function downloadIcs() {
    const blob = new Blob([buildIcs(event)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sacre-padel.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${className}`}>
      <span className="opacity-70">Agregar a mi calendario:</span>
      <a href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">
        Google
      </a>
      <button type="button" onClick={downloadIcs} className="font-semibold underline underline-offset-2">
        iPhone / Outlook
      </button>
    </span>
  );
}
