-- Fase 1 de correcciones (pagos y datos de clientes).
--
-- 1) customers.user_id: qué cuenta "es dueña" de un registro de cliente.
--    Antes, cualquier persona que escribiera el teléfono de otro cliente
--    (como invitado o desde su perfil) sobrescribía su nombre/correo y
--    borraba su cumpleaños/sexo/división, porque el teléfono no se verifica.
--    Ahora solo la cuenta dueña puede sobrescribir esos datos; un registro
--    encontrado solo por teléfono únicamente se completa en campos vacíos.
--    Ver src/lib/customers.ts.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

-- Una cuenta = a lo más un registro de cliente propio.
CREATE UNIQUE INDEX IF NOT EXISTS customers_user_id_key
  ON customers (user_id)
  WHERE user_id IS NOT NULL;

-- Respaldo de lo ya existente: se le asigna dueño a un cliente solo cuando
-- TODAS sus reservas con cuenta pertenecen a una misma cuenta, y esa cuenta
-- no es dueña ya de otro cliente. Si hay ambigüedad, se deja sin dueño
-- (queda en modo "solo completar campos vacíos", que es lo seguro).
WITH single_owner AS (
  SELECT customer_id, min(user_id::text)::uuid AS user_id
  FROM bookings
  WHERE customer_id IS NOT NULL AND user_id IS NOT NULL
  GROUP BY customer_id
  HAVING count(DISTINCT user_id) = 1
),
unique_per_user AS (
  SELECT user_id, min(customer_id::text)::uuid AS customer_id
  FROM single_owner
  GROUP BY user_id
  HAVING count(*) = 1
)
UPDATE customers c
SET user_id = u.user_id
FROM unique_per_user u
WHERE c.id = u.customer_id
  AND c.user_id IS NULL;

-- 2) bookings.contact_email: correo al que se manda la confirmación de una
--    reserva web. Se guarda en la reserva (no solo en customers) porque con
--    pago en línea la confirmación puede llegar por el webhook de Mercado
--    Pago, sin que el navegador del cliente regrese al sitio.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS contact_email text;

-- 3) bookings.confirmation_email_sent_at: evita mandar los correos de
--    confirmación dos veces cuando el webhook y el navegador confirman la
--    misma reserva casi al mismo tiempo. Ver src/lib/bookingNotifications.ts.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS confirmation_email_sent_at timestamptz;
