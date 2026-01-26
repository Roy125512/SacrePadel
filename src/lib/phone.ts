import { parsePhoneNumberFromString } from "libphonenumber-js";

export function normalizePhoneToE164(input: string, defaultCountry: string = "MX") {
  const raw = (input || "").trim();

  if (!raw) return { e164: null, country: null, isValid: false };

  // Usa el país por defecto SOLO si el número no trae +
  const phone = parsePhoneNumberFromString(raw, defaultCountry);

  if (!phone) return { e164: null, country: null, isValid: false };

  const isValid = phone.isValid();
  const e164 = isValid ? phone.number : null;

  return { e164, country: phone.country ?? null, isValid };
}

