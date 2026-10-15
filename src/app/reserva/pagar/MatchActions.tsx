"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMXN } from "@/lib/config";

/** Unirse a un partido abierto (paga su lugar con Mercado Pago). */
export function JoinMatchButton({ token, amount }: { token: string; amount: number }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/web/split/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, count: 1 }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.init_point) {
        setError(j?.error ?? "No se pudo iniciar el pago.");
        setLoading(false);
        return;
      }
      window.location.href = j.init_point;
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
      setLoading(false);
    }
  }

  return (
    <div className="mt-8">
      <button type="button" className="btn-primary w-full !py-3.5" onClick={join} disabled={loading}>
        {loading ? "Preparando el pago…" : `Unirme · ${formatMXN(amount)} MXN`}
      </button>
      {error && (
        <p role="alert" className="mt-3 border-l-2 border-red-700 pl-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">
        Pagas tu lugar con tarjeta o transferencia en Mercado Pago. Puedes salirte sin costo hasta 24 h antes.
      </p>
    </div>
  );
}

/** Salirse de un partido al que se unió (con reembolso). */
export function LeaveMatchButton({ token }: { token: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "confirm" | "sending" | "done">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function leave() {
    setStep("sending");
    setError(null);
    try {
      const r = await fetch("/api/web/split/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(j?.error ?? "No se pudo.");
        setStep("idle");
        return;
      }
      setMsg(
        `Listo, saliste del partido. Te devolvimos ${formatMXN(j.refunded_mxn ?? 0)} MXN; según tu banco puede tardar de 2 a 10 días hábiles.`
      );
      setStep("done");
      router.refresh();
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
      setStep("idle");
    }
  }

  if (step === "done") return <p className="mt-4 text-sm font-medium">{msg}</p>;
  return (
    <div className="mt-4">
      {step === "idle" ? (
        <button type="button" className="btn-secondary !px-4 !py-2 !text-[0.68rem]" onClick={() => setStep("confirm")}>
          Salirme del partido
        </button>
      ) : (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="btn-primary !px-4 !py-2 !text-[0.68rem]"
            onClick={leave}
            disabled={step === "sending"}
          >
            {step === "sending" ? "Saliendo…" : "Sí, salirme y reembolsar"}
          </button>
          <button
            type="button"
            className="btn-secondary !px-4 !py-2 !text-[0.68rem]"
            onClick={() => setStep("idle")}
            disabled={step === "sending"}
          >
            No, me quedo
          </button>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
