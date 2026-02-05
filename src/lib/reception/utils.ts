import type { Booking, BookingStatus } from "./types";

export function toYMDLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDaysYMD(ymd: string, deltaDays: number) {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return toYMDLocal(d);
}

export function normalizeRange(a: string, b: string) {
  return a <= b ? { start: a, end: b } : { start: b, end: a };
}

export function daysInclusive(startYmd: string, endYmd: string) {
  const s = new Date(`${startYmd}T00:00:00`);
  const e = new Date(`${endYmd}T00:00:00`);
  const ms = e.getTime() - s.getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;
  return Number.isFinite(days) && days > 0 ? days : 1;
}

export function formatDateES(ymd: string) {
  const d = new Date(`${ymd}T00:00:00`);
  return d.toLocaleDateString("es-MX", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function formatRangeES(startYmd: string, endYmd: string) {
  const { start, end } = startYmd <= endYmd ? { start: startYmd, end: endYmd } : { start: endYmd, end: startYmd };
  return `${formatDateES(start)} – ${formatDateES(end)}`;
}

export function parseISOToLocalTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

export function hoursBetween(startISO: string, endISO: string) {
  const a = new Date(startISO).getTime();
  const b = new Date(endISO).getTime();
  const h = (b - a) / (1000 * 60 * 60);
  return Math.max(0, Math.round(h * 10) / 10);
}

export function currencyMXN(n: number) {
  return (n ?? 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

export function statusLabelES(s: BookingStatus) {
  if (s === "HOLD") return "Apartada";
  if (s === "CONFIRMED") return "Confirmada";
  if (s === "CANCELLED") return "Cancelada";
  if (s === "NO_SHOW") return "No asistió";
  if (s === "COMPLETED") return "Completada";
  return s;
}

export function origenLabel(src?: string) {
  if (!src) return "—";
  const s = String(src).toUpperCase();
  if (s === "WEB") return "Web";
  if (s === "WHATSAPP") return "WhatsApp";
  if (s === "RECEPTION") return "Recepción";
  return src;
}

export function asistenciaLabel(b: Booking) {
  if (b.status === "NO_SHOW") return "No asistió";
  if (b.status === "COMPLETED") return "Asistió";
  return "—";
}

export function tipoLabel(b: Booking) {
  if (b.session_type === "CLASS") return "Clase";
  if (b.session_type === "MATCH") return "Reta";
  return "Reserva";
}

export function isPaid(b: Booking) {
  return (b.payment_status ?? "UNPAID") === "PAID";
}

// ===== Reglas de bloqueo (recepción) =====
export function isAttendanceFinal(b: Booking) {
  return b.status === "COMPLETED" || b.status === "NO_SHOW";
}

export function canEditCustomer(b: Booking) {
  if (b.status === "CANCELLED") return false;
  if (isAttendanceFinal(b)) return false;
  if (isPaid(b)) return false;
  return true;
}

export function canCancelBooking(b: Booking) {
  if (b.status === "CANCELLED") return false;
  if (isPaid(b)) return false;
  if (isAttendanceFinal(b)) return false;
  return true;
}

export function canMarkAttendance(b: Booking) {
  if (b.status !== "CONFIRMED") return false;
  if (!isPaid(b)) return false;
  return true;
}

export function canCharge(b: Booking) {
  if (isPaid(b)) return false;
  if (b.status !== "CONFIRMED" && b.status !== "COMPLETED") return false;
  return true;
}

export function formatDateMX(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function parseISOToLocalTime24(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });
}
