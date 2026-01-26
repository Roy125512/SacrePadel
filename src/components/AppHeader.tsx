"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [loggedIn, setLoggedIn] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const loginToReserveHref = "/login?next=%2Freservar";

  async function loadRole(userId: string) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;
      setRole((data?.role ?? null) as any);
    } catch {
      // Si falla por RLS o red, no rompemos el header.
      setRole(null);
    }
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      const hasSession = Boolean(data.session);
      setLoggedIn(hasSession);

      if (hasSession && data.session?.user?.id) {
        await loadRole(data.session.user.id);
      } else {
        setRole(null);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(Boolean(session));
      if (session?.user?.id) loadRole(session.user.id);
      else setRole(null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  async function signOut() {
    await supabase.auth.signOut();
    setRole(null);
    router.push("/");
    router.refresh();
  }

  const linkClass = (href: string) => {
    const active = pathname === href;
    return [
      "text-sm px-3 py-2 rounded-md border transition",
      active
        ? "border-[rgba(175,78,43,0.35)] bg-[rgba(253,238,232,1)]"
        : "border-[rgba(120,46,21,0.14)] hover:bg-white/80",
    ].join(" ");
  };

  return (
    <header
      className="w-full border-b bg-white/80 backdrop-blur"
      style={{ borderColor: "rgba(120, 46, 21, 0.12)" }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        {/* LOGO + NOMBRE */}
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo-sacre.png"
            alt="Sacré Pádel"
            width={36}
            height={36}
            priority
            className="drop-shadow-sm"
          />
          <span className="text-xs font-semibold tracking-[0.28em] text-black">
            SACRÉ PÁDEL
          </span>
        </Link>

        {/* NAV */}
        <nav className="flex items-center gap-3">
          <Link href="/" className={linkClass("/")}>
            Inicio
          </Link>

          <Link
            href={loggedIn ? "/reservar" : loginToReserveHref}
            className={linkClass("/reservar")}
          >
            Reservar
          </Link>

          <Link href="/perfil" className={linkClass("/perfil")}>
            Perfil
          </Link>

          {/* Acceso rápido a recepción (solo owner / recepción) */}
          {loggedIn && (role === "owner" || role === "reception") && (
            <Link href="/reception" className={linkClass("/reception")}>
              Recepción
            </Link>
          )}

          {loggedIn ? (
            <button onClick={signOut} className="btn-secondary">
              Cerrar sesión
            </button>
          ) : (
            <Link href={loginToReserveHref} className="btn-primary">
              Iniciar sesión
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
