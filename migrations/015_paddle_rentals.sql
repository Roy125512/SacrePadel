-- Renta de pala al reservar ($50 c/u, ver PADDLE_RENTAL_PRICE). Con pago
-- completo en línea se cobra junto con la cancha; en recepción o con pago
-- dividido se cobra al llegar. Recepción ve cuántas preparar.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS paddle_rentals smallint NOT NULL DEFAULT 0
  CHECK (paddle_rentals BETWEEN 0 AND 4);
