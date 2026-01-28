"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="page page-gradient">
          <div className="mx-auto max-w-xl px-6 py-16">
            <div className="card">Cargando…</div>
          </div>
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const mode = (searchParams.get("mode") || "login").toLowerCase();
  const isSignup = mode === "signup" || mode === "register";

  const defaultNext = isSignup ? "/perfil" : "/reservar";
  const next = searchParams.get("next") || defaultNext;

  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function submitAuth() {
    console.log("[AUTH] submitAuth", { isSignup, email, next });
    setSending(true);
    setError(null);
    setOk(null);

    try {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail) throw new Error("Escribe tu correo.");
      if (!cleanEmail.includes("@")) throw new Error("Correo no válido.");

      if (!password) throw new Error("Escribe tu contraseña.");
      if (password.length < 8)
        throw new Error("La contraseña debe tener al menos 8 caracteres.");

      if (isSignup) {
        if (!confirmPassword) throw new Error("Confirma tu contraseña.");
        if (password !== confirmPassword)
          throw new Error("Las contraseñas no coinciden.");

        const origin = window.location.origin;
        const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

        const { error: signErr } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { emailRedirectTo: redirectTo },
        });
        if (signErr) throw signErr;

        setOk(
          "Cuenta creada. Si tienes activada la confirmación por correo, revisa tu inbox y spam para activarla."
        );
      } else {
        const { error: signErr } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        console.log("[AUTH] signInWithPassword result", { signErr });

        if (signErr) throw signErr;

        // Espera un tick para que se escriba la cookie de sesión
        await new Promise((r) => setTimeout(r, 150));

        console.log("[AUTH] redirecting to", next);
        router.replace(next);
        router.refresh();
        return;
      }
    } catch (e: any) {
      const msg = e?.message ?? "Error de autenticación";
      setError(msg);
    } finally {
      setSending(false);
    }
  }

  async function resendConfirmation() {
    setSending(true);
    setError(null);
    setOk(null);

    try {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail) throw new Error("Escribe tu correo.");

      const origin = window.location.origin;
      const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

      const { error: err } = await supabase.auth.resend({
        type: "signup",
        email: cleanEmail,
        options: { emailRedirectTo: redirectTo },
      });

      if (err) throw err;

      setOk("Listo. Te reenvié el correo de confirmación. Revisa inbox y spam.");
    } catch (e: any) {
      setError(e?.message ?? "No se pudo reenviar el correo");
    } finally {
      setSending(false);
    }
  }

  async function sendPasswordReset() {
    setSending(true);
    setError(null);
    setOk(null);

    try {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail) throw new Error("Escribe tu correo.");
      if (!cleanEmail.includes("@")) throw new Error("Correo no válido.");

      const origin = window.location.origin;
      const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(
        "/reset-password"
      )}`;

      const { error: err } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo,
      });

      if (err) throw err;

      setOk(
        "Listo. Te mandé un correo para recuperar tu contraseña. Revisa inbox y spam."
      );
    } catch (e: any) {
      setError(e?.message ?? "No se pudo enviar el correo de recuperación");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="page page-gradient">
      <div className="mx-auto max-w-xl px-6 py-16">
        <h1 className="section-title">{isSignup ? "Crear cuenta" : "Iniciar sesión"}</h1>
        <p className="section-subtitle">
          {isSignup
            ? "Crea tu cuenta con correo y contraseña."
            : "Ingresa con tu correo y contraseña."}
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

          <label className="block text-xs text-white/70">Correo</label>
          <input
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            type="email"
            autoComplete="email"
          />

          <label className="mt-4 block text-xs text-white/70">Contraseña</label>
          <div className="relative">
            <input
              className="input pr-16"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              type={showPassword ? "text" : "password"}
              autoComplete={isSignup ? "new-password" : "current-password"}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/70 hover:text-white"
            >
              {showPassword ? "Ocultar" : "Ver"}
            </button>
          </div>

          {isSignup && (
            <>
              <label className="mt-4 block text-xs text-white/70">
                Confirmar contraseña
              </label>
              <div className="relative">
                <input
                  className="input pr-16"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/70 hover:text-white"
                >
                  {showConfirm ? "Ocultar" : "Ver"}
                </button>
              </div>

              <button
                onClick={resendConfirmation}
                disabled={sending || !email.trim()}
                className="mt-2 w-full btn-secondary"
              >
                Reenviar correo de confirmación
              </button>
            </>
          )}

          {!isSignup && (
            <button
              type="button"
              onClick={sendPasswordReset}
              disabled={sending || !email.trim()}
              className="mt-3 w-full btn-secondary"
            >
              ¿Olvidaste tu contraseña?
            </button>
          )}

          <button
            onClick={submitAuth}
            disabled={sending}
            className="mt-4 w-full btn-primary"
          >
            {sending ? "Procesando…" : isSignup ? "Crear cuenta" : "Iniciar sesión"}
          </button>

          <button
            onClick={() =>
              router.replace(
                `/login?mode=${isSignup ? "login" : "signup"}&next=${encodeURIComponent(
                  next
                )}`
              )
            }
            className="mt-3 w-full btn-secondary"
          >
            {isSignup ? "Ya tengo cuenta: iniciar sesión" : "No tengo cuenta: crear cuenta"}
          </button>

          <button onClick={() => router.push("/")} className="mt-2 w-full btn-secondary">
            Volver
          </button>
        </div>
      </div>
    </div>
  );
}
