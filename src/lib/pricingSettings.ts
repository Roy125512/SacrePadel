import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getOffPeakConfig, normalizeOffPeak, setOffPeakConfig, type OffPeakConfig } from "@/lib/pricing-shared";

/**
 * Horas valle ajustables desde recepción. Se guardan en club_settings y cada
 * proceso del servidor las tiene en memoria; se vuelven a leer cada 30 s, así
 * que un cambio del dueño se aplica en todo el sitio en menos de un minuto.
 * Llamar a loadPricing() antes de calcular precios en el servidor.
 */

const TTL_MS = 30_000;
let loadedAt = 0;

export async function loadPricing(opts?: { fresh?: boolean }): Promise<OffPeakConfig> {
  // `fresh`: leer siempre de la base (la portada, que solo se regenera al cambiar tarifas).
  if (!opts?.fresh && Date.now() - loadedAt < TTL_MS) return getOffPeakConfig();
  try {
    const { data, error } = await supabaseAdmin.from("club_settings").select("value").eq("key", "off_peak").maybeSingle();
    if (!error) {
      if (data?.value) setOffPeakConfig(data.value);
      loadedAt = Date.now();
    }
  } catch (e) {
    // Si falla la lectura se queda la última configuración conocida.
    console.error("loadPricing", e);
  }
  return getOffPeakConfig();
}

export async function saveOffPeak(input: unknown, userId: string): Promise<OffPeakConfig> {
  const cfg = normalizeOffPeak(input);
  const { error } = await supabaseAdmin
    .from("club_settings")
    .upsert({ key: "off_peak", value: cfg, updated_at: new Date().toISOString(), updated_by: userId }, { onConflict: "key" });
  if (error) throw error;
  setOffPeakConfig(cfg);
  loadedAt = Date.now();
  return cfg;
}
