"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

export default function CommunitySection() {
  const revealRef = useScrollReveal<HTMLDivElement>();

  return (
    <section className="section-dark relative w-full overflow-hidden pb-20 pt-28 sm:pb-28 sm:pt-36">
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
            <div className="relative col-span-2 h-64 overflow-hidden sm:h-80 lg:col-span-3 lg:h-80">
              <Image
                src="/images/community-players-laughing.jpg"
                alt="Jugadores de la comunidad Sacré riendo junto a la red"
                fill
                sizes="(max-width: 1024px) 100vw, 900px"
                className="object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-[rgba(30,20,14,0.35)] to-transparent" />
            </div>

            <div className="relative h-40 overflow-hidden sm:h-48 lg:h-48">
              <Image
                src="/images/community-players-net.jpg"
                alt="Jugadores conviviendo junto a la red después de un partido"
                fill
                sizes="(max-width: 1024px) 50vw, 300px"
                className="object-cover"
                style={{ objectPosition: "50% 30%" }}
              />
            </div>

            <div className="relative h-40 overflow-hidden sm:h-48 lg:h-48">
              <Image
                src="/images/community-players-fistbump.jpg"
                alt="Jugadores saludándose después de un partido"
                fill
                sizes="(max-width: 1024px) 50vw, 300px"
                className="object-cover"
              />
            </div>

            <div className="relative col-span-2 h-44 overflow-hidden sm:h-48 lg:col-span-1 lg:h-48">
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
          <h2 className="font-display mt-5 text-[clamp(2.4rem,4.6vw,3.6rem)] leading-[1.02]">Aquí se arman las retas.</h2>
          <p className="mt-6 text-lg leading-relaxed text-[rgba(246,240,230,0.82)]">
            Con cuenta reservas en segundos: tus datos quedan guardados, ves tu
            historial y te avisamos primero de ligas, torneos y promociones.
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
