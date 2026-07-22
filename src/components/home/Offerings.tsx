"use client";

import { useScrollReveal } from "@/hooks/useScrollReveal";

const WHATSAPP_NUMBER = "5214341168095";

const OFFERINGS = [
  {
    title: "Ligas y torneos",
    body: "Competencia organizada por niveles, para que midas tu juego contra la comunidad.",
  },
  {
    title: "Clases con entrenador",
    body: "Sesiones para mejorar tu técnica, desde principiante hasta nivel competitivo.",
  },
  {
    title: "Eventos privados",
    body: "Renta la cancha para tu grupo, empresa o celebración.",
  },
];

function waLink(offering: string) {
  const text = `Hola, me interesa saber más sobre "${offering}" en Sacré Pádel.`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

export default function Offerings() {
  const revealRef = useScrollReveal<HTMLDivElement>();

  return (
    <section id="proximamente" className="section-court relative w-full scroll-mt-16 overflow-hidden py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-xl">
          <span className="flex items-center gap-3 text-[0.7rem] font-semibold uppercase tracking-[0.32em] text-[rgba(246,240,230,0.75)]">
            <span aria-hidden className="h-px w-10 bg-[rgba(246,240,230,0.6)]" />
            Más allá de la reserva
          </span>
          <h2 className="font-display mt-5 text-4xl leading-[1.02] sm:text-6xl">
            <span className="font-light italic">Esto es</span>{" "}
            <span className="font-black">lo que viene.</span>
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-[rgba(246,240,230,0.82)]">
            Sacré está creciendo. Aquí va lo que estamos preparando además de
            la reserva libre de cancha.
          </p>
        </div>

        <div
          ref={revealRef}
          className="reveal mt-14 grid grid-cols-1 gap-x-10 gap-y-10 border-t border-[rgba(246,240,230,0.18)] sm:grid-cols-3"
        >
          {OFFERINGS.map((o, i) => (
            <div
              key={o.title}
              className="border-b border-[rgba(246,240,230,0.18)] pb-8 pt-8 sm:border-b-0 sm:pt-10"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <span className="inline-block rounded-full border border-[rgba(246,240,230,0.35)] px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[rgba(246,240,230,0.85)]">
                Próximamente
              </span>
              <h3 className="font-display mt-4 text-2xl font-semibold leading-tight sm:text-3xl">
                {o.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[rgba(246,240,230,0.78)]">
                {o.body}
              </p>
              <a
                href={waLink(o.title)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--dark-foreground)] underline decoration-[rgba(246,240,230,0.4)] underline-offset-4 transition hover:decoration-[rgba(246,240,230,0.9)]"
              >
                Avísenme cuando esté listo
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
