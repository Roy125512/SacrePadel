"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [menuOpen, setMenuOpen] = useState(false);

  // Purely presentational "condensing header" effect — shrinks padding/logo
  // slightly once the page is scrolled. Does not touch any session state.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);


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

    const { data: sub } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      setLoggedIn(Boolean(session));
      if (session?.user?.id) loadRole(session.user.id);
      else setRole(null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);


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

  const isAuthRoute =
    pathname === "/login" ||
    pathname === "/reset-password"; // agrega aquí otras rutas de acceso si tienes

  const hideNavOnThisPage =
    pathname === "/inicio" || isAuthRoute;

  // On /inicio the Hero component renders its own complete embedded top bar
  // (logo + wordmark + "Iniciar sesión"), so showing AppHeader's logo bar on
  // top of it would just duplicate it. Keep it visible on other hidden-nav
  // routes (login/reset-password), which don't have their own header.
  if (pathname === "/inicio") return null;

  return (
    <header
      className={[
        "sticky top-0 z-50 w-full border-b backdrop-blur transition-all duration-300",
        scrolled ? "bg-white/90 shadow-sm" : "bg-white/80",
      ].join(" ")}
      style={{ borderColor: "rgba(120, 46, 21, 0.12)" }}
    >
      <div
        className={[
          "relative mx-auto flex max-w-6xl items-center justify-between px-6 transition-all duration-300",
          scrolled ? "py-2" : "py-3",
        ].join(" ")}
      >
        {/* LOGO + NOMBRE */}
        <Link href="/" className="flex items-center gap-3 min-w-0 group">
          <Image
            src="/logo-sacre.png"
            alt="Sacré Pádel"
            width={40}
            height={40}
            priority
            className={[
              "drop-shadow-sm shrink-0 transition-all duration-300 group-hover:scale-105",
              scrolled ? "h-8 w-8" : "h-9 w-9 sm:h-10 sm:w-10",
            ].join(" ")}
          />
          <span className="block min-w-0 truncate whitespace-nowrap text-[10px] sm:text-xs font-semibold tracking-[0.18em] sm:tracking-[0.28em] text-black">
            SACRÉ PÁDEL
          </span>

        </Link>

        {/* NAV */}
        {!hideNavOnThisPage && (
          <>
            {/* DESKTOP NAV */}
            <nav className="hidden md:flex items-center gap-3">
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

            {/* MOBILE MENU BUTTON */}
            <div className="md:hidden flex items-center">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="inline-flex items-center justify-center rounded-md border p-2 text-sm transition hover:bg-[rgba(253,238,232,0.6)]"
                style={{ borderColor: "rgba(120, 46, 21, 0.18)" }}
                aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
                aria-expanded={menuOpen}
              >
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>

            {/* MOBILE DROPDOWN */}
            {menuOpen && (
              <div
                className="absolute left-0 top-full w-full border-b bg-white/95 backdrop-blur md:hidden"
                style={{ borderColor: "rgba(120, 46, 21, 0.12)" }}
              >
                <div className="mx-auto max-w-6xl px-6 py-3 grid gap-2">
                  <Link
                    href="/"
                    className="w-full text-sm rounded-md border px-3 py-2 text-center
                      transition active:scale-[0.99]
                      active:bg-[rgba(253,238,232,0.95)]
                      active:border-[rgba(175,78,43,0.35)]"
                    style={{ borderColor: "rgba(120, 46, 21, 0.14)" }}
                  >
                    Inicio
                  </Link>


                  <Link
                    href={loggedIn ? "/reservar" : loginToReserveHref}
                    className="w-full text-sm rounded-md border px-3 py-2 text-center
                      transition active:scale-[0.99]
                      active:bg-[rgba(253,238,232,0.95)]
                      active:border-[rgba(175,78,43,0.35)]"
                    style={{ borderColor: "rgba(120, 46, 21, 0.14)" }}
                  >
                    Reservar
                  </Link>

                  <Link 
                    href="/perfil" 
                    className="w-full text-sm rounded-md border px-3 py-2 text-center
                      transition active:scale-[0.99]
                      active:bg-[rgba(253,238,232,0.95)]
                      active:border-[rgba(175,78,43,0.35)]"
                    style={{ borderColor: "rgba(120, 46, 21, 0.14)" }}>
                    Perfil
                  </Link>

                  {loggedIn && (role === "owner" || role === "reception") && (
                    <Link 
                      href="/reception" 
                      className="w-full text-sm rounded-md border px-3 py-2 text-center
                        transition active:scale-[0.99]
                        active:bg-[rgba(253,238,232,0.95)]
                        active:border-[rgba(175,78,43,0.35)]"
                      style={{ borderColor: "rgba(120, 46, 21, 0.14)" }}>
                      Recepción
                    </Link>
                  )}

                  {loggedIn ? (
                    <button
                      onClick={signOut}
                      className="w-full text-sm rounded-md border px-3 py-2 text-center
                        transition active:scale-[0.99]
                        active:bg-[rgba(253,238,232,0.95)]
                        active:border-[rgba(175,78,43,0.35)]"
                      style={{
                        borderColor: "rgba(175, 78, 43, 0.25)",
                      }}
                    >
                      Cerrar sesión
                    </button>

                  ) : (
                    <Link href={loginToReserveHref} className="w-full btn-primary text-center">
                      Iniciar sesión
                    </Link>
                  )}

                  <button
                    type="button"
                    onClick={() => setMenuOpen(false)}
                    className="w-full text-sm rounded-md border px-3 py-2 text-center
                      transition active:scale-[0.99]
                      active:bg-[rgba(253,238,232,0.95)]
                      active:border-[rgba(175,78,43,0.35)]"
                    style={{ borderColor: "rgba(120, 46, 21, 0.14)" }}
                  >
                    Cerrar menú
                  </button>

                </div>
              </div>
            )}
          </>
        )}


      </div>
    </header>
  );
}
