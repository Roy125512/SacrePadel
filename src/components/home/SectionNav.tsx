"use client";

import ReservarButton from "@/components/ReservarButton";

const LINKS = [
  { href: "#el-club", label: "El club" },
  { href: "#tarifas", label: "Tarifas" },
  { href: "#faq", label: "Preguntas" },
  { href: "#galeria", label: "Fotos" },
  { href: "#ubicacion", label: "Cómo llegar" },
];

export default function SectionNav() {
  return (
    <nav className="sticky top-0 z-30 w-full border-b border-[var(--line)] bg-[var(--background)]">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5 sm:px-6">
        {/* en celular los enlaces se deslizan de lado; el botón Reservar queda fijo */}
        <div className="no-scrollbar fade-right flex min-w-0 flex-1 items-center gap-1 overflow-x-auto sm:gap-2">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="shrink-0 whitespace-nowrap px-3 py-1.5 text-[0.7rem] font-medium uppercase tracking-[0.2em] text-[var(--muted)] transition hover:text-[var(--foreground)]"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="shrink-0">
          <ReservarButton className="btn-primary px-4 py-1.5 text-sm" align="right">
            Reservar
          </ReservarButton>
        </div>
      </div>
    </nav>
  );
}
