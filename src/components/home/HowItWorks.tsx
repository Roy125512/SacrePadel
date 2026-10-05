"use client";

import { useScrollReveal } from "@/hooks/useScrollReveal";

const STEPS = [
  { n: "I", title: "Elige tu horario", body: "Fecha, cancha y hora. Ves en vivo qué está libre." },
  { n: "II", title: "Aparta y paga", body: "Con tarjeta en línea, o en recepción al llegar." },
  { n: "III", title: "Llega y juega", body: "Tienes quince minutos de tolerancia." },
];

export default function HowItWorks() {
  const revealRef = useScrollReveal<HTMLDivElement>();

  return (
    <section id="como-reservar" className="section-dark scroll-mt-16 py-24 sm:py-32">
      <div ref={revealRef} className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-14">
        <div className="grid gap-12 lg:grid-cols-[1fr_2fr] lg:gap-24">
          <h2 className="font-display text-[clamp(2.2rem,3.8vw,3.4rem)] leading-[1.05]">Reservar toma un minuto.</h2>
          <ol className="grid gap-10 sm:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="border-t pt-6" style={{ borderColor: "rgba(241,236,227,.16)" }}>
                <span className="font-display text-xl italic text-[var(--brand-highlight)]">{s.n}</span>
                <h3 className="mt-4 text-[0.72rem] font-semibold uppercase tracking-[0.2em]">{s.title}</h3>
                <p className="mt-3 leading-relaxed text-[rgba(241,236,227,.65)]">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
