-- Límite de solicitudes compartido entre todas las instancias del servidor.
--
-- Antes vivía en memoria (src/lib/rateLimit.ts): en Vercel cada instancia
-- serverless tiene su propia memoria y se recicla seguido, así que en la
-- práctica no frenaba a nadie. Aquí el contador vive en la base de datos y
-- se incrementa de forma atómica.

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key      text PRIMARY KEY,
  count    integer NOT NULL,
  reset_at timestamptz NOT NULL
);

-- Solo el servidor (service_role, que ignora RLS) la toca. RLS sin
-- políticas = cero acceso desde el navegador.
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Registra un intento para `p_key` y regresa si todavía está dentro del
-- límite. Una sola sentencia (INSERT ... ON CONFLICT) para que dos
-- solicitudes simultáneas no se salten el conteo.
CREATE OR REPLACE FUNCTION public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
RETURNS TABLE (allowed boolean, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_reset timestamptz;
BEGIN
  INSERT INTO rate_limits AS r (key, count, reset_at)
  VALUES (p_key, 1, now() + make_interval(secs => p_window_seconds))
  ON CONFLICT (key) DO UPDATE
    SET count    = CASE WHEN r.reset_at <= now() THEN 1 ELSE r.count + 1 END,
        reset_at = CASE WHEN r.reset_at <= now() THEN now() + make_interval(secs => p_window_seconds) ELSE r.reset_at END
  RETURNING r.count, r.reset_at INTO v_count, v_reset;

  -- Limpieza ocasional de contadores viejos (~1 de cada 100 llamadas).
  IF random() < 0.01 THEN
    DELETE FROM rate_limits WHERE reset_at < now() - interval '1 day';
  END IF;

  RETURN QUERY SELECT v_count <= p_limit,
                      GREATEST(0, ceil(extract(epoch FROM v_reset - now())))::integer;
END;
$$;

-- Nadie más que el servidor puede llamarla (si no, cualquiera podría
-- llenar la tabla o bloquear la llave de otra IP).
REVOKE ALL ON FUNCTION public.rate_limit_hit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(text, integer, integer) TO service_role;
