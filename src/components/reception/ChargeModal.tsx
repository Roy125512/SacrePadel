"use client";

import { useState } from "react";
import type { Booking, PaymentMethod } from "@/lib/reception/types";
import { parseISOToLocalTime } from "@/lib/reception/utils";
import { errorMessage } from "@/lib/errors";

/** Registrar el cobro de una reserva en recepción. */
export default function ChargeModal({
  booking,
  onClose,
  onPaid,
}: {
  booking: Booking;
  onClose: () => void;
  onPaid: () => void | Promise<void>;
}) {
  const [chargeMethod, setChargeMethod] = useState<PaymentMethod>("CASH");
  const [chargeAmount, setChargeAmount] = useState<number>(booking.amount ?? 0);
  const [chargeSaving, setChargeSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmPay() {
    setChargeSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/reception/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: booking.id,
          payment_method: chargeMethod,
          paid_amount: chargeAmount,
        }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body?.error ?? "Error al cobrar");
      await onPaid();
    } catch (e) {
      setError(errorMessage(e, "Error"));
    } finally {
      setChargeSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md card p-5">
        <div className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
          Cobrar
        </div>
        <div className="mt-1 text-sm" style={{ color: "rgba(30,27,24,0.60)" }}>
          {booking.court_name} · {parseISOToLocalTime(booking.start_at)} – {parseISOToLocalTime(booking.end_at)}
        </div>

        {error && (
          <div className="mt-3 rounded-md border px-3 py-2 text-sm" style={{ borderColor: "rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.08)", color: "rgb(153,27,27)" }}>
            {error}
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2">
          {([
            { key: "CASH", label: "Efectivo" },
            { key: "CARD", label: "Tarjeta" },
            { key: "TRANSFER", label: "Transfer" },
          ] as Array<{ key: PaymentMethod; label: string }>).map((m) => {
            const active = chargeMethod === m.key;
            return (
              <button
                key={m.key}
                className={active ? "btn-primary" : "btn-secondary"}
                onClick={() => setChargeMethod(m.key)}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          <label className="block text-xs" style={{ color: "rgba(30,27,24,0.65)" }}>
            Monto
          </label>
          <input
            className="input"
            type="number"
            value={chargeAmount}
            onChange={(e) => setChargeAmount(Number(e.target.value))}
          />
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            className="btn-secondary"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button className="btn-primary" disabled={chargeSaving} onClick={confirmPay}>
            {chargeSaving ? "Guardando…" : "Confirmar cobro"}
          </button>
        </div>
      </div>
    </div>
  );
}
