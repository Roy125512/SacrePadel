// Pricing helpers for Reception (expected amount calculation).

export const TARIFF_PER_HOUR = 350;

export const DAY_RATE = 350;   // 07:00 - 18:00
export const NIGHT_RATE = 400; // 18:00 - 22:00
export const NIGHT_START_HOUR = 18;
export const NIGHT_END_HOUR = 22;

// Sum by 30-min blocks (the app operates in 30-min blocks).
export function computeExpectedAmountMXN(startISO: string, endISO: string) {
  const start = new Date(startISO);
  const end = new Date(endISO);

  const stepMs = 30 * 60 * 1000; // 30 min
  let total = 0;

  for (let t = start.getTime(); t < end.getTime(); t += stepMs) {
    const d = new Date(t);
    const h = d.getHours();

    const isNight = h >= NIGHT_START_HOUR && h < NIGHT_END_HOUR;
    const ratePerHour = isNight ? NIGHT_RATE : DAY_RATE;

    total += ratePerHour / 2; // half-hour
  }

  return Math.round(total); // MXN
}
