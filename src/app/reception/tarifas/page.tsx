"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DAY_RATE, EVENING_RATE, offPeakLabel, type OffPeakConfig } from "@/lib/pricing-shared";
import { errorMessage } from "@/lib/errors";

const DAYS = [
  [1, "Lun"],
  [2, "Mar"],
  [3, "Mié"],
  [4, "Jue"],
  [5, "Vie"],
  [6, "Sáb"],
  [0, "Dom"],
] as const;
const HOURS = Array.from({ length: 16 }, (_, i) => 7 + i); // 07 … 22

/** Recepción: horas valle (precio, días y horario). Solo el dueño las cambia. */
export default function TarifasPage() {
  const [cfg, setCfg] = useState<OffPeakConfig | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const j = await fetch("/api/reception/pricing", { cache: "no-store" }).then((r) => r.json());
        if (!alive) return;
        setCfg(j.off_peak);
        setCanEdit(!!j.can_edit);
      } catch (e) {
        if (alive) setMsg({ ok: false, text: errorMessage(e, "No se pudo cargar.") });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function save() {
    if (!cfg) return;
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch("/api/reception/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? "No se pudo guardar.");
      setCfg(j.off_peak);
      setMsg({ ok: true, text: "Guardado. En menos de un minuto se aplica en todo el sitio (reservas nuevas, portada y recepción)." });
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e, "No se pudo guardar.") });
    } finally {
      setSaving(false);
    }
  }

  const set = <K extends keyof OffPeakConfig>(k: K, v: OffPeakConfig[K]) => setCfg((p) => (p ? { ...p, [k]: v } : p));
  const label = "block text-xs font-medium text-[var(--muted)]";

  return (
    <div className="page">
      <div className="mx-auto max-w-2xl px-6 pb-24 pt-28">
        <Link href="/reception" className="text-sm text-[var(--muted)] underline underline-offset-4">
          ← Recepción
        </Link>
        <h1 className="font-display mt-4 text-4xl">Horas valle</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Tarifa más baja en los horarios que se llenan poco. Tarifa normal: ${DAY_RATE}/h de día y ${EVENING_RATE}/h de noche.
          Las reservas ya hechas conservan su precio.
        </p>

        {!cfg ? (
          <p className="mt-8 text-sm text-[var(--muted)]">Cargando…</p>
        ) : (
          <fieldset disabled={!canEdit || saving} className="card mt-6 grid gap-5 p-5">
            {!canEdit && (
              <p className="text-sm" style={{ color: "rgb(146,64,14)" }}>
                Solo el dueño puede cambiar las tarifas. Aquí puedes ver las vigentes.
              </p>
            )}
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={cfg.enabled} onChange={(e) => set("enabled", e.target.checked)} />
              Horas valle activas
            </label>

            <div className={cfg.enabled ? "grid gap-5" : "grid gap-5 opacity-50"}>
              <div>
                <label className={label}>Precio por hora (MXN)</label>
                <input
                  className="input !w-40"
                  type="number"
                  min={1}
                  max={5000}
                  value={cfg.rate}
                  onChange={(e) => set("rate", Number(e.target.value))}
                />
              </div>
              <div>
                <span className={label}>Días</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {DAYS.map(([n, l]) => {
                    const on = cfg.days.includes(n);
                    return (
                      <button
                        key={n}
                        type="button"
                        aria-pressed={on}
                        onClick={() => set("days", on ? cfg.days.filter((d) => d !== n) : [...cfg.days, n].sort())}
                        className={on ? "btn-primary !px-3 !py-1.5 !text-[0.7rem]" : "btn-secondary !px-3 !py-1.5 !text-[0.7rem]"}
                      >
                        {l}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-4">
                <div>
                  <label className={label}>Desde</label>
                  <select className="input !w-28" value={cfg.startHour} onChange={(e) => set("startHour", Number(e.target.value))}>
                    {HOURS.map((h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, "0")}:00
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={label}>Hasta</label>
                  <select className="input !w-28" value={cfg.endHour} onChange={(e) => set("endHour", Number(e.target.value))}>
                    {HOURS.map((h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, "0")}:00
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {cfg.days.length > 0 && cfg.endHour > cfg.startHour && (
                <p className="text-sm">
                  Se verá así: <b>Hora valle · {offPeakLabel(cfg)} · ${cfg.rate}/h</b>
                </p>
              )}
            </div>

            {canEdit && (
              <div>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={save}
                  disabled={saving || cfg.days.length === 0 || cfg.endHour <= cfg.startHour || !(cfg.rate > 0)}
                >
                  {saving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            )}
          </fieldset>
        )}
        {msg && (
          <p role="status" className={`mt-4 border-l-2 pl-3 text-sm ${msg.ok ? "border-[var(--brand)]" : "border-red-700 text-red-700"}`}>
            {msg.text}
          </p>
        )}
      </div>
    </div>
  );
}
