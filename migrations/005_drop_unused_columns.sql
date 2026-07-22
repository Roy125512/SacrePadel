-- Limpieza de columnas/tablas confirmadas sin uso real (auditoría manual,
-- ver docs/reporting-access.md para contexto del resto de la auditoría):
--
-- 1) stripe_payment_intent_id: resto de la integración de Stripe, ya
--    reemplazada por completo con Mercado Pago. Cero referencias en el
--    código real (solo aparecía en el simulador de demo, que no usa la
--    base de datos real).
ALTER TABLE bookings DROP COLUMN IF EXISTS stripe_payment_intent_id;

-- 2) booking_events: se insertaba un registro al liberar un HOLD, pero
-- nunca se leyó desde ningún lado (sin reporte, sin vista de recepción).
-- El insert correspondiente ya se quitó de
-- src/app/api/web/release-hold/route.ts.
DROP TABLE IF EXISTS booking_events;
