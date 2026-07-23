-- Permite que recepción registre el canal real por el que llegó una
-- reserva manual (llamada, WhatsApp, presencial) en vez de solo el genérico
-- 'RECEPTION'. Ver src/app/api/reception/create-booking/route.ts.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_source_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_source_check
  CHECK (source IN ('WEB', 'WHATSAPP', 'RECEPTION', 'PHONE', 'WALK_IN'));
