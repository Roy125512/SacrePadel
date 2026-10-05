"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, LayoutDashboard } from "lucide-react";
import TodayAvailability from "@/components/brand/TodayAvailability";
import dynamic from "next/dynamic";
import ContourLines from "@/components/three/ContourLines";

// Three.js solo se descarga en el navegador y después de lo esencial: la
// portada (texto y botón de reservar) nunca espera al 3D.
const PaddleScene = dynamic(() => import("@/components/three/PaddleScene"), { ssr: false });
import { DAY_RATE } from "@/lib/pricing-shared";
import ReservarButton from "@/components/ReservarButton";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

/**
 * Hero de /inicio: "SACRÉ" gigante, una pala de pádel 3D (Three.js) que
 * sigue al cursor y gira con el scroll, curvas de nivel de fondo y los
 * horarios libres de hoy. Si no hay WebGL, se muestra una foto.
 *
 * Because AppHeader hides its nav on /inicio, this Hero renders its own
 * minimal embedded top bar (logo + wordmark left, session-aware account
 * control right) so the landing page is never left without navigation.
 */
export default function Hero() {
  const [hasSession, setHasSession] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);
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

    const { data: sub } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
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

  const word = "SACRÉ";

  return (
    <section className="relative isolate h-[100svh] min-h-[640px] w-full overflow-hidden" style={{ background: "var(--dark)", color: "var(--dark-foreground)" }}>
      <ContourLines />

      {/* Foto de respaldo si el equipo no soporta 3D */}
      {webglFailed && (
        <div className="absolute inset-0">
          <Image src="/images/gallery-court-night.jpg" alt="" fill priority sizes="100vw" className="object-cover opacity-40" />
        </div>
      )}

      {/* Titular gigante detrás de la pala */}
      <h1 className="pointer-events-none absolute inset-x-0 top-1/2 z-0 -translate-y-[56%] select-none text-center">
        <span className="sr-only">Sacré Pádel — canchas de pádel en Pátzcuaro</span>
        <span aria-hidden className="font-display block whitespace-nowrap text-[clamp(5.5rem,25vw,24rem)] font-normal leading-[0.8] tracking-[-0.03em]">
          {word.split("").map((ch, i) => (
            <span key={i} className="letter-mask">
              <span className="letter-rise" style={{ animationDelay: `${0.15 + i * 0.08}s` }}>
                {ch}
              </span>
            </span>
          ))}
        </span>
      </h1>

      {/* Pala 3D */}
      {!webglFailed && (
        <div className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-[1400ms]" style={{ opacity: sceneReady ? 1 : 0 }}>
          <PaddleScene onReady={() => setSceneReady(true)} onFail={() => setWebglFailed(true)} />
        </div>
      )}

      {/* Barra superior */}
      <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-6 px-6 py-6 sm:px-10">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/logo-sacre.png" alt="" width={36} height={36} priority className="h-8 w-8" />
          <span className="text-[0.7rem] font-semibold uppercase tracking-[0.34em]">Sacré Pádel</span>
        </Link>
        <nav className="hidden items-center gap-8 text-[0.7rem] font-medium uppercase tracking-[0.2em] text-[rgba(241,236,227,.7)] md:flex">
          <a href="#el-club" className="transition hover:text-[var(--dark-foreground)]">El club</a>
          <a href="#tarifas" className="transition hover:text-[var(--dark-foreground)]">Tarifas</a>
          <a href="#ubicacion" className="transition hover:text-[var(--dark-foreground)]">Ubicación</a>
          {hasSession ? (
            <>
              {canAccessReception && (
                <Link href="/reception" className="inline-flex items-center gap-1.5 transition hover:text-[var(--dark-foreground)]">
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  Recepción
                </Link>
              )}
              <Link href="/perfil" className="transition hover:text-[var(--dark-foreground)]">
                {displayName ?? "Mi cuenta"}
              </Link>
              <button type="button" onClick={signOut} className="uppercase tracking-[0.2em] text-[rgba(241,236,227,.45)] hover:text-[var(--dark-foreground)]">
                Salir
              </button>
            </>
          ) : (
            <Link href="/login?next=%2Freservar" className="transition hover:text-[var(--dark-foreground)]">
              Iniciar sesión
            </Link>
          )}
        </nav>
        <ReservarButton className="btn-primary !bg-[var(--dark-foreground)] !px-5 !py-3 !text-[var(--dark)] hover:!bg-[var(--brand-highlight)]" align="right">
          Reservar
        </ReservarButton>
      </header>

      {/* Pie de la portada */}
      <div className="absolute inset-x-0 bottom-0 z-20 grid gap-8 px-6 pb-8 sm:px-10 md:grid-cols-[1fr_auto] md:items-end">
        <div className="max-w-md">
          <p className="text-[0.7rem] uppercase tracking-[0.3em] text-[var(--brand-highlight)]">Pátzcuaro, Michoacán</p>
          <p className="font-display mt-4 text-[clamp(1.6rem,2.4vw,2.2rem)] leading-[1.1]">
            Cuatro canchas de cristal frente a los cerros.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-6">
            <ReservarButton className="btn-primary !bg-[var(--dark-foreground)] !text-[var(--dark)] hover:!bg-[var(--brand-highlight)]">
              Reservar cancha
              <ArrowRight className="h-4 w-4" />
            </ReservarButton>
            <a href="#tarifas" className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[rgba(241,236,227,.8)] underline decoration-[var(--brand-highlight)] underline-offset-[10px]">
              Desde ${DAY_RATE} la hora
            </a>
          </div>
        </div>
        <div className="md:text-right">
          <TodayAvailability dark />
        </div>
      </div>
    </section>
  );
}
