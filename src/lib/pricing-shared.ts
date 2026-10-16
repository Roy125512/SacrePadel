// Single source of truth for pricing logic.
// Pure functions, no Node.js deps — safe for both client and server.

import { hourInBusinessTZ, weekdayInBusinessTZ } from "@/lib/businessTime";

export const DAY_RATE = 350; // 07:00 - 17:59
export const EVENING_RATE = 400; // 18:00 - 21:59
export const SWITCH_HOUR = 18;

// Horas valle (como Playtomic): tarifa más baja en horarios que se llenan
// poco. El dueño la ajusta desde recepción (/reception/tarifas); se guarda en
// club_settings y el servidor la carga con loadPricing() (lib/pricingSettings).
// En el navegador llega con la disponibilidad / las reservas y se aplica con
// setOffPeakConfig(). Mientras no haya nada guardado, aplica la de abajo.
export type OffPeakConfig = { enabled: boolean; rate: number; days: number[]; startHour: number; endHour: number };
export const DEFAULT_OFF_PEAK: OffPeakConfig = { enabled: true, rate: 280, days: [1, 2, 3, 4, 5], startHour: 7, endHour: 10 };

let offPeak: OffPeakConfig = DEFAULT_OFF_PEAK;

/** Valida y limpia una configuración (de la base de datos o del formulario). */
export function normalizeOffPeak(c: unknown): OffPeakConfig {
  const x = (c ?? {}) as Partial<OffPeakConfig>;
  const rate = Number(x.rate);
  const startHour = Math.trunc(Number(x.startHour));
  const endHour = Math.trunc(Number(x.endHour));
  const days = Array.isArray(x.days) ? [...new Set(x.days.map(Number).filter((d) => d >= 0 && d <= 6))].sort() : [];
  const ok = rate > 0 && rate <= 5000 && startHour >= 0 && endHour <= 24 && endHour > startHour && days.length > 0;
  if (!ok) return { ...DEFAULT_OFF_PEAK, enabled: x.enabled === false ? false : DEFAULT_OFF_PEAK.enabled };
  return { enabled: x.enabled !== false, rate, days, startHour, endHour };
}

export function setOffPeakConfig(c: unknown) {
  offPeak = normalizeOffPeak(c);
}

export function getOffPeakConfig(): OffPeakConfig {
  return offPeak;
}

/** ¿Este momento es hora valle? (en la hora del club) */
export function isOffPeak(d: Date | string, cfg: OffPeakConfig = offPeak): boolean {
  if (!cfg.enabled) return false;
  const date = typeof d === "string" ? new Date(d) : d;
  const h = hourInBusinessTZ(date);
  return cfg.days.includes(weekdayInBusinessTZ(date)) && h >= cfg.startHour && h < cfg.endHour;
}

const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
/** "Lun–Vie 07:00 — 10:00" */
export function offPeakLabel(cfg: OffPeakConfig = offPeak): string {
  const d = cfg.days;
  const consecutive = d.length > 1 && d.every((x, i) => i === 0 || x === d[i - 1] + 1);
  const days = consecutive ? `${DAY_SHORT[d[0]]}–${DAY_SHORT[d[d.length - 1]]}` : d.map((x) => DAY_SHORT[x]).join(", ");
  const hh = (n: number) => `${String(n).padStart(2, "0")}:00`;
  return `${days} ${hh(cfg.startHour)} — ${hh(cfg.endHour)}`;
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
  if (isOffPeak(d)) return offPeak.rate;
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
  const valley = offPeak.enabled && isOffPeak(new Date(startMs));
  if (list.length === 1) return valley && list[0] === offPeak.rate ? `$${list[0]} / hora · hora valle` : `$${list[0]} / hora`;
  return `Tarifa mixta (${list.join("/")})`;
}

export const MAX_PADDLE_RENTALS = 4;

/** Lo que se cobra por las palas rentadas. */
export function paddleRentalTotal(paddles: number | null | undefined): number {
  return Math.max(0, Math.min(MAX_PADDLE_RENTALS, paddles ?? 0)) * PADDLE_RENTAL_PRICE;
}
