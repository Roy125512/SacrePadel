// "Agregar a mi calendario": liga de Google Calendar y archivo .ics (Apple,
// Outlook y casi cualquier calendario). Funciones puras, sirven en ambos lados.
import { SITE } from "@/lib/site";

export type CalendarEvent = { title: string; start: string; end: string; details?: string; uid?: string };

export const CLUB_LOCATION = `${SITE.name}, ${SITE.address.street}, ${SITE.address.city}, ${SITE.address.region}`;

/** 2026-10-16T19:00:00-06:00 → 20261017T010000Z */
const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function googleCalendarUrl(e: CalendarEvent) {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${stamp(e.start)}/${stamp(e.end)}`,
    location: CLUB_LOCATION,
    details: e.details ?? "",
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

export function buildIcs(e: CalendarEvent) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sacre Padel//Reservas//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid ?? `${stamp(e.start)}@sacrepadel.com`}`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(e.start)}`,
    `DTEND:${stamp(e.end)}`,
    `SUMMARY:${esc(e.title)}`,
    `LOCATION:${esc(CLUB_LOCATION)}`,
    `DESCRIPTION:${esc(e.details ?? "")}`,
    // Recordatorio 2 h antes.
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(e.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
