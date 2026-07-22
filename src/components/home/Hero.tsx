"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ChevronDown, LayoutDashboard } from "lucide-react";
import ReservarButton from "@/components/ReservarButton";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

/**
 * Hero — full-bleed golden-hour section for /inicio.
 *
 * Because AppHeader hides its nav on /inicio, this Hero renders its own
 * minimal embedded top bar (logo + wordmark left, session-aware account
 * control right) so the landing page is never left without navigation.
 */
export default function Hero() {
  const [hasSession, setHasSession] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const canAccessReception = role === "owner" || role === "reception";

  async function loadProfile(userId: string, email: string | null) {
    const { data } = await supabaseBrowser
      .from("profiles")
      .select("full_name, role")
      .eq("id", userId)
      .maybeSingle();
    const first = data?.full_name?.trim()?.split(" ")[0];
    setDisplayName(first || (email ? email.split("@")[0] : "Mi cuenta"));
    setRole((data?.role as string) ?? null);
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      if (!mounted) return;
      const user = data.session?.user ?? null;
      setHasSession(!!user);
      if (user) void loadProfile(user.id, user.email ?? null);
    })();

    const { data: sub } = supabaseBrowser.auth.onAuthStateChange((_event: string, session: any) => {
      setHasSession(!!session?.user);
      if (session?.user) void loadProfile(session.user.id, session.user.email ?? null);
      else {
        setDisplayName(null);
        setRole(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await supabaseBrowser.auth.signOut();
    setHasSession(false);
    setDisplayName(null);
    setRole(null);
  }

  return (
    <section className="section-dark relative isolate min-h-[100svh] w-full overflow-hidden">
      {/* Background photo */}
      <Image
        src="/images/hero-golden-hour.jpg"
        alt="Cancha de pádel Sacré al atardecer en Pátzcuaro"
        fill
        priority
        sizes="100vw"
        className="object-cover object-top"
      />

      {/* Readability gradient */}
      <div className="hero-overlay" />

      {/* Embedded top bar */}
      <div className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo-sacre.png"
              alt="Sacré Pádel"
              width={40}
              height={40}
              priority
              className="drop-shadow-md"
            />
            <span className="text-xs font-semibold tracking-[0.28em] text-[var(--dark-foreground)]">
              SACRÉ PÁDEL
            </span>
          </Link>

          {hasSession ? (
            <div className="flex items-center gap-3 sm:gap-4">
              <Link
                href="/perfil"
                className="hidden text-xs font-medium tracking-wide text-[rgba(246,240,230,0.85)] transition hover:text-[var(--dark-foreground)] sm:inline"
              >
                Hola, {displayName ?? "…"}
              </Link>
              {canAccessReception && (
                <Link
                  href="/reception"
                  className="btn-primary flex items-center gap-1.5 px-3 py-2 text-xs sm:px-4 sm:text-sm"
                >
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  Recepción
                </Link>
              )}
              <button
                type="button"
                onClick={signOut}
                className="btn-outline-light text-xs sm:text-sm"
              >
                Cerrar sesión
              </button>
            </div>
          ) : (
            <Link
              href="/login?next=%2Freservar"
              className="btn-outline-light text-xs sm:text-sm"
            >
              Iniciar sesión
            </Link>
          )}
        </div>
      </div>

      {/* Hero content */}
      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-center px-6 pb-24 pt-28">
        <div className="max-w-2xl">
          <span className="flex items-center gap-3 text-[0.7rem] font-semibold uppercase tracking-[0.32em] text-[rgba(246,240,230,0.85)]">
            <span aria-hidden className="h-px w-10 bg-[var(--brand-highlight)]" />
            Pátzcuaro · Michoacán
          </span>

          <h1 className="font-display mt-6 text-[3.25rem] leading-[0.95] text-[var(--dark-foreground)] sm:text-7xl md:text-[5.5rem]">
            <span className="block font-light italic tracking-tight text-[rgba(246,240,230,0.92)]">
              Donde el juego
            </span>
            <span className="mt-1 block">
              <span className="font-light italic tracking-tight text-[rgba(246,240,230,0.92)]">
                se hace{" "}
              </span>
              <span className="font-black tracking-[-0.02em] text-[var(--brand-highlight)]">
                sagrado
              </span>
            </span>
          </h1>

          <p className="mt-7 max-w-xl text-lg leading-relaxed text-[rgba(246,240,230,0.85)] sm:text-xl">
            Una cancha panorámica frente a las montañas de Pátzcuaro. Reserva de
            día o de noche, con luz de torneo, y entra a la comunidad Sacré.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <ReservarButton className="btn-primary group px-6 py-3 text-base">
              Reservar ahora
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </ReservarButton>

            <a href="#value-props" className="btn-outline-light px-6 py-3 text-base">
              Conocer más
            </a>
          </div>
        </div>
      </div>

      {/* Scroll hint */}
      <a
        href="#value-props"
        aria-label="Desplázate hacia abajo"
        className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-[var(--dark-foreground)]/70 transition hover:text-[var(--dark-foreground)]"
      >
        <ChevronDown className="h-7 w-7 animate-bounce" />
      </a>
    </section>
  );
}
