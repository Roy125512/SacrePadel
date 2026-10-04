import { describe, expect, it } from "vitest";
import {
  addDaysToYMD,
  hhmmInBusinessTZ,
  hourInBusinessTZ,
  weekdayInBusinessTZ,
  weekdayOfYMD,
  ymdInBusinessTZ,
} from "@/lib/businessTime";

// Los tests corren con el proceso en UTC (vitest.config): los resultados
// deben ser los del club (UTC-6) aunque la máquina esté en otra zona.
describe("hora del club", () => {
  it("convierte un instante a la hora del club, no a la de la máquina", () => {
    // 22:30 UTC = 16:30 en Pátzcuaro
    expect(hhmmInBusinessTZ("2026-10-04T22:30:00Z")).toBe("16:30");
    expect(hourInBusinessTZ("2026-10-04T22:30:00Z")).toBe(16);
  });

  it("respeta el cambio de día del club", () => {
    // 03:00 UTC del día 5 = 21:00 del día 4 en el club
    expect(ymdInBusinessTZ("2026-10-05T03:00:00Z")).toBe("2026-10-04");
    expect(weekdayInBusinessTZ("2026-10-05T03:00:00Z")).toBe(0); // domingo
  });

  it("medianoche se reporta como 00:00", () => {
    expect(hhmmInBusinessTZ("2026-10-05T06:00:00Z")).toBe("00:00");
  });
});

describe("aritmética de fechas YYYY-MM-DD", () => {
  it("suma días cruzando meses y años", () => {
    expect(addDaysToYMD("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysToYMD("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToYMD("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("calcula el día de la semana de una fecha", () => {
    expect(weekdayOfYMD("2026-10-04")).toBe(0); // domingo
    expect(weekdayOfYMD("2026-10-05")).toBe(1); // lunes
  });
});
