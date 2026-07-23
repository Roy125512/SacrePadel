"use client";

import ReservarButton from "@/components/ReservarButton";

const LINKS = [
  { href: "#value-props", label: "Beneficios" },
  { href: "#como-reservar", label: "Cómo reservar" },
  { href: "#galeria", label: "Galería" },
  { href: "#precios", label: "Precios" },
  { href: "#proximamente", label: "Próximamente" },
  { href: "#faq", label: "Preguntas" },
  { href: "#ubicacion", label: "Ubicación" },
];

export default function SectionNav() {
  return (
    <nav className="sticky top-0 z-30 w-full border-b border-[rgba(120,46,21,0.12)] bg-[var(--background)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-2.5 sm:gap-2 sm:px-6">
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--brand-50)] hover:text-[var(--brand-700)]"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="ml-auto shrink-0">
          <ReservarButton className="btn-primary px-4 py-1.5 text-sm" align="right">
            Reservar
          </ReservarButton>
        </div>
      </div>
    </nav>
  );
}
