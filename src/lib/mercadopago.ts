import { MercadoPagoConfig, Payment, Preference } from "mercadopago";

const globalForMp = globalThis as unknown as { _mpConfig?: MercadoPagoConfig };

// Falls back to a placeholder token so module import never throws when
// MERCADOPAGO_ACCESS_TOKEN is unset (e.g. DEMO mode with no Mercado Pago
// account configured yet). Callers must check DEMO (see @/lib/demo/flag)
// before actually invoking this client — see
// src/app/api/web/create-mp-preference, .../confirm and
// src/app/api/mercadopago/webhook, which all skip real calls in DEMO mode.
const mpConfig =
  globalForMp._mpConfig ??
  new MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || "TEST-demo-mode-placeholder",
  });

if (process.env.NODE_ENV !== "production") {
  globalForMp._mpConfig = mpConfig;
}

export const mpPreference = new Preference(mpConfig);
export const mpPayment = new Payment(mpConfig);
