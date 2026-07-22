"use client";

import { useScrollReveal } from "@/hooks/useScrollReveal";

const FEATURES = [
  {
    title: "Luz de torneo",
    body: "Reflectores de alto rendimiento: la noche se juega con la misma visibilidad que el mediodía.",
  },
  {
    title: "Cancha panorámica",
    body: "Cristales completos y superficie rápida y pareja. Rebote limpio, juego serio.",
  },
  {
    title: "El paisaje de fondo",
    body: "En el corazón de Pátzcuaro, con el cerro y el cielo michoacano detrás de cada punto.",
  },
  {
    title: "Siempre hay partido",
    body: "Jugadores de todos los niveles, ligas y eventos. Aquí nunca te falta con quién jugar.",
  },
];

export default function ValueProps() {
  const revealRef = useScrollReveal<HTMLOListElement>();

  return (
    <section
      id="value-props"
      className="w-full scroll-mt-20 bg-[var(--background)] py-24 sm:py-32"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-12">
          {/* Intro column — deliberately off to one side, no eyebrow-then-grid */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 lg:self-start">
            <h2 className="font-display text-4xl leading-[1.02] sm:text-5xl">
              <span className="font-light italic">No es solo</span>
              <br />
              <span className="font-black">una cancha.</span>
            </h2>
            <p className="mt-6 max-w-sm text-base leading-relaxed text-[var(--muted)]">
              Cuatro razones por las que Sacré se juega distinto. Sin adornos:
              esto es lo que encuentras al llegar.
            </p>
            <div
              aria-hidden
              className="mt-8 h-1 w-24 bg-[var(--court)]"
            />
          </div>

          {/* Numbered ledger — hairline rules, giant serif numerals, no cards */}
          <ol ref={revealRef} className="reveal lg:col-span-7">
            {FEATURES.map((f, i) => (
              <li
                key={f.title}
                className="grid grid-cols-[auto_1fr] items-baseline gap-x-5 border-t border-[rgba(120,46,21,0.15)] py-7 first:border-t-0 sm:gap-x-8"
              >
                <span className="font-display text-5xl font-light leading-none text-[var(--court)] sm:text-6xl">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="font-display text-2xl font-semibold leading-tight sm:text-3xl">
                    {f.title}
                  </h3>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--muted)] sm:text-base">
                    {f.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
