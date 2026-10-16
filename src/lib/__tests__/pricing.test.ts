import { describe, expect, it } from "vitest";
import { computeExpectedAmountMXN, isOffPeak, normalizeOffPeak, offPeakLabel, priceLabelForRange, rateAtISO, setOffPeakConfig, DEFAULT_OFF_PEAK } from "@/lib/pricing-shared";

// Las horas van con offset -06:00 (Pátzcuaro). Los tests corren con el
// proceso en UTC (vitest.config.ts) para asegurar que el precio no depende
// de la zona horaria del servidor.
const at = (hhmm: string) => `2026-10-06T${hhmm}:00-06:00`;

describe("rateAtISO", () => {
  it("cobra tarifa de día antes de las 18:00 y de noche desde las 18:00", () => {
    expect(rateAtISO(at("10:00"))).toBe(350);
    expect(rateAtISO(at("17:59"))).toBe(350);
    expect(rateAtISO(at("18:00"))).toBe(400);
    expect(rateAtISO(at("21:30"))).toBe(400);
  });
});

describe("computeExpectedAmountMXN", () => {
  it("calcula reservas de día", () => {
    expect(computeExpectedAmountMXN(at("11:00"), at("12:00"))).toBe(350);
    expect(computeExpectedAmountMXN(at("11:00"), at("12:30"))).toBe(525);
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
    expect(priceLabelForRange(at("11:00"), at("12:00"))).toBe("$350 / hora");
    expect(priceLabelForRange(at("17:00"), at("18:00"))).toBe("$350 / hora");
    expect(priceLabelForRange(at("18:00"), at("19:00"))).toBe("$400 / hora");
    expect(priceLabelForRange(at("17:00"), at("19:00"))).toBe("Tarifa mixta (350/400)");
  });
});

describe("horas valle", () => {
  // 2026-10-06 es martes; 2026-10-10 es sábado.
  it("entre semana de 7:00 a 10:00 cuesta menos", () => {
    expect(rateAtISO(at("07:00"))).toBe(280);
    expect(rateAtISO(at("09:59"))).toBe(280);
    expect(rateAtISO(at("10:00"))).toBe(350);
    expect(isOffPeak(at("08:30"))).toBe(true);
    expect(computeExpectedAmountMXN(at("09:00"), at("10:30"))).toBe(280 + 175);
    expect(priceLabelForRange(at("08:00"), at("09:00"))).toBe("$280 / hora · hora valle");
    expect(priceLabelForRange(at("09:00"), at("10:30"))).toBe("Tarifa mixta (280/350)");
  });
  it("en fin de semana no hay hora valle", () => {
    expect(rateAtISO("2026-10-10T08:00:00-06:00")).toBe(350);
    expect(isOffPeak("2026-10-10T08:00:00-06:00")).toBe(false);
  });
});

describe("horas valle ajustables", () => {
  it("el dueño cambia precio, días y horario", () => {
    setOffPeakConfig({ enabled: true, rate: 300, days: [6, 0], startHour: 13, endHour: 16 });
    expect(rateAtISO("2026-10-10T14:00:00-06:00")).toBe(300); // sábado
    expect(rateAtISO(at("08:00"))).toBe(350); // martes ya no es valle
    expect(offPeakLabel()).toBe("Dom, Sáb 13:00 — 16:00");
    setOffPeakConfig({ ...DEFAULT_OFF_PEAK, enabled: false });
    expect(rateAtISO(at("08:00"))).toBe(350);
    setOffPeakConfig(DEFAULT_OFF_PEAK);
    expect(rateAtISO(at("08:00"))).toBe(280);
    expect(offPeakLabel()).toBe("Lun–Vie 07:00 — 10:00");
  });
  it("una configuración inválida no rompe los precios", () => {
    expect(normalizeOffPeak({ rate: -5, days: [], startHour: 10, endHour: 7 })).toEqual(DEFAULT_OFF_PEAK);
  });
});
