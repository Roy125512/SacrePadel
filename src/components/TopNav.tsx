"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

export default function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [loggedIn, setLoggedIn] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setLoggedIn(Boolean(data.session));
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(Boolean(session));
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  // ✅ Siempre que quieras “login y luego reservar”
  const loginToReserveHref = "/perfil?next=%2Freservar";

  const linkClass = (href: string) => {
    const active = pathname === href;
    return [
      "px-3 py-2 text-sm rounded-md border",
      active ? "border-white/30 bg-white/10" : "border-white/10 hover:bg-white/10",
    ].join(" ");
  };

  return (
    <header className="w-full border-b border-white/10 bg-black text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-sm font-semibold tracking-widest">
          SACRÉ PÁDEL
        </Link>

        <nav className="flex items-center gap-3">
          <Link href="/" className={linkClass("/")}>
            Inicio
          </Link>

          {/* ✅ Reservar: si no hay sesión, manda al login con next=/reservar */}
          <Link href={loggedIn ? "/reservar" : loginToReserveHref} className={linkClass("/reservar")}>
            Reservar
          </Link>

          <Link href="/perfil" className={linkClass("/perfil")}>
            Perfil
          </Link>

          {loggedIn ? (
            <button
              onClick={signOut}
              className="rounded-md border border-white/10 px-3 py-2 text-sm hover:bg-white/10"
            >
              Cerrar sesión
            </button>
          ) : (
            // ✅ Este es el cambio clave: YA NO manda a /perfil a secas
            <Link
              href={loginToReserveHref}
              className="rounded-md border border-white/10 px-3 py-2 text-sm hover:bg-white/10"
            >
              Iniciar sesión
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
