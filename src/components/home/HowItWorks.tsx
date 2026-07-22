"use client";

import { useScrollReveal } from "@/hooks/useScrollReveal";

const STEPS = [
  {
    title: "Elige tu horario",
    body: "Fecha, cancha y hora disponible. Los bloques se muestran cada 30 minutos.",
  },
  {
    title: "Reserva y paga",
    body: "Con tarjeta en línea, o aparta y liquida en recepción cuando llegues.",
  },
  {
    title: "A jugar",
    body: "Llega 15 minutos antes, calienta y adueñate de la cancha.",
  },
];

export default function HowItWorks() {
  const revealRef = useScrollReveal<HTMLDivElement>();

  return (
    <section
      id="como-reservar"
      className="section-court cut-top relative w-full scroll-mt-16 overflow-hidden pb-24 pt-28 sm:pb-32 sm:pt-36"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-xl">
          <span className="flex items-center gap-3 text-[0.7rem] font-semibold uppercase tracking-[0.32em] text-[rgba(246,240,230,0.75)]">
            <span aria-hidden className="h-px w-10 bg-[rgba(246,240,230,0.6)]" />
            Reservar toma segundos
          </span>
          <h2 className="font-display mt-5 text-4xl leading-[1.02] sm:text-6xl">
            <span className="font-light italic">Tres pasos</span>{" "}
            <span className="font-black">y estás dentro.</span>
          </h2>
        </div>

        <div
          ref={revealRef}
          className="reveal mt-16 grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-3"
        >
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className={[
                "relative",
                // staggered vertical offset so it's not three equal columns
                i === 1 ? "sm:translate-y-10" : "",
                i === 2 ? "sm:translate-y-20" : "",
              ].join(" ")}
            >
              <span
                aria-hidden
                className="font-display block text-[6rem] font-black leading-[0.8] tracking-tighter sm:text-[8rem]"
                style={{ color: "rgba(246,240,230,0.22)" }}
              >
                {i + 1}
              </span>
              <h3 className="font-display -mt-4 text-2xl font-semibold sm:text-3xl">
                {s.title}
              </h3>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-[rgba(246,240,230,0.8)]">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
