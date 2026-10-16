"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { errorMessage } from "@/lib/errors";

type Window = { dow: number; start: string; end: string };
type Coach = {
  id: string;
  name: string;
  bio: string | null;
  rate_individual: number;
  rate_pair: number | null;
  weekly_hours: Window[];
  active: boolean;
};

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const HOURS = Array.from({ length: 31 }, (_, i) => `${String(7 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
const EMPTY: Omit<Coach, "id"> = { name: "", bio: "", rate_individual: 500, rate_pair: 700, weekly_hours: [], active: true };

/** Recepción: entrenadores para las clases (precio y horario semanal). */
export default function CoachesPage() {
  const [coaches, setCoaches] = useState<Coach[] | null>(null);
  const [editing, setEditing] = useState<(Omit<Coach, "id"> & { id?: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const j = await fetch("/api/reception/coaches", { cache: "no-store" }).then((r) => r.json());
        if (alive) setCoaches(j.coaches ?? []);
      } catch (e) {
        if (alive) setError(errorMessage(e, "No se pudo cargar."));
      }
    })();
    return () => {
      alive = false;
    };
  }, [version]);

  async function save() {
    if (!editing) return;
    setError(null);
    try {
      const { id, ...body } = editing;
      const r = await fetch(id ? `/api/reception/coaches/${id}` : "/api/reception/coaches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, rate_pair: body.rate_pair || null, bio: body.bio || null }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? "No se pudo guardar.");
      setEditing(null);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(errorMessage(e, "No se pudo guardar."));
    }
  }

  const set = <K extends keyof Omit<Coach, "id">>(k: K, v: Coach[K]) => setEditing((p) => (p ? { ...p, [k]: v } : p));
  const label = "block text-xs font-medium text-[var(--muted)]";

  return (
    <div className="page">
      <div className="mx-auto max-w-4xl px-6 pb-24 pt-28">
        <Link href="/reception" className="text-sm text-[var(--muted)] underline underline-offset-4">
          ← Recepción
        </Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-4xl">Entrenadores y clases</h1>
          <button className="btn-primary" onClick={() => setEditing({ ...EMPTY, weekly_hours: [] })}>
            + Nuevo entrenador
          </button>
        </div>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Los jugadores reservan clases en <Link href="/clases" className="underline">/clases</Link> dentro de estos horarios; el
          sistema aparta una cancha libre. Las clínicas grupales se crean en{" "}
          <Link href="/reception/eventos" className="underline">Torneos y americanas</Link> como tipo “Clínica”.
        </p>
        {error && <p className="mt-4 border-l-2 border-red-700 pl-3 text-sm text-red-700">{error}</p>}

        {editing && (
          <div className="card mt-6 grid gap-4 p-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={label}>Nombre</label>
              <input className="input" value={editing.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={label}>Presentación (opcional)</label>
              <textarea className="input min-h-[70px]" value={editing.bio ?? ""} onChange={(e) => set("bio", e.target.value)} placeholder="Experiencia, estilo, para qué niveles…" />
            </div>
            <div>
              <label className={label}>Clase individual (MXN por hora, incluye cancha)</label>
              <input className="input" type="number" min={1} value={editing.rate_individual} onChange={(e) => set("rate_individual", Number(e.target.value))} />
            </div>
            <div>
              <label className={label}>Clase en pareja (MXN por hora, total; vacío = no da)</label>
              <input
                className="input"
                type="number"
                min={0}
                value={editing.rate_pair ?? ""}
                onChange={(e) => set("rate_pair", e.target.value ? Number(e.target.value) : null)}
              />
            </div>
            <div className="sm:col-span-2">
              <span className={label}>Horario semanal</span>
              <ul className="mt-2 space-y-2">
                {editing.weekly_hours.map((w, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                    <select
                      className="input !w-36 !py-1.5"
                      value={w.dow}
                      onChange={(e) => set("weekly_hours", editing.weekly_hours.map((x, j) => (j === i ? { ...x, dow: Number(e.target.value) } : x)))}
                    >
                      {DAYS.map((d, n) => (
                        <option key={d} value={n}>
                          {d}
                        </option>
                      ))}
                    </select>
                    {(["start", "end"] as const).map((k) => (
                      <select
                        key={k}
                        className="input !w-24 !py-1.5"
                        value={w[k]}
                        onChange={(e) => set("weekly_hours", editing.weekly_hours.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))}
                      >
                        {HOURS.map((h) => (
                          <option key={h}>{h}</option>
                        ))}
                      </select>
                    ))}
                    <button type="button" className="text-red-700 underline" onClick={() => set("weekly_hours", editing.weekly_hours.filter((_, j) => j !== i))}>
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="btn-secondary mt-2 !py-1.5 !text-[0.68rem]"
                onClick={() => set("weekly_hours", [...editing.weekly_hours, { dow: 1, start: "07:00", end: "12:00" }])}
              >
                + Agregar horario
              </button>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.active} onChange={(e) => set("active", e.target.checked)} />
              Visible para reservar
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <button className="btn-primary" onClick={save} disabled={!editing.name.trim()}>
                Guardar
              </button>
              <button className="btn-secondary" onClick={() => setEditing(null)}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {coaches === null ? (
          <p className="mt-8 text-sm text-[var(--muted)]">Cargando…</p>
        ) : coaches.length === 0 ? (
          <p className="mt-8 text-sm text-[var(--muted)]">Todavía no hay entrenadores.</p>
        ) : (
          <ul className="mt-8 space-y-3">
            {coaches.map((c) => (
              <li key={c.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="font-display text-xl">
                    {c.name} {!c.active && <span className="text-xs text-[var(--muted)]">(oculto)</span>}
                  </div>
                  <div className="text-sm text-[var(--muted)]">
                    ${c.rate_individual}/h individual{c.rate_pair ? ` · $${c.rate_pair}/h pareja` : ""} ·{" "}
                    {c.weekly_hours.length
                      ? c.weekly_hours.map((w) => `${DAYS[w.dow].slice(0, 3)} ${w.start}–${w.end}`).join(", ")
                      : "sin horario"}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link href={`/clases/${c.id}`} className="btn-secondary !py-1.5 !text-[0.68rem]">
                    Ver
                  </Link>
                  <button className="btn-secondary !py-1.5 !text-[0.68rem]" onClick={() => setEditing({ ...c })}>
                    Editar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
