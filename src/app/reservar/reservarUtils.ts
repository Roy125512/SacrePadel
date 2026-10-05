import { BUSINESS_TZ_OFFSET } from "@/lib/config";
import { hhmmInBusinessTZ, ymdInBusinessTZ } from "@/lib/businessTime";

export type Slot = { start_at: string; end_at: string; available: boolean; can_start?: boolean };
export type CourtAvailability = { court_id: string; court_name: string; slots: Slot[] };

export type AvailabilityResponse = {
  date: string;
  timezone_offset: string;
  step_minutes: number;
  open_hour: number;
  close_hour: number;
  availability: CourtAvailability[];
};

export type SelectedSlot = { court_id: string; court_name: string; start_at: string };

export type ConfirmedBooking = {
  fullName: string;
  courtName: string | null;
  dateYMD: string | null;
  startAt: string | null;
};

export type EmailInfo = { sent: boolean; to: string | null; error: string | null };

export type PaymentMode = "choose" | "reception";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

// Fecha/hora en la hora del club, no la del navegador del cliente.
export function toYMDLocal(d: Date) {
  return ymdInBusinessTZ(d);
}

export function parseISOToLocalTime(iso: string) {
  return hhmmInBusinessTZ(iso);
}

export function formatDateES(ymd: string) {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

/** Suma minutos a un ISO con offset, conservando el offset (hora del club). */
export function addMinutesIso(iso: string, minutes: number) {
  const m = iso.match(/([+-]\d{2}:\d{2})$/);
  const offset = m ? m[1] : BUSINESS_TZ_OFFSET;

  const [datePart, timeAndOffset] = iso.split("T");
  const timePart = timeAndOffset.slice(0, 8); // HH:mm:ss
  const [hh, mm, ss] = timePart.split(":").map((x) => Number(x));

  const total = hh * 60 + mm + minutes;

  const newH = Math.floor((((total % (24 * 60)) + 24 * 60) % (24 * 60)) / 60);
  const newM = ((total % 60) + 60) % 60;

  return `${datePart}T${pad2(newH)}:${pad2(newM)}:${pad2(ss)}${offset}`;
}

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
