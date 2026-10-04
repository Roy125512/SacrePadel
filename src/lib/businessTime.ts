// Fechas y horas SIEMPRE en la hora del club (Pátzcuaro = hora del Centro),
// sin importar la zona horaria de la computadora o del servidor. Antes la
// interfaz usaba la zona del navegador: desde una computadora en otra zona
// (p. ej. Mazatlán, una hora menos) todas las reservas se veían corridas.
// Sin dependencias de Node: sirve igual en el navegador y en el servidor.

export const BUSINESS_TZ = "America/Mexico_City";

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
  hourCycle: "h23",
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function businessParts(d: Date) {
  const p: Record<string, string> = {};
  for (const part of partsFormatter.formatToParts(d)) p[part.type] = part.value;
  return {
    year: p.year,
    month: p.month,
    day: p.day,
    hour: Number(p.hour) % 24,
    minute: p.minute,
    weekday: WEEKDAYS.indexOf(p.weekday),
  };
}

const toDate = (d: Date | string) => (typeof d === "string" ? new Date(d) : d);

/** "YYYY-MM-DD" del día en el club (por defecto, hoy). */
export function ymdInBusinessTZ(d: Date | string = new Date()) {
  const p = businessParts(toDate(d));
  return `${p.year}-${p.month}-${p.day}`;
}

/** "HH:MM" (24 h) en el club. */
export function hhmmInBusinessTZ(d: Date | string = new Date()) {
  const p = businessParts(toDate(d));
  return `${String(p.hour).padStart(2, "0")}:${p.minute}`;
}

/** Hora 0–23 en el club. */
export function hourInBusinessTZ(d: Date | string) {
  return businessParts(toDate(d)).hour;
}

/** Día de la semana en el club (0 = domingo … 6 = sábado). */
export function weekdayInBusinessTZ(d: Date | string) {
  return businessParts(toDate(d)).weekday;
}

/** Suma días a una fecha "YYYY-MM-DD" (aritmética de calendario, sin zonas). */
export function addDaysToYMD(ymd: string, deltaDays: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + deltaDays)).toISOString().slice(0, 10);
}

/** Día de la semana de una fecha "YYYY-MM-DD" (0 = domingo). */
export function weekdayOfYMD(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
