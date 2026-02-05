"use client";

import React, { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cuando abres desde el correo, Supabase deja una sesión temporal
  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      // Si no hay sesión, puede ser que el link no se procesó bien
      setReady(true);
    })();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== password2) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabaseBrowser.auth.updateUser({ password });
      if (error) throw error;

      // Opcional: redirige a perfil o login
      router.push("/perfil");
    } catch (err: any) {
      setError(err?.message ?? "No se pudo actualizar la contraseña.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-56px)] page page-gradient">
      <div className="mx-auto max-w-md px-6 py-12">
        <h1 className="section-title">Nueva contraseña</h1>
        <p className="section-subtitle">Crea una contraseña segura para tu cuenta.</p>

        <div className="card mt-6 p-6">
          {!ready ? (
            <div className="text-sm text-white/70">Cargando…</div>
          ) : (
            <form onSubmit={onSubmit} className="grid gap-4">
              <div>
                <label className="block text-xs text-white/70">Contraseña nueva</label>
                <input
                  className="input w-full"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-white/70">Confirmar contraseña</label>
                <input
                  className="input w-full"
                  type="password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  required
                />
              </div>

              {error && <div className="text-sm text-red-200">{error}</div>}

              <button className="btn-primary w-full" disabled={saving}>
                {saving ? "Guardando…" : "Guardar contraseña"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
