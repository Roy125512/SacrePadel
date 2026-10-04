// Single source of truth for pricing logic.
// Pure functions, no Node.js deps — safe for both client and server.

import { hourInBusinessTZ } from "@/lib/businessTime";

export const DAY_RATE = 350; // 07:00 - 17:59
export const EVENING_RATE = 400; // 18:00 - 21:59
export const SWITCH_HOUR = 18;

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
  const startH = hourInBusinessTZ(new Date(startIso));
  const endH = hourInBusinessTZ(new Date(endIso));
  if (startH < SWITCH_HOUR && endH <= SWITCH_HOUR) return `$${DAY_RATE} / hora`;
  if (startH >= SWITCH_HOUR) return `$${EVENING_RATE} / hora`;
  return `Tarifa mixta (${DAY_RATE}/${EVENING_RATE})`;
}
