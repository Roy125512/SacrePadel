-- Torneos y americanas (como Playtomic).
--
-- El club publica un evento (americana, torneo o social) con fecha, canchas,
-- cupo, nivel y precio. Los jugadores con cuenta se inscriben y pagan en
-- línea en /torneos. Las canchas del evento se apartan con reservas normales
-- (kind = 'EVENT', ligadas con event_id) para que nadie más las reserve.
-- En la americana el sistema arma las rondas (parejas que rotan) y la tabla
-- se actualiza con los marcadores que captura recepción.
-- Ver src/lib/events.ts y src/lib/americana.ts.

CREATE TABLE IF NOT EXISTS events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  kind         text NOT NULL CHECK (kind IN ('AMERICANA', 'TORNEO', 'SOCIAL')),
  description  text,
  starts_at    timestamptz NOT NULL,
  ends_at      timestamptz NOT NULL CHECK (ends_at > starts_at),
  court_ids    uuid[] NOT NULL DEFAULT '{}',
  -- INDIVIDUAL: cada quien se inscribe solo (americana). PAIR: por pareja.
  entry        text NOT NULL DEFAULT 'INDIVIDUAL' CHECK (entry IN ('INDIVIDUAL', 'PAIR')),
  -- Cupo: jugadores (INDIVIDUAL) o parejas (PAIR).
  capacity     smallint NOT NULL CHECK (capacity BETWEEN 2 AND 64),
  -- Precio por inscripción (por persona o por pareja), MXN.
  price        numeric NOT NULL DEFAULT 0 CHECK (price >= 0),
  level_min    smallint CHECK (level_min BETWEEN 1 AND 6),
  level_max    smallint CHECK (level_max BETWEEN 1 AND 6),
  gender       text NOT NULL DEFAULT 'ANY' CHECK (gender IN ('ANY', 'MALE', 'FEMALE')),
  status       text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'CANCELLED', 'FINISHED')),
  -- Americana: rondas con parejas, cancha y marcador.
  rounds       jsonb,
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_starts_idx ON events (starts_at);

CREATE TABLE IF NOT EXISTS event_registrations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users (id),
  player_name      text,
  partner_name     text,
  contact_email    text,
  status           text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED')),
  amount           numeric NOT NULL DEFAULT 0,
  payment_status   text NOT NULL DEFAULT 'UNPAID' CHECK (payment_status IN ('UNPAID', 'PAID', 'REFUNDED')),
  mp_payment_id    text,
  -- Lugar apartado mientras paga (20 min).
  checkout_until   timestamptz,
  paid_at          timestamptz,
  refunded_at      timestamptz,
  cancelled_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);
-- Una inscripción activa por jugador y evento.
CREATE UNIQUE INDEX IF NOT EXISTS event_registrations_active_key
  ON event_registrations (event_id, user_id) WHERE status <> 'CANCELLED';

-- Reservas que apartan las canchas del evento.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES events (id) ON DELETE SET NULL;

-- Solo el servidor (service role) las usa.
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
