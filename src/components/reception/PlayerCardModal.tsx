"use client";

import { useEffect, useState } from "react";
import type { BookingStatus } from "@/lib/reception/types";
import { currencyMXN, formatDateMX, parseISOToLocalTime, statusLabelES } from "@/lib/reception/utils";

type PlayerApiResponse = {
  customer: {
    id: string;
    full_name: string | null;
    phone_e164: string | null;
    email: string | null;
    notes: string | null;
    birthday: string | null;
    player_notes: string | null;
    sex: string | null;
    division: string | null;
    is_active: boolean | null;
    created_at: string | null;
  };
  stats: {
    total_visits: number;
    total_paid: number;
    last_visit_at: string | null;
  };
  recent_bookings: Array<{
    id: string;
    start_at: string;
    end_at: string;
    status: string;
    payment_status: string;
    paid_amount: number;
    expected_amount: number;
    paid_at: string | null;
    payment_method: string | null;
    court_name: string;
    source: string | null;
    kind: string | null;
  }>;
  error?: string;
};

/** Ficha del jugador: datos, notas de recepción y últimas reservas. Se monta al abrirse. */
export default function PlayerCardModal({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const [playerLoading, setPlayerLoading] = useState(true);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [playerData, setPlayerData] = useState<PlayerApiResponse | null>(null);

  const [receptionNotes, setReceptionNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesOk, setNotesOk] = useState<string | null>(null);
  const [activeSaving, setActiveSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/customers/${customerId}?limit=10&offset=0`, { cache: "no-store" });
        const body = (await r.json()) as PlayerApiResponse;
        if (cancelled) return;
        if (!r.ok) {
          setPlayerError(body?.error ?? `Error ${r.status}`);
          return;
        }
        setPlayerData(body);
        setReceptionNotes(body?.customer?.notes ?? "");
      } catch (e: any) {
        if (!cancelled) setPlayerError(e?.message ?? "Error al cargar ficha");
      } finally {
        if (!cancelled) setPlayerLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  async function saveReceptionNotes() {
    if (!playerData?.customer?.id) return;

    setNotesSaving(true);
    setNotesOk(null);
    setPlayerError(null);

    try {
      const r = await fetch(`/api/customers/${playerData.customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: receptionNotes }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? `Error ${r.status}`);

      // reflejar en pantalla sin recargar
      setPlayerData((prev) =>
        prev ? { ...prev, customer: { ...prev.customer, notes: j?.customer?.notes ?? receptionNotes } } : prev
      );

      setNotesOk("Notas guardadas");
    } catch (e: any) {
      setPlayerError(e?.message ?? "No se pudieron guardar las notas.");
    } finally {
      setNotesSaving(false);
    }
  }

  async function toggleCustomerActive() {
    if (!playerData?.customer?.id) return;

    const nextActive = playerData.customer.is_active === false;
    setActiveSaving(true);
    setPlayerError(null);

    try {
      const r = await fetch(`/api/customers/${playerData.customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: nextActive }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? `Error ${r.status}`);

      setPlayerData((prev) =>
        prev ? { ...prev, customer: { ...prev.customer, is_active: j?.customer?.is_active ?? nextActive } } : prev
      );
    } catch (e: any) {
      setPlayerError(e?.message ?? "No se pudo cambiar el estado del cliente.");
    } finally {
      setActiveSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-2xl max-h-[85vh] flex-col card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
              Ficha de jugador
            </div>
            <div className="text-xs" style={{ color: "rgba(30,27,24,0.60)" }}>
              Información y últimas reservas
            </div>
          </div>

          <button className="btn-secondary shrink-0" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <div className="mt-4 overflow-y-auto">
          {playerLoading && <div className="text-sm" style={{ color: "rgba(30,27,24,0.70)" }}>Cargando…</div>}

          {!playerLoading && playerError && (
            <div
              className="rounded-md border p-3 text-sm"
              style={{ borderColor: "rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.08)", color: "rgb(153,27,27)" }}
            >
              {playerError}
            </div>
          )}

          {!playerLoading && !playerError && playerData && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-white p-4" style={{ borderColor: "rgba(120,46,21,0.10)" }}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
                      {playerData.customer.full_name ?? "Sin nombre"}
                    </div>
                    <div className="mt-1 text-xs" style={{ color: "rgba(30,27,24,0.60)" }}>
                      {playerData.customer.email ?? "—"} • {playerData.customer.phone_e164 ?? "—"}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs" style={{ color: "rgba(30,27,24,0.60)" }}>
                      <span>
                        Cumpleaños: {playerData.customer.birthday ?? "—"} • Estado:{" "}
                        {playerData.customer.is_active === false ? "Inactivo" : "Activo"}
                      </span>
                      <button
                        type="button"
                        className="btn-secondary px-2 py-0.5 text-[11px]"
                        onClick={toggleCustomerActive}
                        disabled={activeSaving}
                      >
                        {activeSaving
                          ? "Guardando…"
                          : playerData.customer.is_active === false
                          ? "Reactivar"
                          : "Desactivar"}
                      </button>
                    </div>
                    <div className="mt-1 text-xs" style={{ color: "rgba(30,27,24,0.60)" }}>
                      Sexo: {playerData.customer.sex ?? "—"} • División: {playerData.customer.division ?? "—"}
                    </div>

                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-md border bg-white px-3 py-2" style={{ borderColor: "rgba(120,46,21,0.10)" }}>
                      <div className="text-[11px]" style={{ color: "rgba(30,27,24,0.60)" }}>Visitas</div>
                      <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{playerData.stats.total_visits ?? 0}</div>
                    </div>
                    <div className="rounded-md border bg-white px-3 py-2" style={{ borderColor: "rgba(120,46,21,0.10)" }}>
                      <div className="text-[11px]" style={{ color: "rgba(30,27,24,0.60)" }}>Total pagado</div>
                      <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{currencyMXN(playerData.stats.total_paid ?? 0)}</div>
                    </div>
                    <div className="rounded-md border bg-white px-3 py-2" style={{ borderColor: "rgba(120,46,21,0.10)" }}>
                      <div className="text-[11px]" style={{ color: "rgba(30,27,24,0.60)" }}>Última visita</div>
                      <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                        {playerData.stats.last_visit_at ? formatDateMX(playerData.stats.last_visit_at) : "—"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-md border bg-white p-3" style={{ borderColor: "rgba(120,46,21,0.10)" }}>
                    <div className="text-xs font-semibold" style={{ color: "rgba(30,27,24,0.80)" }}>Notas de recepción</div>

                    <textarea
                      className="input mt-2 min-h-[90px] w-full"
                      placeholder="Escribe aquí notas internas (ej. nivel, preferencias, puntualidad, etc.)"
                      value={receptionNotes}
                      onChange={(e) => setReceptionNotes(e.target.value)}
                    />

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="text-xs" style={{ color: "#0f9d6e" }}>{notesOk ?? ""}</div>

                      <button
                        type="button"
                        onClick={saveReceptionNotes}
                        disabled={notesSaving}
                        className="btn-secondary px-3 py-1.5 text-xs"
                      >
                        {notesSaving ? "Guardando…" : "Guardar notas"}
                      </button>
                    </div>

                  </div>
                  <div className="rounded-md border bg-white p-3" style={{ borderColor: "rgba(120,46,21,0.10)" }}>
                    <div className="text-xs font-semibold" style={{ color: "rgba(30,27,24,0.80)" }}>Nota jugador</div>
                    <div className="mt-1 whitespace-pre-wrap text-sm" style={{ color: "rgba(30,27,24,0.70)" }}>
                      {playerData.customer.player_notes?.trim() ? playerData.customer.player_notes : "—"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-white p-4" style={{ borderColor: "rgba(120,46,21,0.10)" }}>
                <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                  Últimas reservas
                </div>

                <div className="mt-3 rounded-lg border bg-white" style={{ borderColor: "rgba(120,46,21,0.10)" }}>
                  <div className="max-h-[420px] overflow-auto">
                  <table className="w-full text-sm">
                    <thead
                      style={{
                        background: "linear-gradient(180deg, rgba(253,238,232,0.9), rgba(255,255,255,0.9))",
                        borderBottom: "1px solid rgba(120,46,21,0.10)",
                      }}
                    >
                      <tr>
                        {["Fecha", "Cancha", "Inicio", "Fin", "Estatus", "Pago", "Monto"].map((h) => (
                          <th key={h} className="px-3 py-2 text-xs font-semibold" style={{ color: "rgba(30,27,24,0.70)", letterSpacing: "0.06em" }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(playerData.recent_bookings ?? []).length === 0 ? (
                        <tr>
                          <td className="px-3 py-3" style={{ color: "rgba(30,27,24,0.60)" }} colSpan={7}>
                            Sin reservas recientes
                          </td>
                        </tr>
                      ) : (
                        playerData.recent_bookings.map((rb) => (
                          <tr key={rb.id} style={{ borderTop: "1px solid rgba(120,46,21,0.08)" }}>
                            <td className="px-3 py-3 whitespace-nowrap">
                              {formatDateMX(rb.start_at)}
                            </td>
                            <td className="px-3 py-3">{rb.court_name}</td>
                            <td className="px-3 py-3">{parseISOToLocalTime(rb.start_at)}</td>
                            <td className="px-3 py-3">{parseISOToLocalTime(rb.end_at)}</td>
                            <td className="px-3 py-3">{statusLabelES(rb.status as BookingStatus)}</td>
                            <td className="px-3 py-3">{(rb.payment_status ?? "UNPAID") === "PAID" ? "Pagado" : "Pendiente"}</td>
                            <td className="px-3 py-3">{currencyMXN(rb.paid_amount ?? 0)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
