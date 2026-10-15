-- Fase 2 de funciones tipo Playtomic: pago dividido.
--
-- Quien reserva paga solo su parte en línea; el resto de las partes se pagan
-- con una liga que comparte con sus compañeros (/reserva/pagar?t=<split_token>).
-- Lo que no se pague hasta 2 h después del partido queda como deuda de quien
-- reservó, y no puede volver a reservar hasta cubrirla (en línea o en
-- recepción). Ver src/lib/splitPayments.ts.

-- 1) Nuevo estado de pago: PARTIAL (ya pagó alguien, falta alguien).
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_payment_status_check
  CHECK (payment_status IN ('UNPAID', 'PARTIAL', 'PAID', 'REFUNDED'));

-- 2) Datos del pago dividido en la reserva.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS split_parts smallint
  CHECK (split_parts BETWEEN 2 AND 4);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS split_token uuid;
CREATE UNIQUE INDEX IF NOT EXISTS bookings_split_token_key ON bookings (split_token);
-- Cuánto de paid_amount entró por Mercado Pago (el resto se cobró en
-- recepción). Para el desglose de ingresos por método.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS online_paid_amount numeric;

-- 3) Las partes. La 1 es de quien reservó.
CREATE TABLE IF NOT EXISTS booking_shares (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      uuid NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
  seq             smallint NOT NULL,
  amount          numeric NOT NULL CHECK (amount > 0),
  status          text NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'PAID', 'REFUNDED', 'CANCELLED')),
  payer_name      text,
  payer_email     text,
  payment_method  text,
  mp_payment_id   text,
  paid_at         timestamptz,
  -- Mientras alguien está en el checkout de Mercado Pago, la parte queda
  -- apartada hasta esta hora para que dos personas no paguen la misma.
  checkout_until  timestamptz,
  refunded_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, seq)
);
CREATE INDEX IF NOT EXISTS booking_shares_mp_payment_idx ON booking_shares (mp_payment_id);

-- Solo el servidor (service role) la usa.
ALTER TABLE booking_shares ENABLE ROW LEVEL SECURITY;
