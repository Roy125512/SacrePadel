-- El rol reporting_readonly (003_reporting_readonly_role.sql) tiene GRANT
-- SELECT a nivel de tabla, pero bookings/customers/courts tienen Row Level
-- Security activado SIN políticas para él — con RLS activo, ninguna fila se
-- muestra a menos que una política lo permita explícitamente. Estas
-- políticas le dan acceso de solo lectura a todas las filas de esas 3
-- tablas (siguen sin poder escribir nada — eso lo bloquea el GRANT, no RLS).
CREATE POLICY reporting_readonly_select_bookings
  ON public.bookings FOR SELECT
  TO reporting_readonly
  USING (true);

CREATE POLICY reporting_readonly_select_customers
  ON public.customers FOR SELECT
  TO reporting_readonly
  USING (true);

CREATE POLICY reporting_readonly_select_courts
  ON public.courts FOR SELECT
  TO reporting_readonly
  USING (true);
