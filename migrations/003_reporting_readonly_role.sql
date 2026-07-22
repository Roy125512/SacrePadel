-- Rol de solo lectura para conectar herramientas externas (Excel, Google
-- Sheets, contabilidad, etc.) sin exponer la llave de administrador de la
-- app. Solo puede hacer SELECT — nunca INSERT/UPDATE/DELETE — y solo ve las
-- tablas de negocio útiles para reportes (no profiles/auth, que tienen
-- datos personales ligados a cuentas de usuario).
-- La contraseña real NO va aquí. Se define/rota con:
--   ALTER ROLE reporting_readonly WITH PASSWORD '<password>';
-- corrido a mano en el SQL Editor de Supabase, y se guarda solo en
-- .env.local (REPORTING_READONLY_PASSWORD) y en la conexión de quien
-- administre reportes (ver docs/reporting-access.md).
CREATE ROLE reporting_readonly WITH LOGIN PASSWORD 'CHANGE_ME_VIA_ALTER_ROLE';

GRANT CONNECT ON DATABASE postgres TO reporting_readonly;
GRANT USAGE ON SCHEMA public TO reporting_readonly;
GRANT SELECT ON public.bookings, public.customers, public.courts TO reporting_readonly;
