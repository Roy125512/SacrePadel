// Central place for business rules & constants.
// Keep this file free of server-only code so it can be imported from both
// client components and API routes.

// Fixed timezone offset for Mexico (Centro) used throughout the app.
// If you later migrate to IANA timezones (recommended), do it here.
export const BUSINESS_TZ_OFFSET = "-06:00" as const;

// Operating hours (local business time)
export const OPEN_HOUR = 7 as const;
export const CLOSE_HOUR = 22 as const;

// Slot granularity
export const STEP_MINUTES = 30 as const;

// Minimum booking duration (used by /api/web/availability)
export const MIN_BOOKING_MINUTES = 60 as const;

// Maximum booking duration — mirrors the longest option offered in
// ReservarClient's duration picker (60/90/120/150/180 min). Enforced
// server-side in /api/web/hold and /api/web/update-hold so a raw API call
// can't request an absurdly long end_at to block a court's availability
// for other customers while the HOLD is alive.
export const MAX_BOOKING_MINUTES = 180 as const;

// Política de cancelación (como Playtomic): el cliente puede cancelar su
// reserva él mismo hasta estas horas antes del inicio. Si pagó en línea, se
// le reembolsa automáticamente. Después de ese plazo ya no se puede cancelar
// en línea; recepción decide los casos especiales (lluvia, etc.).
export const CANCEL_NOTICE_HOURS = 24 as const;

/** ¿Todavía se puede cancelar en línea una reserva que empieza en `startAt`? */
export function withinCancelWindow(startAt: string | Date, nowMs = Date.now()): boolean {
  const start = typeof startAt === "string" ? new Date(startAt).getTime() : startAt.getTime();
  return start - nowMs >= CANCEL_NOTICE_HOURS * 3600_000;
}

// Pago dividido (como Playtomic): quien reserva paga solo su parte y comparte
// una liga para que cada compañero pague la suya. Lo que no se haya pagado
// estas horas después de terminar el partido queda a cargo de quien reservó,
// y no puede volver a reservar hasta cubrirlo.
export const SPLIT_PARTS_OPTIONS = [2, 3, 4] as const;
export const DEFAULT_SPLIT_PARTS = 4 as const;
export const SPLIT_DEBT_GRACE_HOURS = 2 as const;

/**
 * Reparte `total` (MXN) en `parts` partes con centavos exactos; los centavos
 * que sobran van a la parte 1 (la de quien reserva). 350 / 3 → 116.68, 116.66, 116.66.
 */
export function splitAmounts(total: number, parts: number): number[] {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / parts);
  const out = Array.from({ length: parts }, () => base);
  out[0] += cents - base * parts;
  return out.map((c) => c / 100);
}

/** "$112.50" / "$350" — pesos con centavos solo cuando los hay. */
export function formatMXN(n: number): string {
  const v = Math.round(n * 100) / 100;
  return `$${Number.isInteger(v) ? v : v.toFixed(2)}`;
}
