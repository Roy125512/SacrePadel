"use client";

import { useEffect, useMemo, useState } from "react";
import { toYMDLocal } from "@/lib/reception/utils";
import { hhmmInBusinessTZ } from "@/lib/businessTime";
import { errorMessage } from "@/lib/errors";

// Cuánto tiempo después de la hora de inicio se sigue dejando elegir ese
// horario en "Nueva reserva" — un cliente que llega unos minutos tarde no
// debería quedar sin poder registrarse en ese horario.
const RECEPTION_START_GRACE_MINUTES = 10;

type Court = { id: string; name: string };

// Disponibilidad del día para pintar la hora como una grilla de horarios
// libres/ocupados por cancha, en vez de un input de texto a ciegas — así
// recepción ve de un vistazo si la cancha ya está apartada a esa hora.
type NbSlot = { start_at: string; end_at: string; available: boolean };

function nowHHMM() {
  return hhmmInBusinessTZ(new Date());
}

/** Nueva reserva manual (walk-in / teléfono / WhatsApp). Se monta al abrirse. */
export default function NewBookingModal({
  courts,
  defaultDate,
  onClose,
  onCreated,
}: {
  courts: Court[];
  defaultDate?: string;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [nbCourtId, setNbCourtId] = useState(courts[0]?.id ?? "");
  const [nbDate, setNbDate] = useState<string>(() => defaultDate ?? toYMDLocal(new Date()));
  const [nbTime, setNbTime] = useState<string>(nowHHMM);
  const [nbDuration, setNbDuration] = useState(60);
  const [nbOrigin, setNbOrigin] = useState<"PHONE" | "WALK_IN">("WALK_IN");
  const [nbName, setNbName] = useState("");
  const [nbPhone, setNbPhone] = useState("");
  const [nbSaving, setNbSaving] = useState(false);
  const [nbError, setNbError] = useState<string | null>(null);

  const [nbAvailability, setNbAvailability] = useState<{ court_id: string; slots: NbSlot[] }[]>([]);
  const [loadedDate, setLoadedDate] = useState<string | null>(null);
  const nbAvailLoading = loadedDate !== nbDate;

  // Si las canchas llegan después de abrir el modal, elige la primera.
  const courtId = nbCourtId || courts[0]?.id || "";

  useEffect(() => {
    if (!nbDate) return;
    let cancelled = false;
    fetch(`/api/web/availability?date=${nbDate}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setNbAvailability(j?.availability ?? []);
      })
      .catch(() => {
        if (!cancelled) setNbAvailability([]);
      })
      .finally(() => {
        if (!cancelled) setLoadedDate(nbDate);
      });
    return () => {
      cancelled = true;
    };
  }, [nbDate]);

  const nbCourtSlots = useMemo(
    () => nbAvailability.find((c) => c.court_id === courtId)?.slots ?? [],
    [nbAvailability, courtId]
  );

  async function submitNewBooking() {
    if (!courtId || !nbDate || !nbTime || !nbName.trim()) {
      setNbError("Cancha, fecha, hora y nombre del cliente son obligatorios.");
      return;
    }
    setNbSaving(true);
    setNbError(null);
    try {
      const r = await fetch("/api/reception/create-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          court_id: courtId,
          date: nbDate,
          start_time: nbTime,
          duration_minutes: nbDuration,
          origin: nbOrigin,
          full_name: nbName.trim(),
          phone: nbPhone.trim(),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? "No se pudo crear la reserva.");
      await onCreated();
    } catch (e) {
      setNbError(errorMessage(e, "No se pudo crear la reserva."));
    } finally {
      setNbSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md card p-5">
        <div className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
          Nueva reserva
        </div>
        <div className="mt-1 text-sm" style={{ color: "rgba(30,27,24,0.60)" }}>
          Para clientes que llaman, escriben o llegan directo a la cancha.
        </div>

        {nbError && (
          <div className="mt-3 rounded-md border px-3 py-2 text-sm" style={{ borderColor: "rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.08)", color: "rgb(153,27,27)" }}>
            {nbError}
          </div>
        )}

        <div className="mt-4">
          <label className="block text-xs" style={{ color: "rgba(30,27,24,0.65)" }}>
            Origen
          </label>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {([
              { key: "WALK_IN", label: "🚶 Presencial" },
              { key: "PHONE", label: "📞💬 Teléfono / WhatsApp" },
            ] as Array<{ key: typeof nbOrigin; label: string }>).map((o) => (
              <button
                key={o.key}
                type="button"
                className={nbOrigin === o.key ? "btn-primary text-xs px-2 py-2" : "btn-secondary text-xs px-2 py-2"}
                onClick={() => setNbOrigin(o.key)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs" style={{ color: "rgba(30,27,24,0.65)" }}>
              Cancha
            </label>
            <select className="input" value={courtId} onChange={(e) => setNbCourtId(e.target.value)}>
              {courts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs" style={{ color: "rgba(30,27,24,0.65)" }}>
              Duración
            </label>
            <select className="input" value={nbDuration} onChange={(e) => setNbDuration(Number(e.target.value))}>
              <option value={60}>60 min</option>
              <option value={90}>90 min</option>
              <option value={120}>120 min</option>
            </select>
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-xs" style={{ color: "rgba(30,27,24,0.65)" }}>
            Fecha
          </label>
          <input className="input" type="date" value={nbDate} onChange={(e) => setNbDate(e.target.value)} />
        </div>

        <div className="mt-3">
          <div className="flex items-baseline justify-between">
            <label className="block text-xs" style={{ color: "rgba(30,27,24,0.65)" }}>
              Hora de inicio
            </label>
            <span className="text-[11px]" style={{ color: "rgba(30,27,24,0.45)" }}>
              🟢 libre · <span className="line-through">gris</span> ocupada/pasada
            </span>
          </div>

          {nbAvailLoading ? (
            <div className="mt-1.5 text-xs" style={{ color: "rgba(30,27,24,0.50)" }}>
              Cargando horarios…
            </div>
          ) : nbCourtSlots.length === 0 ? (
            <input
              className="input mt-1.5"
              type="time"
              value={nbTime}
              onChange={(e) => setNbTime(e.target.value)}
            />
          ) : (
            <div
              className="mt-1.5 grid max-h-40 grid-cols-5 gap-1.5 overflow-y-auto rounded-lg border p-2"
              style={{ borderColor: "rgba(120,46,21,0.12)" }}
            >
              {nbCourtSlots.map((s) => {
                const hhmm = s.start_at.slice(11, 16);
                const isSelected = nbTime === hhmm;
                const isBooked = !s.available;
                // Pasada = ya lleva más de RECEPTION_START_GRACE_MINUTES desde su
                // inicio. El margen es a propósito para no bloquear a alguien que
                // llega unos minutos tarde y aún se le puede registrar esa hora.
                const isPast = new Date(s.start_at).getTime() + RECEPTION_START_GRACE_MINUTES * 60_000 < Date.now();
                const isDisabled = isBooked || isPast;
                return (
                  <button
                    key={s.start_at}
                    type="button"
                    onClick={() => !isDisabled && setNbTime(hhmm)}
                    disabled={isDisabled}
                    title={
                      isBooked
                        ? "Ya hay una reserva a esta hora en esta cancha"
                        : isPast
                        ? "Ese horario ya pasó"
                        : "Disponible"
                    }
                    className={
                      isDisabled
                        ? "cursor-not-allowed rounded-md border px-1.5 py-1.5 text-xs font-medium line-through opacity-50"
                        : isSelected
                        ? "btn-primary rounded-md px-1.5 py-1.5 text-xs font-medium"
                        : "rounded-md border px-1.5 py-1.5 text-xs font-medium bg-white hover:bg-[rgba(253,238,232,0.7)]"
                    }
                    style={
                      isDisabled
                        ? { borderColor: "rgba(120,46,21,0.10)", background: "rgba(120,46,21,0.05)", color: "rgba(30,27,24,0.55)" }
                        : !isSelected
                        ? { borderColor: "rgba(120,46,21,0.14)", color: "var(--foreground)" }
                        : undefined
                    }
                  >
                    {hhmm}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-3">
          <label className="block text-xs" style={{ color: "rgba(30,27,24,0.65)" }}>
            Nombre del cliente
          </label>
          <input
            className="input"
            value={nbName}
            onChange={(e) => setNbName(e.target.value)}
            placeholder="Nombre completo"
            autoFocus
          />
        </div>

        <div className="mt-3">
          <label className="block text-xs" style={{ color: "rgba(30,27,24,0.65)" }}>
            Teléfono (opcional)
          </label>
          <input
            className="input"
            value={nbPhone}
            onChange={(e) => setNbPhone(e.target.value)}
            placeholder="Si ya es cliente, lo reconoce por el número"
          />
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button className="btn-secondary" onClick={onClose} disabled={nbSaving}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={nbSaving} onClick={submitNewBooking}>
            {nbSaving ? "Creando…" : "Crear reserva"}
          </button>
        </div>
      </div>
    </div>
  );
}
