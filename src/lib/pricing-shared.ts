// Single source of truth for pricing logic.
// Pure functions, no Node.js deps — safe for both client and server.

import { hourInBusinessTZ, weekdayInBusinessTZ } from "@/lib/businessTime";

export const DAY_RATE = 350; // 07:00 - 17:59
export const EVENING_RATE = 400; // 18:00 - 21:59
export const SWITCH_HOUR = 18;

// Horas valle (como Playtomic): tarifa más baja en horarios que se llenan
// poco, para animar a jugar temprano entre semana.
export const OFF_PEAK_RATE = 280;
export const OFF_PEAK_DAYS = [1, 2, 3, 4, 5] as const; // lunes a viernes
export const OFF_PEAK_START_HOUR = 7;
export const OFF_PEAK_END_HOUR = 10; // hasta las 10:00

/** ¿Este momento es hora valle? (en la hora del club) */
export function isOffPeak(d: Date | string): boolean {
  const date = typeof d === "string" ? new Date(d) : d;
  const h = hourInBusinessTZ(date);
  return (
    (OFF_PEAK_DAYS as readonly number[]).includes(weekdayInBusinessTZ(date)) &&
    h >= OFF_PEAK_START_HOUR &&
    h < OFF_PEAK_END_HOUR
  );
}

// Renta de pala en el club. Venta de palas y pelotas también disponible,
// pero esos precios se dan directamente en recepción (no están fijos aquí).
export const PADDLE_RENTAL_PRICE = 50;

// La tarifa se evalúa siempre en la hora del club (ver lib/businessTime),
// nunca en la del servidor: en la nube suele estar en UTC y cambiaría la
// tarifa de día/noche de todas las reservas.
/** Rate per hour for a given ISO timestamp. */
export function rateAtISO(iso: string): number {
  return rateAtDate(new Date(iso));
}

/** Rate per hour for a given Date, evaluated in business local time. */
export function rateAtDate(d: Date): number {
  if (isOffPeak(d)) return OFF_PEAK_RATE;
  return hourInBusinessTZ(d) >= SWITCH_HOUR ? EVENING_RATE : DAY_RATE;
}

/**
 * Compute pro-rated amount in MXN for a booking span.
 * Iterates minute-by-minute to handle the 18:00 rate switch correctly.
 */
export function computeExpectedAmountMXN(startIso: string, endIso: string): number {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;

  let total = 0;
  for (let t = startMs; t < endMs; t += 60_000) {
    const next = Math.min(t + 60_000, endMs);
    const hours = (next - t) / 3_600_000;
    total += hours * rateAtDate(new Date(t));
  }
  return Math.round(total);
}

/** Human-readable price label for a time range. */
export function priceLabelForRange(startIso: string, endIso: string): string {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  const rates = new Set<number>();
  for (let t = startMs; t < endMs; t += 15 * 60_000) rates.add(rateAtDate(new Date(t)));
  const list = [...rates].sort((a, b) => a - b);
  if (list.length === 0) return "";
  if (list.length === 1) return list[0] === OFF_PEAK_RATE ? `$${OFF_PEAK_RATE} / hora · hora valle` : `$${list[0]} / hora`;
  return `Tarifa mixta (${list.join("/")})`;
}

export const MAX_PADDLE_RENTALS = 4;

/** Lo que se cobra por las palas rentadas. */
export function paddleRentalTotal(paddles: number | null | undefined): number {
  return Math.max(0, Math.min(MAX_PADDLE_RENTALS, paddles ?? 0)) * PADDLE_RENTAL_PRICE;
}
