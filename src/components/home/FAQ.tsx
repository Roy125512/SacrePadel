"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { DAY_RATE, EVENING_RATE, SWITCH_HOUR } from "@/lib/pricing-shared";

const QUESTIONS = [
  {
    q: "¿Cuánto tiempo de tolerancia tengo si llego tarde?",
    a: "15 minutos a partir de la hora de tu reserva. Después de ese tiempo la cancha puede liberarse para otro jugador.",
  },
  {
    q: "¿Cómo puedo pagar?",
    a: `En línea con tarjeta al momento de reservar, o en recepción (efectivo o tarjeta) al llegar al club. El precio depende del horario: $${DAY_RATE} MXN/hora antes de las ${SWITCH_HOUR}:00 y $${EVENING_RATE} MXN/hora después.`,
  },
  {
    q: "¿Necesito crear una cuenta para reservar?",
    a: "No. Puedes reservar como invitado llenando tus datos cada vez, o crear una cuenta gratis para guardar tu información, ver tu historial y enterarte primero de promociones.",
  },
  {
    q: "¿Cuál es la duración mínima de una reserva?",
    a: "60 minutos. Los horarios se muestran en intervalos de 30 minutos y eliges la duración exacta después de seleccionar el horario de inicio.",
  },
  {
    q: "¿Puedo cambiar o cancelar mi reserva?",
    a: "Sí, escríbenos o llámanos al +52 1 434 116 8095 y con gusto te ayudamos a hacer el cambio.",
  },
];

export default function FAQ() {
  const revealRef = useScrollReveal<HTMLDivElement>();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="w-full scroll-mt-16 bg-[var(--background)] py-24 sm:py-32">
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-x-14 gap-y-10 px-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <h2 className="font-display text-4xl leading-[1.02] sm:text-5xl">
            <span className="font-light italic">Antes de</span>
            <br />
            <span className="font-black">reservar.</span>
          </h2>
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-[var(--muted)]">
            Lo que casi todos preguntan. Si te queda otra duda, escríbenos al
            +52 1 434 116 8095.
          </p>
        </div>

        <div ref={revealRef} className="reveal border-t border-[rgba(120,46,21,0.15)]">
          {QUESTIONS.map((item, i) => {
            const open = openIndex === i;
            return (
              <div key={item.q} className="border-b border-[rgba(120,46,21,0.15)]">
                <button
                  type="button"
                  onClick={() => setOpenIndex(open ? null : i)}
                  aria-expanded={open}
                  className="flex w-full items-start justify-between gap-5 py-5 text-left"
                >
                  <span className="font-display text-lg font-medium leading-snug text-[var(--foreground)] sm:text-xl">
                    {item.q}
                  </span>
                  <ChevronDown
                    className={`mt-1 h-5 w-5 shrink-0 text-[var(--court)] transition-transform duration-300 ${
                      open ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <div
                  className={`grid transition-all duration-300 ease-in-out ${
                    open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="max-w-lg pb-6 pr-8 text-sm leading-relaxed text-[var(--muted)]">
                      {item.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
