"use client";

import React, { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";

export default function InicioPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      setHasSession(!!data.session?.user);
      setChecking(false);
    })();

    const { data: sub } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session?.user);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  if (checking) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center page-gradient">
        <div className="text-sm text-white/70">Cargando…</div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] page page-gradient">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="section-title">Reserva tu cancha y únete a la comunidad Sacré! 🎾</h1>
        <p className="section-subtitle">Donde el juego se hace sagrado</p>

        <div className="mt-8 grid gap-3">
          {hasSession ? (
            <>
              <button className="w-full btn-primary py-3" onClick={() => router.push("/reservar")}>
                Reservar (con mi cuenta)
              </button>

              <button className="w-full btn-secondary py-3" onClick={() => router.push("/perfil")}>
                Ver / Editar mi perfil
              </button>

              <button
                className="w-full btn-secondary py-3"
                onClick={() => router.push("/reservar?mode=guest")}
              >
                Reservar como invitado (manual)
              </button>
            </>
          ) : (
            <>
              <button
                className="w-full btn-primary py-3"
                onClick={() => router.push("/login?mode=login&next=%2Freservar")}
              >
                Iniciar sesión
              </button>

              <button
                className="w-full btn-secondary py-3"
                onClick={() => router.push("/login?mode=signup&next=%2Fperfil")}
              >
                Crear cuenta
              </button>

              <button
                className="w-full btn-secondary py-3"
                onClick={() => router.push("/reservar?mode=guest")}
              >
                Continuar como invitado
              </button>

              <div className="mt-3 text-xs text-white/60 leading-relaxed">
                <div className="font-semibold text-white/70">Si seleccionas:</div>

                <div className="mt-1">
                  <span className="font-semibold">Continuar como invitado:</span> Tus datos los tendrás que llenar cada que reserves cancha
                </div>

                <div className="mt-1">
                  <span className="font-semibold">Crear cuenta:</span> Ya tendremos tus datos y generarás historial para promociones!! 🙌🏻
                </div>
              </div>

            </>
          )}

        </div>
      </div>
    </div>
  );
}
