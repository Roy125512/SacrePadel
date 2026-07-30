-- Registra qué cuenta de recepción/dueño dio de alta cada reserva manual.
-- Varias personas comparten acceso a /reception y el "Origen" (source) por
-- sí solo no distingue quién la hizo — se guarda el nombre (o correo, si no
-- llenó su perfil) de la cuenta que hizo la reserva. Ver
-- src/app/api/reception/create-booking/route.ts.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS created_by_name text;
