/** Mensaje legible de un error de tipo desconocido (lo que llega a un `catch`). */
export function errorMessage(e: unknown, fallback = "Error"): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === "object" && e !== null && "message" in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}
