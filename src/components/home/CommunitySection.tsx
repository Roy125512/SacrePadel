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
        {/* Photos — two overlapping shots instead of one, so it reads as a
            real moment (candid laugh) plus a second beat (the greeting),
            not a single posed stock-style photo. */}
        <div className="relative order-last aspect-[4/3] lg:order-first">
          <div className="absolute inset-0 right-10 overflow-hidden rounded-3xl shadow-2xl">
            <Image
              src="/images/community-players-laughing.jpg"
              alt="Jugadores de la comunidad Sacré riendo junto a la red"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-[rgba(30,20,14,0.35)] to-transparent" />
          </div>
          <div className="absolute bottom-[-1.5rem] right-0 h-2/5 w-1/2 overflow-hidden rounded-2xl border-4 border-[var(--dark)] shadow-2xl">
            <Image
              src="/images/community-players-fistbump.jpg"
              alt="Jugadores saludándose después de un partido"
              fill
              sizes="(max-width: 1024px) 50vw, 25vw"
              className="object-cover"
            />
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
            ligas, eventos y promociones. Aquí siempre hay con quién jugar. 🎾
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
