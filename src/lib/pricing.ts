export function getHourlyRate(startAtISO: string) {
  const d = new Date(startAtISO);
  const hour = d.getHours(); // local server time

  // 7:00 – 17:59 → $350
  if (hour >= 7 && hour < 18) return 350;

  // 18:00 – 21:59 → $400
  if (hour >= 18 && hour < 22) return 400;

  // Fuera de horario (por si acaso)
  return 400;
}
