import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { DEMO } from "@/lib/demo/flag";

type Bucket = { count: number; resetAt: number };
type Result = { ok: boolean; retryAfterSeconds?: number };

const buckets = new Map<string, Bucket>();

// Respaldo en memoria: solo para modo demo, o si la base de datos falla
// (mejor un límite local que tumbar las reservas). En Vercel no sirve como
// límite real porque cada instancia tiene su propia memoria.
function memoryRateLimit(key: string, limit: number, windowMs: number): Result {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (bucket.count >= limit) {
    return { ok: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { ok: true };
}

/**
 * Límite de solicitudes compartido entre instancias (tabla rate_limits, ver
 * migrations/009_rate_limits.sql).
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<Result> {
  if (DEMO) return memoryRateLimit(key, limit, windowMs);

  const { data, error } = await supabaseAdmin.rpc("rate_limit_hit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: Math.ceil(windowMs / 1000),
  });

  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) {
    console.error("rateLimit: fallback a memoria", error);
    return memoryRateLimit(key, limit, windowMs);
  }

  return row.allowed ? { ok: true } : { ok: false, retryAfterSeconds: row.retry_after_seconds };
}

export function clientIp(req: Request): string {
  // En Vercel x-real-ip la pone la plataforma; x-forwarded-for puede traer
  // valores inventados por el cliente al inicio de la lista.
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "unknown";
}
