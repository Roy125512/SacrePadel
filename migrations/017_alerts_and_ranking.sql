-- "Avísame si se libera" y ranking del club.
--
-- 1) Alertas: un jugador pide que le avisemos por correo si se libera un
--    horario (SLOT: cualquier cancha a esa hora), un lugar en un partido
--    abierto lleno (MATCH) o en un torneo lleno (EVENT). Se avisa una sola
--    vez, al primero que cancele. Ver src/lib/alerts.ts.
CREATE TABLE IF NOT EXISTS slot_alerts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         text NOT NULL CHECK (kind IN ('SLOT', 'MATCH', 'EVENT')),
  user_id      uuid REFERENCES auth.users (id),
  email        text NOT NULL,
  start_at     timestamptz,  -- SLOT: hora deseada
  ref_id       uuid,         -- MATCH: reserva del partido · EVENT: evento
  created_at   timestamptz NOT NULL DEFAULT now(),
  notified_at  timestamptz
);
CREATE INDEX IF NOT EXISTS slot_alerts_pending_idx ON slot_alerts (kind, start_at) WHERE notified_at IS NULL;
CREATE INDEX IF NOT EXISTS slot_alerts_ref_idx ON slot_alerts (ref_id) WHERE notified_at IS NULL;
ALTER TABLE slot_alerts ENABLE ROW LEVEL SECURITY;

-- 2) Ranking: cada jugador decide si aparece (por defecto sí). Lo cambia el
--    servidor (/api/web/level/visibility), no el navegador.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ranking_visible boolean NOT NULL DEFAULT true;
