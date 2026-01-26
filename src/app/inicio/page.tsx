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
        <h1 className="section-title">Bienvenido</h1>
        <p className="section-subtitle">
          Reserva tu cancha rápido. Con cuenta, tus datos se autocompletan.
        </p>

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

              <div className="mt-2 text-xs text-white/50">
                Invitado: llenas tus datos cada vez. Con cuenta: se autocompletan y guardas tu historial.

              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
