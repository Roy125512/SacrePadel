import Image from "next/image";
import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import ReservarButton from "@/components/ReservarButton";
import { WHATSAPP_PHONE } from "@/components/WhatsAppButton";

const WHATSAPP_FOOTER_LINK = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(
  "Hola, tengo una pregunta sobre Sacré Pádel."
)}`;

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

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2zm5.8 14.02c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.11.11-1.79-.11a16.6 16.6 0 0 1-1.63-.6c-2.87-1.24-4.74-4.13-4.88-4.32-.14-.19-1.17-1.56-1.17-2.97 0-1.41.74-2.1 1-2.39.26-.29.57-.36.76-.36.19 0 .38 0 .55.01.18.01.41-.07.64.49.24.58.81 2 .88 2.14.07.14.12.31.02.5-.1.19-.15.31-.29.48-.14.17-.3.37-.43.5-.14.14-.29.29-.12.57.17.29.75 1.24 1.62 2.01 1.11.99 2.05 1.3 2.34 1.44.29.14.46.12.63-.07.17-.19.72-.84.92-1.13.19-.29.38-.24.64-.14.26.1 1.66.78 1.94.93.29.14.48.21.55.33.07.12.07.7-.17 1.38z" />
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
                width={60}
                height={60}
                className="h-14 w-14 drop-shadow-md sm:h-[60px] sm:w-[60px]"
              />
              <span className="text-base font-semibold tracking-[0.24em]">
                SACRÉ PÁDEL
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-[rgba(246,240,230,0.7)]">
              Reserva tu cancha y únete a la comunidad Sacré. 🎾
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
              <a
                href={WHATSAPP_FOOTER_LINK}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp de Sacré Pádel"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(246,240,230,0.2)] transition hover:border-[rgba(246,240,230,0.6)] hover:bg-[rgba(246,240,230,0.08)]"
              >
                <WhatsAppIcon className="h-5 w-5" />
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
        <div className="mt-12 border-t border-[rgba(246,240,230,0.08)] pt-6 text-center text-xs text-[rgba(246,240,230,0.5)]">
          <p>© {year} Sacré Pádel. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
