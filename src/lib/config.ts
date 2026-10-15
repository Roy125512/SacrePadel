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
