"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setHasSession(Boolean(data.session));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updatePassword() {
    setSaving(true);
    setError(null);
    setOk(null);

    try {
      if (!password) throw new Error("Escribe tu nueva contraseña.");
      if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
      if (!confirm) throw new Error("Confirma tu nueva contraseña.");
      if (password !== confirm) throw new Error("Las contraseñas no coinciden.");

      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;

      setOk("Listo. Tu contraseña se actualizó.");
      setTimeout(() => {
        router.replace("/perfil");
        router.refresh();
      }, 600);
    } catch (e: any) {
      setError(e?.message ?? "No se pudo actualizar la contraseña");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page page-gradient">
      <div className="mx-auto max-w-xl px-6 py-16">
        <h1 className="section-title">Recuperar contraseña</h1>
        <p className="section-subtitle">
          Crea una contraseña nueva. (Abre esta página desde el link que te llega por correo.)
        </p>

        <div className="mt-8 card">
          {error && (
            <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {ok && (
            <div className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
              {ok}
            </div>
          )}

          {loading ? (
            <div className="text-sm text-white/70">Cargando…</div>
          ) : !hasSession ? (
            <div className="text-sm text-white/70">
              No veo una sesión de recuperación activa. Abre el link de recuperación desde tu correo
              y vuelve a intentarlo.
            </div>
          ) : (
            <>
              <label className="block text-xs text-white/70">Nueva contraseña</label>
              <input
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                type="password"
                autoComplete="new-password"
              />

              <label className="mt-4 block text-xs text-white/70">Confirmar contraseña</label>
              <input
                className="input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                type="password"
                autoComplete="new-password"
              />

              <button onClick={updatePassword} disabled={saving} className="mt-4 w-full btn-primary">
                {saving ? "Guardando…" : "Guardar contraseña"}
              </button>

              <button onClick={() => router.push("/")} className="mt-2 w-full btn-secondary">
                Volver
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
