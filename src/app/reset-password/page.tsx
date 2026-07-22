"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const canSubmit = useMemo(() => {
    return password.length >= 8 && password === password2 && !saving;
  }, [password, password2, saving]);

  useEffect(() => {
    let alive = true;

    async function check() {
      const { data } = await supabaseBrowser.auth.getSession();
      if (!alive) return;
      setHasSession(!!data.session);
      setChecking(false);
    }

    check();

    const { data: sub } = supabaseBrowser.auth.onAuthStateChange((_evt: string, session: any) => {
      setHasSession(!!session);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);

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

      setOk(true);

      // opcional: manda a perfil o a login (yo prefiero perfil)
      router.push("/perfil");
    } catch (err: any) {
      setError(err?.message ?? "No se pudo actualizar la contraseña.");
    } finally {
      setSaving(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center page-gradient">
        <div className="text-sm text-white/70">Cargando…</div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] page page-gradient">
      <div className="mx-auto max-w-md px-6 py-12">
        <h1 className="section-title">Nueva contraseña</h1>
        <p className="section-subtitle">Crea una contraseña segura para tu cuenta.</p>

        <div className="card mt-6 p-6">
          {!hasSession ? (
            <div className="text-sm text-red-200 leading-relaxed">
              <div className="font-semibold">Auth session missing</div>
              <div className="mt-2 text-white/70">
                Esto pasa cuando el enlace del correo <b>no activó la sesión de recuperación</b>.
                Normalmente es porque el link no pasó por <code>/auth/callback</code> (o no se guardó la cookie),
                o porque abriste el link en otro navegador.
              </div>

              <div className="mt-4 grid gap-2">
                <button
                  className="btn-primary w-full"
                  onClick={() => router.push("/forgot-password")}
                >
                  Volver a enviar enlace
                </button>
                <button
                  className="btn-secondary w-full"
                  onClick={() => router.push("/login")}
                >
                  Volver a iniciar sesión
                </button>
              </div>
            </div>
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
                  autoComplete="new-password"
                />
                <div className="mt-1 text-[11px] text-white/60">Mínimo 8 caracteres.</div>
              </div>

              <div>
                <label className="block text-xs text-white/70">Confirmar contraseña</label>
                <input
                  className="input w-full"
                  type="password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>

              {error && <div className="text-sm text-red-200">{error}</div>}
              {ok && <div className="text-sm text-green-200">Contraseña actualizada ✅</div>}

              <button className="btn-primary w-full" disabled={!canSubmit}>
                {saving ? "Guardando…" : "Guardar contraseña"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
