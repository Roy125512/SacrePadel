import { describe, expect, it } from "vitest";
import { buildSlots, overlapsIso, toIsoAt } from "@/lib/availability";

describe("toIsoAt", () => {
  it("arma la hora local con el offset del negocio", () => {
    expect(toIsoAt("2026-10-06", 7 * 60, "-06:00")).toBe("2026-10-06T07:00:00-06:00");
    expect(toIsoAt("2026-10-06", 21 * 60 + 30, "-06:00")).toBe("2026-10-06T21:30:00-06:00");
  });
});

describe("overlapsIso", () => {
  const s = (h: string) => `2026-10-06T${h}:00-06:00`;

  it("detecta traslapes", () => {
    expect(overlapsIso(s("08:00"), s("09:00"), s("08:30"), s("09:30"))).toBe(true);
    expect(overlapsIso(s("08:00"), s("10:00"), s("08:30"), s("09:00"))).toBe(true);
  });

  it("trata los rangos como semiabiertos: terminar a la hora que otro empieza no choca", () => {
    expect(overlapsIso(s("08:00"), s("09:00"), s("09:00"), s("10:00"))).toBe(false);
    expect(overlapsIso(s("09:00"), s("10:00"), s("08:00"), s("09:00"))).toBe(false);
  });
});

describe("buildSlots", () => {
  it("genera bloques de 30 min de la apertura al cierre", () => {
    const slots = buildSlots("2026-10-06", 7, 22, 30, "-06:00");
    expect(slots).toHaveLength(30);
    expect(slots[0]).toEqual({ start_at: "2026-10-06T07:00:00-06:00", end_at: "2026-10-06T07:30:00-06:00" });
    expect(slots.at(-1)).toEqual({ start_at: "2026-10-06T21:30:00-06:00", end_at: "2026-10-06T22:00:00-06:00" });
  });
});
