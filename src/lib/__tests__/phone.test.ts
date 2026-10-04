import { describe, expect, it } from "vitest";
import { normalizePhoneToE164 } from "@/lib/phone";

describe("normalizePhoneToE164", () => {
  it("acepta números de 10 dígitos de México en varios formatos", () => {
    expect(normalizePhoneToE164("443 123 4567")).toBe("+524431234567");
    expect(normalizePhoneToE164("(443) 123-4567")).toBe("+524431234567");
    expect(normalizePhoneToE164("+52 443 123 4567")).toBe("+524431234567");
  });

  it("rechaza números inválidos", () => {
    expect(normalizePhoneToE164("123")).toBeNull();
    expect(normalizePhoneToE164("")).toBeNull();
  });
});
