-- Add stripe_payment_intent_id column to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

-- Index for looking up bookings by PaymentIntent ID (webhook handler)
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_pi
  ON bookings (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- Update payment_method check constraint to allow STRIPE
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_method_chk;
ALTER TABLE bookings ADD CONSTRAINT bookings_payment_method_chk
  CHECK (payment_method IN ('CASH', 'CARD', 'TRANSFER', 'STRIPE'));
