"use client";

import React, { useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);

    try {
      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;

      const { error } = await supabaseBrowser.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
      });



      if (error) throw error;
      setDone(true);
    } catch (err: any) {
      setError(err?.message ?? "No se pudo enviar el correo.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-56px)] page page-gradient">
      <div className="mx-auto max-w-md px-6 py-12">
        <h1 className="section-title">Recuperar contraseña</h1>
        <p className="section-subtitle">Te mandamos un enlace para crear una nueva.</p>

        <div className="card mt-6 p-6">
          {done ? (
            <div className="text-sm text-white/80 leading-relaxed">
              Listo ✅ Revisa tu correo. Si no aparece, checa spam/promociones.
              <div className="mt-4">
                <button className="btn-secondary w-full" onClick={() => router.push("/login")}>
                  Volver a iniciar sesión
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="grid gap-4">
              <div>
                <label className="block text-xs text-white/70">Correo</label>
                <input
                  className="input w-full"
                  type="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {error && <div className="text-sm text-red-200">{error}</div>}

              <button className="btn-primary w-full" disabled={sending}>
                {sending ? "Enviando…" : "Enviar enlace"}
              </button>

              <button
                type="button"
                className="btn-secondary w-full"
                onClick={() => router.push("/login")}
              >
                Cancelar
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
