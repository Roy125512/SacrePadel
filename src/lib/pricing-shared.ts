// Single source of truth for pricing logic.
// Pure functions, no Node.js deps — safe for both client and server.

export const DAY_RATE = 350; // 07:00 - 17:59
export const EVENING_RATE = 400; // 18:00 - 21:59
export const SWITCH_HOUR = 18;

// Renta de pala en el club. Venta de palas y pelotas también disponible,
// pero esos precios se dan directamente en recepción (no están fijos aquí).
export const PADDLE_RENTAL_PRICE = 50;

// Business is in Pátzcuaro, Michoacán — pricing must always be evaluated in
// this timezone, never the server's local time. A server deployed in UTC
// (the common case for cloud hosting) would otherwise silently swap the
// day/evening rate for every booking.
const BUSINESS_TZ = "America/Mexico_City";

function hourInBusinessTZ(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TZ,
    hour: "numeric",
    hour12: false,
  }).formatToParts(d);
  const hourPart = parts.find((p) => p.type === "hour");
  const h = hourPart ? Number(hourPart.value) : d.getHours();
  return h % 24; // some engines report midnight as "24" with hour12:false
}

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
