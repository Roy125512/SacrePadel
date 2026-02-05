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
