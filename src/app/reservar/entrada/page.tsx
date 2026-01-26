"use client";

import React, { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";

export default function ReservarEntradaPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      if (data.session?.user) {
        router.replace("/reservar");
        return;
      }
      setChecking(false);
    })();
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-sm text-white/70">Cargando…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-lg px-6 py-12">
        <h1 className="text-3xl font-semibold">Reservar</h1>
        <p className="mt-2 text-sm text-white/70">
          Puedes reservar con cuenta (más rápido) o como invitado (llenando datos manualmente).
        </p>

        <div className="mt-8 grid gap-3">
          <button
            className="w-full rounded-md bg-white px-4 py-3 text-sm text-black hover:opacity-90"
            onClick={() => router.push("/perfil?next=/reservar")}
          >
            Iniciar sesión / Crear cuenta
          </button>

          <button
            className="w-full rounded-md border border-white/10 px-4 py-3 text-sm hover:bg-white/10"
            onClick={() => router.push("/reservar?mode=guest")}
          >
            Continuar como invitado
          </button>
        </div>

        <div className="mt-6 text-xs text-white/50">
          Con cuenta, tus datos se autocompletan y después podrás ver tu historial.

        </div>
      </div>
    </div>
  );
}
