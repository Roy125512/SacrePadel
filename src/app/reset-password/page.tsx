"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";
import { friendlyAuthError } from "@/lib/authErrors";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);

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
      setError(friendlyAuthError(err));
    } finally {
      setSaving(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center page-gradient">
        <div className="text-sm" style={{ color: "var(--muted)" }}>Cargando…</div>
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
            <div className="text-sm leading-relaxed" style={{ color: "rgba(30,27,24,0.85)" }}>
              <div className="font-semibold">No se pudo verificar tu sesión</div>
              <div className="mt-2" style={{ color: "var(--muted)" }}>
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
                <label className="block text-xs font-medium text-[var(--muted)]">Contraseña nueva</label>
                <div className="relative">
                  <input
                    className="input w-full pr-16"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[var(--brand)] hover:text-[var(--brand-700)]"
                  >
                    {showPassword ? "Ocultar" : "Ver"}
                  </button>
                </div>
                <div className="mt-1 text-[11px]" style={{ color: "var(--muted)" }}>Mínimo 8 caracteres.</div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--muted)]">Confirmar contraseña</label>
                <div className="relative">
                  <input
                    className="input w-full pr-16"
                    type={showPassword2 ? "text" : "password"}
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword2((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[var(--brand)] hover:text-[var(--brand-700)]"
                  >
                    {showPassword2 ? "Ocultar" : "Ver"}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/25 bg-red-50 p-3 text-sm text-red-800">
                  {error}
                </div>
              )}
              {ok && (
                <div className="rounded-lg border border-emerald-500/25 bg-emerald-50 p-3 text-sm text-emerald-800">
                  Contraseña actualizada ✅
                </div>
              )}

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
