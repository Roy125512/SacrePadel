import type { Booking, BookingStatus } from "./types";
import { computeExpectedAmountMXN } from "./pricing";

// Real court count in the DB (Cancha 1–4). Used for occupancy-capacity
// math — keep in sync if a court is added/retired.
export const DEFAULT_COURTS = 4;
export const OPEN_HOUR = 7;
export const CLOSE_HOUR = 22;

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
  if (s === "PHONE") return "Teléfono";
  if (s === "WALK_IN") return "Presencial";
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

// ===== Cálculos compartidos (operación + dashboard) =====

/** Añade duration_hours y amount (esperado o pagado) a una reserva cruda de la API. */
export function enrichBooking(b: Booking): Booking {
  const dur = hoursBetween(b.start_at, b.end_at);
  const amount =
    typeof b.paid_amount === "number" && (b.payment_status ?? "UNPAID") === "PAID"
      ? b.paid_amount
      : computeExpectedAmountMXN(b.start_at, b.end_at);
  return { ...b, duration_hours: dur, amount };
}

export type CapacityOpts = { courts?: number; openHour?: number; closeHour?: number };

export type AggregateStats = {
  totalReservas: number;
  ingresos: number;
  pendiente: number;
  horasVendidas: number;
  ocupacion: number;
  efectivo: number;
  tarjeta: number;
  transfer: number;
  mercadopago: number;
  pendientesCount: number;
  tarifaPromedio: number;
};

export function computeAggregateStats(rows: Booking[], days: number, opts?: CapacityOpts): AggregateStats {
  const courts = opts?.courts ?? DEFAULT_COURTS;
  const openHour = opts?.openHour ?? OPEN_HOUR;
  const closeHour = opts?.closeHour ?? CLOSE_HOUR;

  const confirmedOrCompleted = rows.filter((b) => b.status === "CONFIRMED" || b.status === "COMPLETED");
  const paid = rows.filter((b) => b.payment_status === "PAID");
  const pending = rows.filter((b) => canCharge(b));

  const ingresos = paid.reduce((acc, b) => acc + (b.paid_amount ?? 0), 0);
  const pendiente = pending.reduce((acc, b) => acc + (b.amount ?? 0), 0);
  const horasVendidas = confirmedOrCompleted.reduce((acc, b) => acc + (b.duration_hours ?? 0), 0);

  const capacityHours = courts * (closeHour - openHour) * days;
  const ocupacion = capacityHours > 0 ? (horasVendidas / capacityHours) * 100 : 0;

  const efectivo = paid.filter((b) => b.payment_method === "CASH").reduce((acc, b) => acc + (b.paid_amount ?? 0), 0);
  const tarjeta = paid.filter((b) => b.payment_method === "CARD").reduce((acc, b) => acc + (b.paid_amount ?? 0), 0);
  const transfer = paid.filter((b) => b.payment_method === "TRANSFER").reduce((acc, b) => acc + (b.paid_amount ?? 0), 0);
  const mercadopago = paid.filter((b) => b.payment_method === "MERCADOPAGO").reduce((acc, b) => acc + (b.paid_amount ?? 0), 0);

  const tarifaPromedio = horasVendidas > 0 ? ingresos / horasVendidas : 0;

  return {
    totalReservas: rows.length,
    ingresos,
    pendiente,
    horasVendidas,
    ocupacion,
    efectivo,
    tarjeta,
    transfer,
    mercadopago,
    pendientesCount: pending.length,
    tarifaPromedio,
  };
}

export type DailySummaryRow = {
  ymd: string;
  reservas: number;
  ingresos: number;
  pendiente: number;
  horasVendidas: number;
  ocupacion: number;
  canceladas: number;
  noShow: number;
  completadas: number;
  tarifaPromedio: number;
};

export function buildDailySummary(
  rows: Booking[],
  startYMD: string,
  endYMD: string,
  opts?: CapacityOpts
): DailySummaryRow[] {
  const courts = opts?.courts ?? DEFAULT_COURTS;
  const openHour = opts?.openHour ?? OPEN_HOUR;
  const closeHour = opts?.closeHour ?? CLOSE_HOUR;

  const norm = normalizeRange(startYMD, endYMD);
  const days = daysInclusive(norm.start, norm.end);
  const capacityPerDay = courts * (closeHour - openHour);

  type Bucket = Omit<DailySummaryRow, "ocupacion" | "tarifaPromedio">;
  const map = new Map<string, Bucket>();

  for (const b of rows) {
    const ymd = toYMDLocal(new Date(b.start_at));
    const bucket: Bucket =
      map.get(ymd) ?? { ymd, reservas: 0, ingresos: 0, pendiente: 0, horasVendidas: 0, canceladas: 0, noShow: 0, completadas: 0 };

    bucket.reservas += 1;
    if ((b.payment_status ?? "UNPAID") === "PAID") bucket.ingresos += b.paid_amount ?? 0;
    if (canCharge(b)) bucket.pendiente += b.amount ?? 0;
    if (b.status === "CONFIRMED" || b.status === "COMPLETED") bucket.horasVendidas += b.duration_hours ?? 0;
    if (b.status === "CANCELLED") bucket.canceladas += 1;
    if (b.status === "NO_SHOW") bucket.noShow += 1;
    if (b.status === "COMPLETED") bucket.completadas += 1;

    map.set(ymd, bucket);
  }

  const out: DailySummaryRow[] = [];
  for (let i = 0; i < days; i++) {
    const y = addDaysYMD(norm.start, i);
    const bucket: Bucket =
      map.get(y) ?? { ymd: y, reservas: 0, ingresos: 0, pendiente: 0, horasVendidas: 0, canceladas: 0, noShow: 0, completadas: 0 };

    const ocupacion = capacityPerDay > 0 ? (bucket.horasVendidas / capacityPerDay) * 100 : 0;
    const tarifaPromedio = bucket.horasVendidas > 0 ? bucket.ingresos / bucket.horasVendidas : 0;

    out.push({ ...bucket, ocupacion, tarifaPromedio });
  }

  return out;
}
