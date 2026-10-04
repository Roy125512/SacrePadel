"use client";

import { useState } from "react";
import type { Booking } from "@/lib/reception/types";
import { parseISOToLocalTime } from "@/lib/reception/utils";

/** Ligar (o cambiar) el cliente de una reserva: lo busca por teléfono o lo crea. */
export default function AssignCustomerModal({
  booking,
  onClose,
  onAssigned,
}: {
  booking: Booking;
  onClose: () => void;
  onAssigned: () => void | Promise<void>;
}) {
  const [assignName, setAssignName] = useState(booking.customer_name ?? "");
  const [assignPhone, setAssignPhone] = useState(booking.customer_phone ?? "");
  const [assignSaving, setAssignSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmAssign() {
    setAssignSaving(true);
    setError(null);
    try {
      const r1 = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: assignName, phone_e164: assignPhone }),
      });
      const body1 = await r1.json().catch(() => ({}));
      if (!r1.ok) throw new Error(body1?.error ?? "Error al crear/obtener cliente");

      const customerId = body1?.customer?.id;
      if (!customerId) throw new Error("No se obtuvo customer.id");

      const r2 = await fetch("/api/reception/attach-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: booking.id, customer_id: customerId }),
      });
      const body2 = await r2.json().catch(() => ({}));
      if (!r2.ok) throw new Error(body2?.error ?? "Error al asignar cliente");

      await onAssigned();
    } catch (e: any) {
      setError(e?.message ?? "Error");
    } finally {
      setAssignSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md card p-5">
        <div className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
          Asignar cliente
        </div>
        <div className="mt-1 text-sm" style={{ color: "rgba(30,27,24,0.60)" }}>
          {booking.court_name} · {parseISOToLocalTime(booking.start_at)} – {parseISOToLocalTime(booking.end_at)}
        </div>

        {error && (
          <div className="mt-3 rounded-md border px-3 py-2 text-sm" style={{ borderColor: "rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.08)", color: "rgb(153,27,27)" }}>
            {error}
          </div>
        )}

        <div className="mt-4">
          <label className="block text-xs" style={{ color: "rgba(30,27,24,0.65)" }}>
            Nombre
          </label>
          <input
            className="input"
            value={assignName}
            onChange={(e) => setAssignName(e.target.value)}
            placeholder="Nombre completo"
          />
        </div>

        <div className="mt-3">
          <label className="block text-xs" style={{ color: "rgba(30,27,24,0.65)" }}>
            Teléfono
          </label>
          <input
            className="input"
            value={assignPhone}
            onChange={(e) => setAssignPhone(e.target.value)}
            placeholder="+52..."
          />
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            className="btn-secondary"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button className="btn-primary" disabled={assignSaving} onClick={confirmAssign}>
            {assignSaving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
