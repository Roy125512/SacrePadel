// Re-export from single source of truth.
export {
  DAY_RATE,
  EVENING_RATE as NIGHT_RATE,
  SWITCH_HOUR as NIGHT_START_HOUR,
  computeExpectedAmountMXN,
} from "@/lib/pricing-shared";

// Legacy alias kept for existing reception imports
export const TARIFF_PER_HOUR = 350;
export const NIGHT_END_HOUR = 22;
