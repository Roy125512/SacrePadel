-- Fase 4 de funciones tipo Playtomic: nivel de juego de 0 a 7.
--
-- - Cada jugador obtiene su nivel inicial con un cuestionario (una vez).
-- - Solo los partidos abiertos COMPETITIVOS con los 4 jugadores identificados
--   cuentan: un jugador captura el resultado y alguien del equipo contrario lo
--   confirma (hasta 7 días después del partido). Al confirmarse, el nivel de
--   los 4 se ajusta según el nivel esperado de cada pareja y el marcador.
-- - La "confiabilidad" sube con cada partido: al principio el nivel se mueve
--   rápido y luego se estabiliza.
-- Ver src/lib/levels.ts.

-- 1) Nivel en el perfil. NO se agregan al GRANT de columnas de la migración
--    000: el jugador no puede editarlos desde el navegador, solo el servidor.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS level numeric(4, 2) CHECK (level BETWEEN 0 AND 7);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS level_reliability smallint NOT NULL DEFAULT 0
  CHECK (level_reliability BETWEEN 0 AND 100);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS level_matches integer NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS level_updated_at timestamptz;

-- 2) Resultados de partidos competitivos.
CREATE TABLE IF NOT EXISTS match_results (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    uuid NOT NULL UNIQUE REFERENCES bookings (id) ON DELETE CASCADE,
  team_a        uuid[] NOT NULL,          -- quien capturó + su pareja
  team_b        uuid[] NOT NULL,
  sets          jsonb NOT NULL,           -- [[6,4],[3,6],[7,5]] (juegos de A, juegos de B)
  status        text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'REJECTED')),
  submitted_by  uuid NOT NULL,
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  reviewed_by   uuid,
  reviewed_at   timestamptz,
  -- {"<user_id>": {"before": 3.2, "after": 3.35}}
  level_changes jsonb
);

-- Solo el servidor (service role) la usa.
ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;
