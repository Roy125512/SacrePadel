type LoadingRacketProps = {
  /** Texto debajo de la animación. Pasa `null` para no mostrar ninguno. */
  label?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

/** Indicador de carga: una pala de pádel golpeando la pelota en loop.
 * Reemplaza los "Cargando…" de texto plano por algo con más personalidad
 * de marca. Ver las clases `.racket-loader*` y sus @keyframes en globals.css. */
export default function LoadingRacket({
  label = "Cargando…",
  size = "md",
  className = "",
}: LoadingRacketProps) {
  return (
    <div className={`racket-loader racket-loader--${size} ${className}`}>
      <div className="racket-loader__scene">
        <div className="racket-loader__shadow" />
        <div className="racket-loader__ball" />
        <svg
          className="racket-loader__paddle"
          viewBox="0 0 44 70"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <rect x="18" y="48" width="8" height="20" rx="4" fill="var(--brand-700)" />
          <rect x="16" y="44" width="12" height="8" rx="3" fill="var(--brand-800)" />
          <ellipse cx="22" cy="25" rx="21" ry="26" fill="var(--brand)" stroke="var(--brand-700)" strokeWidth="2" />
          <circle cx="22" cy="10" r="1.6" fill="rgba(255,255,255,0.4)" />
          <circle cx="14" cy="15" r="1.6" fill="rgba(255,255,255,0.4)" />
          <circle cx="30" cy="15" r="1.6" fill="rgba(255,255,255,0.4)" />
          <circle cx="9" cy="24" r="1.6" fill="rgba(255,255,255,0.4)" />
          <circle cx="22" cy="24" r="1.6" fill="rgba(255,255,255,0.4)" />
          <circle cx="35" cy="24" r="1.6" fill="rgba(255,255,255,0.4)" />
          <circle cx="14" cy="33" r="1.6" fill="rgba(255,255,255,0.4)" />
          <circle cx="30" cy="33" r="1.6" fill="rgba(255,255,255,0.4)" />
          <circle cx="22" cy="40" r="1.6" fill="rgba(255,255,255,0.4)" />
        </svg>
      </div>
      {label !== null && <p className="racket-loader__label">{label}</p>}
    </div>
  );
}
