import { describe, expect, it } from "vitest";
import { computeExpectedAmountMXN, priceLabelForRange, rateAtISO } from "@/lib/pricing-shared";

// Las horas van con offset -06:00 (Pátzcuaro). Los tests corren con el
// proceso en UTC (vitest.config.ts) para asegurar que el precio no depende
// de la zona horaria del servidor.
const at = (hhmm: string) => `2026-10-06T${hhmm}:00-06:00`;

describe("rateAtISO", () => {
  it("cobra tarifa de día antes de las 18:00 y de noche desde las 18:00", () => {
    expect(rateAtISO(at("07:00"))).toBe(350);
    expect(rateAtISO(at("17:59"))).toBe(350);
    expect(rateAtISO(at("18:00"))).toBe(400);
    expect(rateAtISO(at("21:30"))).toBe(400);
  });
});

describe("computeExpectedAmountMXN", () => {
  it("calcula reservas de día", () => {
    expect(computeExpectedAmountMXN(at("08:00"), at("09:00"))).toBe(350);
    expect(computeExpectedAmountMXN(at("08:00"), at("09:30"))).toBe(525);
  });

  it("calcula reservas de noche", () => {
    expect(computeExpectedAmountMXN(at("19:00"), at("21:00"))).toBe(800);
  });

  it("prorratea una reserva que cruza las 18:00", () => {
    // 30 min a 350/h + 30 min a 400/h
    expect(computeExpectedAmountMXN(at("17:30"), at("18:30"))).toBe(375);
  });

  it("regresa 0 para rangos inválidos", () => {
    expect(computeExpectedAmountMXN(at("10:00"), at("10:00"))).toBe(0);
    expect(computeExpectedAmountMXN(at("11:00"), at("10:00"))).toBe(0);
    expect(computeExpectedAmountMXN("no-es-fecha", at("10:00"))).toBe(0);
  });
});

describe("priceLabelForRange", () => {
  it("describe la tarifa del rango", () => {
    expect(priceLabelForRange(at("08:00"), at("09:00"))).toBe("$350 / hora");
    expect(priceLabelForRange(at("17:00"), at("18:00"))).toBe("$350 / hora");
    expect(priceLabelForRange(at("18:00"), at("19:00"))).toBe("$400 / hora");
    expect(priceLabelForRange(at("17:00"), at("19:00"))).toBe("Tarifa mixta (350/400)");
  });
});
