"use client";

import { Sun, Moon, ArrowRight, Check } from "lucide-react";
import { DAY_RATE, EVENING_RATE, SWITCH_HOUR, PADDLE_RENTAL_PRICE } from "@/lib/pricing-shared";
import ReservarButton from "@/components/ReservarButton";
import { useScrollReveal } from "@/hooks/useScrollReveal";

function fmtHour(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

const PERKS = [
  "Reserva desde 60 minutos",
  "Paga en línea o en recepción",
  "15 min de tolerancia",
];

export default function PricingTeaser() {
  const revealRef = useScrollReveal<HTMLDivElement>();

  return (
    <section id="precios" className="w-full scroll-mt-16 bg-[var(--surface-2)] py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <div className="max-w-xl">
          <span className="flex items-center gap-3 text-[0.7rem] font-semibold uppercase tracking-[0.32em] text-[var(--brand)]">
            <span aria-hidden className="h-px w-10 bg-[var(--brand)]" />
            Tarifas por hora
          </span>
          <h2 className="font-display mt-5 text-4xl leading-[1.02] sm:text-6xl">
            <span className="font-light italic">El precio lo marca</span>{" "}
            <span className="font-black">el reloj.</span>
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-[var(--muted)]">
            Elige tu horario y asegura tu lugar en la cancha.
          </p>
        </div>

        {/* One unified ledger split day / night — not two matching cards */}
        <div
          ref={revealRef}
          className="reveal mt-12 grid grid-cols-1 overflow-hidden rounded-md border border-[rgba(120,46,21,0.15)] shadow-[0_20px_50px_rgba(30,27,24,0.10)] sm:grid-cols-[1fr_1.1fr]"
        >
          {/* Day */}
          <div className="flex flex-col justify-between gap-8 bg-[var(--surface)] p-8 sm:p-10">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              <Sun className="h-4 w-4 text-[var(--brand)]" strokeWidth={2} />
              Día · {fmtHour(7)}–{fmtHour(SWITCH_HOUR)}
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-6xl font-black leading-none text-[var(--foreground)] sm:text-7xl">
                  ${DAY_RATE}
                </span>
                <span className="text-sm font-medium text-[var(--muted)]">
                  MXN / hora
                </span>
              </div>
              <p className="mt-3 text-sm text-[var(--muted)]">
                Mañanas y tardes, con el paisaje a plena luz.
              </p>
            </div>
          </div>

          {/* Night — the court-blue block does the differentiating, no badge */}
          <div className="section-court relative flex flex-col justify-between gap-8 p-8 sm:p-10">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-[rgba(246,240,230,0.85)]">
                <Moon className="h-4 w-4" strokeWidth={2} />
                Noche · {fmtHour(SWITCH_HOUR)}–{fmtHour(22)}
              </div>
              <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[rgba(246,240,230,0.7)]">
                Prime time
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-6xl font-black leading-none sm:text-7xl">
                  ${EVENING_RATE}
                </span>
                <span className="text-sm font-medium text-[rgba(246,240,230,0.85)]">
                  MXN / hora
                </span>
              </div>
              <p className="mt-3 text-sm text-[rgba(246,240,230,0.85)]">
                Bajo los reflectores, cuando la cancha se ve mejor.
              </p>
            </div>
          </div>
        </div>

        {/* Equipo — nota editorial, no una tarjeta con ícono en círculo:
            mismo tono itálica+negrita que los titulares de la página, para
            que se sienta parte del mismo texto y no un bloque de feature
            genérico pegado encima. */}
        <div className="mt-10 border-t border-[rgba(120,46,21,0.15)] pt-8">
          <p className="font-display max-w-xl text-2xl leading-snug sm:text-3xl">
            <span className="font-light italic">¿Sin pala? </span>
            <span className="font-black text-[var(--brand)]">${PADDLE_RENTAL_PRICE} MXN</span>
            <span className="font-light italic"> y te prestamos una.</span>
          </p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--muted)]">
            También vendemos palas y pelotas nuevas para quien quiera
            estrenar — los precios te los damos directo en recepción.
          </p>
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {PERKS.map((p) => (
              <li
                key={p}
                className="flex items-center gap-2 text-sm text-[var(--muted)]"
              >
                <Check className="h-4 w-4 text-[var(--court)]" strokeWidth={2.5} />
                {p}
              </li>
            ))}
          </ul>

          <ReservarButton className="btn-primary group px-6 py-3 text-base">
            Ver disponibilidad y reservar
            <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
          </ReservarButton>
        </div>
      </div>
    </section>
  );
}
