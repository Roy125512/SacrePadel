"use client";

import Image from "next/image";
import { MapPin, Phone, Clock, Navigation } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { WHATSAPP_PHONE } from "@/components/WhatsAppButton";

const WHATSAPP_LOCATION_LINK = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(
  "Hola, tengo una pregunta sobre Sacré Pádel."
)}`;

// lucide-react dropped brand marks in recent versions — same inline icon
// used in Footer.tsx.
function InstagramIcon({ className, color }: { className?: string; color?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? "currentColor"}
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

// Coordenadas exactas del club — se usan directo (en vez de dejar que Google
// geocodifique la dirección de texto) porque el registro del negocio en
// Maps todavía no tiene la calle bien marcada; así el pin y las
// indicaciones siempre caen en el lugar correcto aunque eso no esté resuelto.
const LAT = 19.521693;
const LNG = -101.617116;
const ADDRESS = "C. Narciso Servín 100, Santo Tomas, 61607 Pátzcuaro, Mich.";

const MAP_EMBED_SRC = `https://maps.google.com/maps?q=${LAT},${LNG}&z=16&output=embed`;
const DIRECTIONS_HREF = `https://www.google.com/maps/dir/?api=1&destination=${LAT},${LNG}`;

export default function LocationSection() {
  const revealRef = useScrollReveal<HTMLDivElement>();

  return (
    <section
      id="ubicacion"
      className="section-dark cut-top relative w-full overflow-hidden py-24 sm:py-32"
    >
      {/* Full-bleed photo background */}
      <Image
        src="/images/gallery-court-night.jpg"
        alt="Cancha Sacré Pádel iluminada de noche"
        fill
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[rgba(20,14,10,0.92)] via-[rgba(20,14,10,0.75)] to-[rgba(20,14,10,0.35)] sm:to-[rgba(20,14,10,0.55)]" />

      <div
        ref={revealRef}
        className="reveal relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-6 lg:grid-cols-2"
      >
        {/* Copy + contacto */}
        <div className="max-w-xl">
          <span className="flex items-center gap-3 text-[0.7rem] font-semibold uppercase tracking-[0.32em] text-[var(--brand-highlight)]">
            <span aria-hidden className="h-px w-10 bg-[var(--brand-highlight)]" />
            Cómo llegar
          </span>
          <h2 className="font-display mt-5 text-4xl leading-[1.03] sm:text-6xl">
            <span className="font-light italic">Encuéntranos</span>
            <br />
            <span className="font-black">en Pátzcuaro.</span>
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-[rgba(246,240,230,0.82)]">
            Frente a las montañas, a unos minutos del centro. Dale a
            &ldquo;Cómo llegar&rdquo; y Google Maps te lleva directo a la
            cancha.
          </p>

          <div className="mt-8 space-y-4">
            <a
              href={DIRECTIONS_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 text-[rgba(246,240,230,0.92)] transition hover:text-white"
            >
              <span className="chip mt-0.5 h-9 w-9 shrink-0">
                <MapPin className="h-4 w-4" color="var(--brand-700)" />
              </span>
              <span className="pt-1.5">{ADDRESS}</span>
            </a>

            <a
              href="tel:+5214341168095"
              className="flex items-center gap-3 text-[rgba(246,240,230,0.92)] transition hover:text-white"
            >
              <span className="chip h-9 w-9 shrink-0">
                <Phone className="h-4 w-4" color="var(--brand-700)" />
              </span>
              +52 1 434 116 8095
            </a>

            <div className="flex items-start gap-3 text-[rgba(246,240,230,0.92)]">
              <span className="chip mt-0.5 h-9 w-9 shrink-0">
                <Clock className="h-4 w-4" color="var(--brand-700)" />
              </span>
              <span className="pt-1.5">Lunes a Domingo de 07:00 a 22:00 hrs.</span>
            </div>

            <a
              href="https://instagram.com/sacrepadel.patz"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 text-[rgba(246,240,230,0.92)] transition hover:text-white"
            >
              <span className="chip h-9 w-9 shrink-0">
                <InstagramIcon className="h-4 w-4" color="var(--brand-700)" />
              </span>
              @sacrepadel.patz
            </a>
          </div>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href={DIRECTIONS_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline-light group inline-flex items-center px-6 py-3 text-base"
            >
              Cómo llegar
              <Navigation className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
            <a
              href={WHATSAPP_LOCATION_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-flex items-center px-6 py-3 text-base"
            >
              Contactar por WhatsApp
            </a>
          </div>
        </div>

        {/* Mapa */}
        <div className="overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
          <iframe
            title="Ubicación de Sacré Pádel en el mapa"
            src={MAP_EMBED_SRC}
            width="100%"
            height="420"
            style={{ border: 0, display: "block" }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </section>
  );
}
