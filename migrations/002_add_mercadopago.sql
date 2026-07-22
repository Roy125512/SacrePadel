-- Add Mercado Pago columns to bookings table, mirroring how
-- stripe_payment_intent_id was added (001_add_stripe_payment_intent.sql).
-- mp_preference_id: the Checkout Pro preference, reused idempotently while
--   a HOLD is still open (same role as stripe_payment_intent_id).
-- mp_payment_id: the actual payment once approved, used by both the
--   webhook and the browser-return confirm() call to look it up.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS mp_preference_id text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS mp_payment_id text;

CREATE INDEX IF NOT EXISTS idx_bookings_mp_preference
  ON bookings (mp_preference_id)
  WHERE mp_preference_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_mp_payment
  ON bookings (mp_payment_id)
  WHERE mp_payment_id IS NOT NULL;

-- Update payment_method check constraint to allow MERCADOPAGO. STRIPE stays
-- in the allowed list for historical rows even though the app no longer
-- writes it going forward.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_method_chk;
ALTER TABLE bookings ADD CONSTRAINT bookings_payment_method_chk
  CHECK (payment_method IN ('CASH', 'CARD', 'TRANSFER', 'STRIPE', 'MERCADOPAGO'));
