"use client";

import Image from "next/image";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const FEATURES = [
  {
    title: "Iluminación de torneo",
    body: "Reflectores LED profesionales de alta potencia que eliminan sombras y deslumbramiento nocturno.",
    image: "/images/gallery-sunset-light-pole.jpg",
    alt: "Reflector de torneo encendido sobre la cancha al atardecer",
    focus: "70% 30%",
  },
  {
    title: "Cristal panorámico",
    body: "Módulos de cristal templado sin postes intermedios para una visibilidad completa y un rebote fiel.",
    image: "/images/gallery-fence-mesh.jpg",
    alt: "Detalle del cristal y la malla perimetral de la cancha",
    focus: "50% 50%",
  },
  {
    title: "Superficie profesional",
    body: "Césped sintético de última generación con compactación balanceada para desplazamientos rápidos y seguros.",
    image: "/images/gallery-racket-balls-top.jpg",
    alt: "Pala y pelotas sobre el césped sintético de la cancha",
    focus: "50% 35%",
  },
  {
    title: "Entorno privado",
    body: "Una atmósfera reservada y tranquila, ideal para enfocarte en tu rendimiento y el de tu grupo.",
    image: "/images/gallery-two-courts-mountain.jpg",
    alt: "Canchas Sacré con los cerros de Pátzcuaro de fondo",
    focus: "50% 60%",
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
              <span className="font-light italic">Diseñada para jugar</span>
              <br />
              <span className="font-black">con precisión.</span>
            </h2>
            <p className="mt-6 max-w-sm text-base leading-relaxed text-[var(--muted)]">
              Cuatro pilares técnicos pensados para garantizar un juego
              dinámico, continuo y sin distracciones:
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
                className="group grid grid-cols-[auto_1fr] items-center gap-x-5 gap-y-5 border-t border-[rgba(120,46,21,0.15)] py-7 first:border-t-0 sm:grid-cols-[auto_1fr_auto] sm:gap-x-8"
              >
                <span className="font-display self-start text-5xl font-light leading-none text-[var(--court)] sm:self-center sm:text-6xl">
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
                <div className="relative col-span-2 h-44 w-full overflow-hidden rounded-md shadow-[0_10px_30px_rgba(30,27,24,0.12)] sm:col-span-1 sm:h-28 sm:w-28 sm:shrink-0 lg:h-32 lg:w-32">
                  <Image
                    src={f.image}
                    alt={f.alt}
                    fill
                    sizes="(max-width: 640px) 100vw, 128px"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    style={{ objectPosition: f.focus }}
                  />
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
