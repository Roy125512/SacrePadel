"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Botón de cancelar con confirmación en dos pasos (sin diálogos del
 * navegador). Sirve con la liga del correo (`token`) o desde "Mis reservas"
 * (`bookingId`, requiere sesión).
 */
export default function CancelBookingButton({
  token,
  bookingId,
  paidOnline,
  onDone,
  compact = false,
}: {
  token?: string;
  bookingId?: string;
  paidOnline: boolean;
  onDone?: (note: string) => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "confirm" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function cancel() {
    setStep("sending");
    setError(null);
    try {
      const r = await fetch("/api/web/cancel-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(token ? { token } : { booking_id: bookingId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(j?.error ?? "No se pudo cancelar.");
        setStep("idle");
        return;
      }
      const msg =
        j.refund === "refunded" && j.split
          ? `Listo, tu reserva se canceló. Devolvimos a cada quien lo que pagó ($${j.refunded_mxn} MXN en total); según el banco puede tardar de 2 a 10 días hábiles en verse.`
          : j.refund === "refunded"
          ? `Listo, tu reserva se canceló. Te devolvimos $${j.refunded_mxn} MXN; según tu banco puede tardar de 2 a 10 días hábiles en verse.`
          : j.refund === "failed"
            ? "Listo, tu reserva se canceló. El reembolso lo hará el club manualmente y te avisaremos."
            : "Listo, tu reserva se canceló.";
      setNote(msg);
      setStep("done");
      onDone?.(msg);
      router.refresh();
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
      setStep("idle");
    }
  }

  if (step === "done") return <p className="text-sm font-medium">{note}</p>;

  const size = compact ? "!px-4 !py-2 !text-[0.68rem]" : "";
  return (
    <div>
      {step === "idle" ? (
        <button type="button" className={`btn-secondary ${size}`} onClick={() => setStep("confirm")}>
          Cancelar reserva
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={`btn-primary ${size}`} onClick={cancel} disabled={step === "sending"}>
            {step === "sending" ? "Cancelando…" : paidOnline ? "Sí, cancelar y reembolsar" : "Sí, cancelar"}
          </button>
          <button type="button" className={`btn-secondary ${size}`} onClick={() => setStep("idle")} disabled={step === "sending"}>
            No, mantenerla
          </button>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
