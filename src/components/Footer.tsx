import Image from "next/image";
import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import ReservarButton from "@/components/ReservarButton";

// lucide-react dropped brand marks in recent versions, so the social icons
// are inlined here as small self-contained SVGs.
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="section-dark w-full border-t border-[rgba(246,240,230,0.08)]">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/logo-sacre.png"
                alt="Sacré Pádel"
                width={44}
                height={44}
                className="drop-shadow-md"
              />
              <span className="text-sm font-semibold tracking-[0.28em]">
                SACRÉ PÁDEL
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-[rgba(246,240,230,0.7)]">
              Donde el juego se hace sagrado. Reserva tu cancha y únete a la
              comunidad Sacré. 🎾
            </p>

            <div className="mt-5 flex items-center gap-3">
              <a
                href="https://instagram.com/sacrepadel.patz"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram de Sacré Pádel"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(246,240,230,0.2)] transition hover:border-[rgba(246,240,230,0.6)] hover:bg-[rgba(246,240,230,0.08)]"
              >
                <InstagramIcon className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(246,240,230,0.55)]">
              Navegación
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link
                  href="/inicio"
                  className="text-[rgba(246,240,230,0.8)] transition hover:text-[var(--dark-foreground)]"
                >
                  Inicio
                </Link>
              </li>
              <li>
                <ReservarButton className="text-[rgba(246,240,230,0.8)] transition hover:text-[var(--dark-foreground)]">
                  Reservar
                </ReservarButton>
              </li>
              <li>
                <Link
                  href="/perfil"
                  className="text-[rgba(246,240,230,0.8)] transition hover:text-[var(--dark-foreground)]"
                >
                  Perfil
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(246,240,230,0.55)]">
              Contacto
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-[rgba(246,240,230,0.8)]">
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-highlight)]" />
                <span>Pátzcuaro, Michoacán, México</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-highlight)]" />
                <a
                  href="mailto:sacrepadelpatz@gmail.com"
                  className="break-all transition hover:text-[var(--dark-foreground)]"
                >
                  sacrepadelpatz@gmail.com
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-highlight)]" />
                <a
                  href="tel:+5214341168095"
                  className="transition hover:text-[var(--dark-foreground)]"
                >
                  +52 1 434 116 8095
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom line */}
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-[rgba(246,240,230,0.08)] pt-6 text-xs text-[rgba(246,240,230,0.5)] sm:flex-row">
          <p>© {year} Sacré Pádel. Todos los derechos reservados.</p>
          <p className="font-display text-sm italic text-[rgba(246,240,230,0.7)]">
            Donde el juego se hace sagrado.
          </p>
        </div>
      </div>
    </footer>
  );
}
