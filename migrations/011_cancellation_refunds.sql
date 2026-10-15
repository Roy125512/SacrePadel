-- Fase 1 de funciones tipo Playtomic: el cliente cancela su propia reserva
-- hasta 24 h antes y, si pagó en línea, se le reembolsa automáticamente por
-- Mercado Pago. Ver src/lib/cancellation.ts.

-- 1) Liga de cancelación para quien reservó sin cuenta: el correo de
--    confirmación lleva /reserva/cancelar?t=<cancel_token>. Las reservas que
--    ya existen reciben su token al aplicar esta migración.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS cancel_token uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS bookings_cancel_token_key ON bookings (cancel_token);

-- 2) Reembolsos: estado REFUNDED, cuánto, cuándo y el id de Mercado Pago.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_payment_status_check
  CHECK (payment_status IN ('UNPAID', 'PAID', 'REFUNDED'));

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refunded_amount numeric;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refunded_at timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS mp_refund_id text;

-- 3) Cuándo se canceló (cancelled_by ya existía: 'RECEPTION' o 'CUSTOMER').
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
