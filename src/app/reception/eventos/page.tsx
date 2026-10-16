"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BUSINESS_TZ_OFFSET, DIVISIONS, MATCH_GENDER_LABEL, levelRangeLabel, type MatchGender } from "@/lib/config";
import { americanaStandings, suggestedRounds, type AmericanaRound } from "@/lib/americana";
import { errorMessage } from "@/lib/errors";

type Court = { id: string; name: string };
type Reg = { id: string; user_id: string; player_name: string | null; partner_name: string | null; status: string; payment_status: string };
type Ev = {
  id: string;
  title: string;
  kind: "AMERICANA" | "TORNEO" | "SOCIAL";
  starts_at: string;
  ends_at: string;
  court_ids: string[];
  entry: "INDIVIDUAL" | "PAIR";
  capacity: number;
  price: number;
  level_min: number | null;
  level_max: number | null;
  gender: MatchGender;
  status: "OPEN" | "CLOSED" | "CANCELLED" | "FINISHED";
  rounds: AmericanaRound[] | null;
  registrations: Reg[];
};

const TZ = "America/Mexico_City";
const KIND = { AMERICANA: "Americana", TORNEO: "Torneo", SOCIAL: "Clínica" } as const;
const STATUS = { OPEN: "Inscripciones abiertas", CLOSED: "Inscripciones cerradas", CANCELLED: "Cancelado", FINISHED: "Terminado" } as const;
const fmt = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
const HOURS = Array.from({ length: 31 }, (_, i) => `${String(7 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error ?? `Error ${r.status}`);
  return j;
}

/** Recepción: crear y manejar torneos y americanas. */
export default function EventosPage() {
  const [courts, setCourts] = useState<Court[]>([]);
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Subir `version` vuelve a cargar la lista.
  const [version, setVersion] = useState(0);
  const load = useCallback(async () => setVersion((v) => v + 1), []);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [c, e] = await Promise.all([
          fetch("/api/reception/courts", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/reception/events", { cache: "no-store" }).then((r) => r.json()),
        ]);
        if (!alive) return;
        setCourts(c.courts ?? []);
        setEvents(e.events ?? []);
      } catch (e) {
        if (alive) setError(errorMessage(e, "No se pudo cargar."));
      }
    })();
    return () => {
      alive = false;
    };
  }, [version]);

  async function act(id: string, body: unknown, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setError(null);
    try {
      await post(`/api/reception/events/${id}`, body);
      await load();
    } catch (e) {
      setError(errorMessage(e, "No se pudo."));
    }
  }

  return (
    <div className="page">
      <div className="mx-auto max-w-5xl px-6 pb-24 pt-28">
        <Link href="/reception" className="text-sm text-[var(--muted)] underline underline-offset-4">
          ← Recepción
        </Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-4xl">Torneos y americanas</h1>
          <button className="btn-primary" onClick={() => setCreating((v) => !v)}>
            {creating ? "Cerrar" : "+ Nuevo evento"}
          </button>
        </div>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Se publican en <Link href="/torneos" className="underline">/torneos</Link>; los jugadores se inscriben y pagan en línea.
          Las canchas del evento quedan apartadas.
        </p>
        {error && <p className="mt-4 border-l-2 border-red-700 pl-3 text-sm text-red-700">{error}</p>}

        {creating && (
          <NewEventForm
            courts={courts}
            onCreated={async () => {
              setCreating(false);
              await load();
            }}
            onError={setError}
          />
        )}

        {events === null ? (
          <p className="mt-8 text-sm text-[var(--muted)]">Cargando…</p>
        ) : events.length === 0 ? (
          <p className="mt-8 text-sm text-[var(--muted)]">Todavía no hay eventos.</p>
        ) : (
          <ul className="mt-8 space-y-6">
            {events.map((ev) => {
              const confirmed = ev.registrations.filter((r) => r.status === "CONFIRMED");
              const name = (uid: string) =>
                (ev.registrations.find((r) => r.user_id === uid)?.player_name ?? "Jugador").split(" ")[0];
              const standings = ev.rounds ? americanaStandings(confirmed.map((r) => r.user_id), ev.rounds) : [];
              return (
                <li key={ev.id} className="card p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <div>
                      <span className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">
                        {KIND[ev.kind]} · {STATUS[ev.status]}
                      </span>
                      <h2 className="font-display text-2xl">{ev.title}</h2>
                      <p className="text-sm text-[var(--muted)]">
                        {fmt(ev.starts_at)} – {new Date(ev.ends_at).toLocaleTimeString("es-MX", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false })} ·{" "}
                        {ev.court_ids.map((id) => courts.find((c) => c.id === id)?.name ?? "Cancha").join(", ")} ·{" "}
                        {levelRangeLabel(ev.level_min, ev.level_max)} · {MATCH_GENDER_LABEL[ev.gender]} · ${ev.price}{" "}
                        {ev.entry === "PAIR" ? "por pareja" : "por persona"}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <b className="tabular-nums">
                        {confirmed.length}/{ev.capacity}
                      </b>{" "}
                      {ev.entry === "PAIR" ? "parejas" : "jugadores"}
                      <Link href={`/torneos/${ev.id}`} className="block text-xs underline">
                        Ver página pública
                      </Link>
                    </div>
                  </div>

                  {ev.registrations.length > 0 && (
                    <ul className="mt-4 flex flex-wrap gap-2 text-sm">
                      {ev.registrations.map((r) => (
                        <li key={r.id} className="border px-2.5 py-1" style={{ borderColor: "var(--line)" }}>
                          {r.player_name}
                          {r.partner_name ? ` y ${r.partner_name}` : ""}
                          <span className="text-xs text-[var(--muted)]">
                            {" "}
                            · {r.status === "CONFIRMED" ? (r.payment_status === "PAID" ? "pagado" : "inscrito") : "pagando…"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {ev.status !== "CANCELLED" && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {ev.status === "OPEN" && (
                        <button className="btn-secondary !py-1.5 !text-[0.68rem]" onClick={() => act(ev.id, { action: "status", status: "CLOSED" })}>
                          Cerrar inscripciones
                        </button>
                      )}
                      {ev.status === "CLOSED" && (
                        <button className="btn-secondary !py-1.5 !text-[0.68rem]" onClick={() => act(ev.id, { action: "status", status: "OPEN" })}>
                          Reabrir inscripciones
                        </button>
                      )}
                      {ev.status !== "FINISHED" && (
                        <button className="btn-secondary !py-1.5 !text-[0.68rem]" onClick={() => act(ev.id, { action: "status", status: "FINISHED" })}>
                          Marcar terminado
                        </button>
                      )}
                      {ev.kind === "AMERICANA" && ev.status !== "FINISHED" && (
                        <RoundsButton
                          players={confirmed.length}
                          hasRounds={!!ev.rounds}
                          onGenerate={(n) => act(ev.id, { action: "rounds", rounds: n })}
                        />
                      )}
                      {ev.status !== "FINISHED" && (
                        <button
                          className="btn-secondary !py-1.5 !text-[0.68rem] !text-red-700"
                          onClick={() =>
                            act(ev.id, { action: "cancel" }, "¿Cancelar el evento? Se liberan las canchas y se reembolsa a quienes pagaron.")
                          }
                        >
                          Cancelar evento
                        </button>
                      )}
                    </div>
                  )}

                  {ev.rounds && (
                    <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
                      <div className="space-y-4">
                        {ev.rounds.map((r) => (
                          <div key={r.round}>
                            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                              Ronda {r.round}
                              {r.resting.length > 0 && ` · descansa: ${r.resting.map(name).join(", ")}`}
                            </p>
                            <ul className="mt-2 space-y-2">
                              {r.matches.map((m) => (
                                <li key={m.court} className="flex flex-wrap items-center gap-2 text-sm">
                                  <span className="w-20 text-xs text-[var(--muted)]">
                                    {courts.find((c) => c.id === ev.court_ids[m.court])?.name ?? `Cancha ${m.court + 1}`}
                                  </span>
                                  <span className="min-w-[8rem]">{m.teamA.map(name).join(" y ")}</span>
                                  <ScoreInput
                                    value={m.scoreA}
                                    onSave={(v) => act(ev.id, { action: "score", round: r.round, court: m.court, score_a: v, score_b: m.scoreB })}
                                  />
                                  <span>–</span>
                                  <ScoreInput
                                    value={m.scoreB}
                                    onSave={(v) => act(ev.id, { action: "score", round: r.round, court: m.court, score_a: m.scoreA, score_b: v })}
                                  />
                                  <span className="min-w-[8rem]">{m.teamB.map(name).join(" y ")}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                      <div>
                        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Tabla</p>
                        <ol className="mt-2 space-y-1 text-sm">
                          {standings.map((s, i) => (
                            <li key={s.id} className="flex justify-between gap-3">
                              <span>
                                {i + 1}. {name(s.id)}
                              </span>
                              <span className="tabular-nums">{s.points} pts</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function ScoreInput({ value, onSave }: { value: number | null; onSave: (v: number | null) => void }) {
  const [v, setV] = useState(value == null ? "" : String(value));
  return (
    <input
      className="input !w-14 !px-2 !py-1 text-center tabular-nums"
      inputMode="numeric"
      value={v}
      aria-label="Marcador"
      onChange={(e) => setV(e.target.value.replace(/\D/g, "").slice(0, 2))}
      onBlur={() => {
        const n = v === "" ? null : Number(v);
        if (n !== value) onSave(n);
      }}
    />
  );
}

function RoundsButton({ players, hasRounds, onGenerate }: { players: number; hasRounds: boolean; onGenerate: (n: number) => void }) {
  const [n, setN] = useState(suggestedRounds(players));
  return (
    <span className="flex items-center gap-2 text-sm">
      <input
        className="input !w-14 !px-2 !py-1 text-center"
        type="number"
        min={1}
        max={12}
        value={n}
        onChange={(e) => setN(Number(e.target.value))}
        aria-label="Número de rondas"
      />
      <button
        className="btn-primary !py-1.5 !text-[0.68rem]"
        disabled={players < 4}
        title={players < 4 ? "Se necesitan al menos 4 jugadores confirmados" : undefined}
        onClick={() => onGenerate(n)}
      >
        {hasRounds ? "Rehacer rondas" : "Generar rondas"}
      </button>
    </span>
  );
}

function NewEventForm({ courts, onCreated, onError }: { courts: Court[]; onCreated: () => void; onError: (m: string | null) => void }) {
  const [f, setF] = useState({
    title: "",
    kind: "AMERICANA" as Ev["kind"],
    description: "",
    date: "",
    start: "18:00",
    end: "21:00",
    court_ids: [] as string[],
    entry: "INDIVIDUAL" as Ev["entry"],
    capacity: 8,
    price: 250,
    level_min: 1,
    level_max: 6,
    gender: "ANY" as MatchGender,
  });
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.date) return onError("Elige la fecha.");
    setSaving(true);
    onError(null);
    try {
      await post("/api/reception/events", {
        title: f.title,
        kind: f.kind,
        description: f.description || null,
        starts_at: `${f.date}T${f.start}:00${BUSINESS_TZ_OFFSET}`,
        ends_at: `${f.date}T${f.end}:00${BUSINESS_TZ_OFFSET}`,
        court_ids: f.court_ids,
        entry: f.kind === "AMERICANA" ? "INDIVIDUAL" : f.entry,
        capacity: f.capacity,
        price: f.price,
        level_min: f.level_min,
        level_max: f.level_max,
        gender: f.gender,
      });
      onCreated();
    } catch (e) {
      onError(errorMessage(e, "No se pudo crear."));
    } finally {
      setSaving(false);
    }
  }

  const label = "block text-xs font-medium text-[var(--muted)]";
  return (
    <form onSubmit={submit} className="card mt-6 grid gap-4 p-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className={label}>Nombre</label>
        <input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Americana de los viernes" required minLength={3} />
      </div>
      <div>
        <label className={label}>Tipo</label>
        <select className="input" value={f.kind} onChange={(e) => set("kind", e.target.value as Ev["kind"])}>
          <option value="AMERICANA">Americana (individual, parejas que rotan)</option>
          <option value="TORNEO">Torneo</option>
          <option value="SOCIAL">Clínica / clase grupal</option>
        </select>
      </div>
      <div>
        <label className={label}>Inscripción</label>
        <select
          className="input"
          value={f.kind === "AMERICANA" ? "INDIVIDUAL" : f.entry}
          disabled={f.kind === "AMERICANA"}
          onChange={(e) => set("entry", e.target.value as Ev["entry"])}
        >
          <option value="INDIVIDUAL">Individual</option>
          <option value="PAIR">Por pareja</option>
        </select>
      </div>
      <div>
        <label className={label}>Fecha</label>
        <input className="input" type="date" value={f.date} onChange={(e) => set("date", e.target.value)} required />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className={label}>Inicio</label>
          <select className="input" value={f.start} onChange={(e) => set("start", e.target.value)}>
            {HOURS.map((h) => (
              <option key={h}>{h}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className={label}>Fin</label>
          <select className="input" value={f.end} onChange={(e) => set("end", e.target.value)}>
            {HOURS.map((h) => (
              <option key={h}>{h}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="sm:col-span-2">
        <span className={label}>Canchas que se apartan</span>
        <div className="mt-1 flex flex-wrap gap-3 text-sm">
          {courts.map((c) => (
            <label key={c.id} className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={f.court_ids.includes(c.id)}
                onChange={(e) =>
                  set("court_ids", e.target.checked ? [...f.court_ids, c.id] : f.court_ids.filter((x) => x !== c.id))
                }
              />
              {c.name}
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className={label}>Cupo ({f.kind === "AMERICANA" || f.entry === "INDIVIDUAL" ? "jugadores" : "parejas"})</label>
        <input className="input" type="number" min={2} max={64} value={f.capacity} onChange={(e) => set("capacity", Number(e.target.value))} />
        {f.kind === "AMERICANA" && (
          <p className="mt-1 text-xs text-[var(--muted)]">Ideal: 4 por cancha ({f.court_ids.length * 4 || 4}).</p>
        )}
      </div>
      <div>
        <label className={label}>Precio (MXN {f.kind !== "AMERICANA" && f.entry === "PAIR" ? "por pareja" : "por persona"}, 0 = gratis)</label>
        <input className="input" type="number" min={0} value={f.price} onChange={(e) => set("price", Number(e.target.value))} />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className={label}>Nivel desde</label>
          <select className="input" value={f.level_min} onChange={(e) => set("level_min", Number(e.target.value))}>
            {DIVISIONS.map((d) => (
              <option key={d.n} value={d.n}>
                {d.code}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className={label}>hasta</label>
          <select className="input" value={f.level_max} onChange={(e) => set("level_max", Number(e.target.value))}>
            {DIVISIONS.map((d) => (
              <option key={d.n} value={d.n}>
                {d.code}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className={label}>Para</label>
        <select className="input" value={f.gender} onChange={(e) => set("gender", e.target.value as MatchGender)}>
          <option value="ANY">Todos</option>
          <option value="MALE">Varonil</option>
          <option value="FEMALE">Femenil</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className={label}>Descripción (opcional)</label>
        <textarea
          className="input min-h-[80px]"
          value={f.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Formato, premios, qué incluye…"
        />
      </div>
      <div className="sm:col-span-2">
        <button className="btn-primary" disabled={saving}>
          {saving ? "Creando…" : "Crear y publicar"}
        </button>
      </div>
    </form>
  );
}
