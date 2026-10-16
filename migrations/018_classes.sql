-- Clases con entrenador (como Playtomic).
--
-- El club da de alta a sus entrenadores con su precio por hora (individual y
-- en pareja) y su horario semanal. El jugador elige entrenador, día y hora en
-- /clases; el sistema busca una cancha libre y la aparta como una reserva
-- normal (kind = 'CLASS', con coach_id y el precio de la clase en
-- list_price). Las clases grupales son eventos tipo "Clínica" (migración 016).
-- Ver src/lib/classes.ts.

CREATE TABLE IF NOT EXISTS coaches (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  bio              text,
  rate_individual  numeric NOT NULL CHECK (rate_individual > 0),  -- MXN por hora, 1 alumno
  rate_pair        numeric CHECK (rate_pair > 0),                  -- MXN por hora, 2 alumnos (total)
  -- [{"dow":1,"start":"07:00","end":"12:00"}, …]  (0 = domingo)
  weekly_hours     jsonb NOT NULL DEFAULT '[]',
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS coach_id uuid REFERENCES coaches (id) ON DELETE SET NULL;
-- Precio de esta reserva cuando no es la tarifa normal de cancha (clases).
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS list_price numeric CHECK (list_price >= 0);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS class_type text CHECK (class_type IN ('INDIVIDUAL', 'PAIR'));
CREATE INDEX IF NOT EXISTS bookings_coach_idx ON bookings (coach_id, start_at) WHERE coach_id IS NOT NULL;
