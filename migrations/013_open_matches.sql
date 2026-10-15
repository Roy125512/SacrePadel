-- Fase 3 de funciones tipo Playtomic: partidos abiertos.
--
-- Un partido abierto es una reserva con pago dividido entre 4 que se publica
-- en /partidos para que otros jugadores (con cuenta) se unan pagando su parte.
-- Quien lo crea paga la suya y la cancha queda apartada; lo que no se llene
-- sigue la misma regla de deuda del pago dividido (migración 012).
-- Ver src/lib/openMatches.ts.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_open_match boolean NOT NULL DEFAULT false;
-- Amistoso o competitivo (el competitivo contará para el nivel, fase 4).
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS match_type text
  CHECK (match_type IN ('FRIENDLY', 'COMPETITIVE'));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS match_gender text
  CHECK (match_gender IN ('ANY', 'MALE', 'FEMALE'));
-- Rango de nivel con las divisiones del perfil: 1 = 1ra (la más alta) … 6 = 6ta.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS match_level_min smallint
  CHECK (match_level_min BETWEEN 1 AND 6);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS match_level_max smallint
  CHECK (match_level_max BETWEEN 1 AND 6);
CREATE INDEX IF NOT EXISTS bookings_open_match_idx ON bookings (start_at) WHERE is_open_match;

-- Quién ocupa cada lugar (para saber quién se unió y dejarlo salirse).
ALTER TABLE booking_shares ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users (id);
CREATE INDEX IF NOT EXISTS booking_shares_user_idx ON booking_shares (user_id);
