-- Ajustes del club que el dueño cambia desde recepción sin tocar código.
-- Por ahora: 'off_peak' = horas valle {enabled, rate, days, startHour, endHour}.
-- Ver src/lib/pricingSettings.ts y /reception/tarifas.
CREATE TABLE IF NOT EXISTS club_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid
);
ALTER TABLE club_settings ENABLE ROW LEVEL SECURITY;
