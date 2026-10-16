"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Inscribirse (y pagar) o cancelar la inscripción a un evento. */
export function RegisterButton({ eventId, price, pair }: { eventId: string; price: number; pair: boolean }) {
  const router = useRouter();
  const [partner, setPartner] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function register() {
    if (pair && !partner.trim()) return setError("Escribe el nombre de tu pareja.");
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/web/events/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, partner_name: pair ? partner.trim() : null }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(j?.error ?? "No se pudo inscribirte.");
        setBusy(false);
        return;
      }
      if (j.init_point) window.location.href = j.init_point;
      else {
        setBusy(false);
        router.refresh();
      }
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-8">
      {pair && (
        <div className="mb-4">
          <label htmlFor="ev-partner" className="block text-sm font-medium text-[var(--muted)]">
            Tu pareja
          </label>
          <input
            id="ev-partner"
            className="input"
            value={partner}
            onChange={(e) => setPartner(e.target.value)}
            placeholder="Nombre de tu pareja"
          />
        </div>
      )}
      <button type="button" className="btn-primary w-full !py-3.5" onClick={register} disabled={busy}>
        {busy ? "Preparando…" : price > 0 ? `Inscribirme · $${price} MXN` : "Inscribirme gratis"}
      </button>
      {error && (
        <p role="alert" className="mt-3 border-l-2 border-red-700 pl-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {price > 0 && (
        <p className="mt-3 text-xs text-[var(--muted)]">
          Pagas con tarjeta o transferencia en Mercado Pago. Puedes cancelar sin costo hasta 24 h antes.
        </p>
      )}
    </div>
  );
}

export function CancelRegistrationButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "confirm" | "sending">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  async function cancel() {
    setStep("sending");
    try {
      const r = await fetch("/api/web/events/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg(j?.error ?? "No se pudo.");
        setStep("idle");
        return;
      }
      setMsg(j.refunded_mxn ? `Cancelaste tu inscripción. Te devolvimos $${j.refunded_mxn} MXN.` : "Cancelaste tu inscripción.");
      router.refresh();
    } catch {
      setMsg("Sin conexión. Intenta de nuevo.");
      setStep("idle");
    }
  }

  return (
    <div className="mt-3">
      {step === "idle" ? (
        <button type="button" className="text-sm text-[var(--muted)] underline underline-offset-4" onClick={() => setStep("confirm")}>
          Cancelar mi inscripción
        </button>
      ) : (
        <span className="flex flex-wrap gap-3">
          <button type="button" className="btn-primary !px-4 !py-2 !text-[0.68rem]" disabled={step === "sending"} onClick={cancel}>
            {step === "sending" ? "Cancelando…" : "Sí, cancelar"}
          </button>
          <button type="button" className="btn-secondary !px-4 !py-2 !text-[0.68rem]" onClick={() => setStep("idle")}>
            No
          </button>
        </span>
      )}
      {msg && <p className="mt-2 text-sm">{msg}</p>}
    </div>
  );
}
