"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

export default function CommunitySection() {
  const revealRef = useScrollReveal<HTMLDivElement>();

  return (
    <section className="section-dark cut-top relative w-full overflow-hidden pb-20 pt-28 sm:pb-28 sm:pt-36">
      <div
        ref={revealRef}
        className="reveal mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-6 lg:grid-cols-2"
      >
        {/* Photos — one wide hero moment on top, three supporting shots in an
            even row underneath. Fixed pixel heights per breakpoint (not
            aspect-ratio/grid-row tricks) so every crop stays a safe,
            predictable landscape/near-square — nothing gets squeezed into an
            extreme sliver. */}
        <div className="order-last lg:order-first">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            <div className="relative col-span-2 h-64 overflow-hidden rounded-3xl shadow-2xl sm:h-80 lg:col-span-3 lg:h-80">
              <Image
                src="/images/community-players-laughing.jpg"
                alt="Jugadores de la comunidad Sacré riendo junto a la red"
                fill
                sizes="(max-width: 1024px) 100vw, 900px"
                className="object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-[rgba(30,20,14,0.35)] to-transparent" />
            </div>

            <div className="relative h-40 overflow-hidden rounded-2xl border-4 border-[var(--dark)] shadow-2xl sm:h-48 lg:h-48">
              <Image
                src="/images/community-players-net.jpg"
                alt="Jugadores conviviendo junto a la red después de un partido"
                fill
                sizes="(max-width: 1024px) 50vw, 300px"
                className="object-cover"
                style={{ objectPosition: "50% 30%" }}
              />
            </div>

            <div className="relative h-40 overflow-hidden rounded-2xl border-4 border-[var(--dark)] shadow-2xl sm:h-48 lg:h-48">
              <Image
                src="/images/community-players-fistbump.jpg"
                alt="Jugadores saludándose después de un partido"
                fill
                sizes="(max-width: 1024px) 50vw, 300px"
                className="object-cover"
              />
            </div>

            <div className="relative col-span-2 h-44 overflow-hidden rounded-2xl border-4 border-[var(--dark)] shadow-2xl sm:h-48 lg:col-span-1 lg:h-48">
              <Image
                src="/images/community-players-duo.jpg"
                alt="Dos jugadores de la comunidad Sacré conviviendo en la cancha"
                fill
                sizes="(max-width: 1024px) 100vw, 300px"
                className="object-cover"
              />
            </div>
          </div>
        </div>

        {/* Copy */}
        <div className="max-w-xl">
          <span className="flex items-center gap-3 text-[0.7rem] font-semibold uppercase tracking-[0.32em] text-[var(--brand-highlight)]">
            <span aria-hidden className="h-px w-10 bg-[var(--brand-highlight)]" />
            La comunidad Sacré
          </span>
          <h2 className="font-display mt-5 text-4xl leading-[1.03] sm:text-6xl">
            <span className="font-light italic">Más que una cancha,</span>
            <br />
            <span className="font-black">una tribu.</span>
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-[rgba(246,240,230,0.82)]">
            En Sacré cada partido es un encuentro. Crea tu cuenta para reservar
            más rápido, guardar tu historial y ser el primero en enterarte de
            ligas, eventos y promociones.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/login?mode=signup&next=%2Fperfil"
              className="btn-primary group px-6 py-3 text-base"
            >
              Crear mi cuenta
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/reservar?mode=guest"
              className="btn-outline-light px-6 py-3 text-base"
            >
              Reservar como invitado
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
