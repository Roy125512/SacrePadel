export class ValidationError extends Error {}

export function friendlyAuthError(e: any): string {
  if (e instanceof ValidationError) return e.message;

  const msg = String(e?.message ?? "").toLowerCase();

  if (e instanceof TypeError || msg.includes("failed to fetch") || msg.includes("network"))
    return "No se pudo conectar. Revisa tu conexión a internet e intenta de nuevo.";
  if (msg.includes("invalid login credentials"))
    return "Correo o contraseña incorrectos.";
  if (msg.includes("email not confirmed"))
    return "Tu correo aún no está confirmado. Revisa tu bandeja de entrada (y spam).";
  if (msg.includes("user already registered") || msg.includes("already registered"))
    return "Ya existe una cuenta con ese correo. Intenta iniciar sesión.";
  if (msg.includes("rate limit"))
    return "Se hicieron demasiados intentos. Espera unos minutos e intenta de nuevo.";
  if (msg.includes("for security purposes"))
    return "Por seguridad, espera unos segundos antes de volver a intentar.";
  if (msg.includes("password should be at least") || msg.includes("password is too short"))
    return "La contraseña es demasiado corta.";
  if (msg.includes("same password") || msg.includes("should be different"))
    return "La nueva contraseña debe ser distinta a la anterior.";
  if (msg.includes("session") && (msg.includes("expired") || msg.includes("invalid") || msg.includes("not found")))
    return "Tu sesión para restablecer la contraseña expiró. Solicita el enlace de nuevo.";

  // Cualquier otro mensaje (texto técnico interno, casi siempre en inglés)
  // se oculta detrás de un mensaje genérico en vez de mostrarse tal cual.
  return "Ocurrió un error. Intenta de nuevo.";
}
