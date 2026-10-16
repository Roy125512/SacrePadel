"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { LEVEL_QUESTIONS, formatLevel, levelToDivision } from "@/lib/levels-shared";

type LevelInfo = {
  level: number | null;
  reliability: number;
  matches: number;
  rankingVisible: boolean;
  history: { at: string; sets: number[][]; outcome: "W" | "L" | "T"; before: number | null; after: number | null }[];
};

const TZ = "America/Mexico_City";
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { timeZone: TZ, day: "numeric", month: "short" });

/** "Tu nivel" del perfil: cuestionario la primera vez; después, nivel e historial. */
export default function LevelCard() {
  const [info, setInfo] = useState<LevelInfo | null>(null);
  const [failed, setFailed] = useState(false);
  const [answers, setAnswers] = useState<(number | null)[]>(() => LEVEL_QUESTIONS.map(() => null));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lowering, setLowering] = useState(false);
  const [lowerTo, setLowerTo] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/web/level", { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      setInfo(await r.json());
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitQuiz() {
    if (answers.some((a) => a === null)) return setError("Responde todas las preguntas.");
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/web/level", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setError(j?.error ?? "No se pudo guardar.");
      else await load();
    } finally {
      setSaving(false);
    }
  }

  async function lower() {
    if (lowerTo == null) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/web/level/lower", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: lowerTo }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setError(j?.error ?? "No se pudo.");
      else {
        setLowering(false);
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="nivel" className="mt-12 scroll-mt-24">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">Tu nivel</p>

      {failed ? (
        <p className="mt-4 text-sm text-[var(--muted)]">No pudimos cargar tu nivel. Recarga la página.</p>
      ) : !info ? (
        <p className="mt-4 text-sm text-[var(--muted)]">Cargando…</p>
      ) : info.level == null ? (
        /* ===== Cuestionario inicial ===== */
        <div className="mt-4">
          <p className="font-display text-2xl leading-snug">Calcula tu nivel de juego.</p>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-[var(--muted)]">
            Cinco preguntas para darte un nivel inicial de 0 a 7. Después sube o baja solo con tus partidos competitivos, así
            encuentras partidos parejos. Responde con honestidad: se calcula una sola vez.
          </p>
          <ol className="mt-6 space-y-6">
            {LEVEL_QUESTIONS.map((q, qi) => (
              <li key={q.q}>
                <p className="text-sm font-semibold">
                  {qi + 1}. {q.q}
                </p>
                <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={q.q}>
                  {q.a.map(([label], ai) => {
                    const on = answers[qi] === ai;
                    return (
                      <button
                        key={label}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setAnswers((prev) => prev.map((v, i) => (i === qi ? ai : v)))}
                        className="rounded-full border px-3 py-1.5 text-sm transition-colors"
                        style={{
                          borderColor: on ? "var(--brand)" : "var(--line)",
                          background: on ? "var(--brand)" : "transparent",
                          color: on ? "#fff" : "var(--foreground)",
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ol>
          {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
          <button type="button" className="btn-primary mt-6" onClick={submitQuiz} disabled={saving}>
            {saving ? "Calculando…" : "Calcular mi nivel"}
          </button>
        </div>
      ) : (
        /* ===== Nivel ===== */
        <div className="mt-4">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <div className="font-display text-7xl leading-none tabular-nums">{formatLevel(info.level)}</div>
              <div className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                de 7 · categoría {levelToDivision(info.level)}
              </div>
            </div>
            <div className="min-w-[12rem] flex-1">
              <div className="flex justify-between text-xs text-[var(--muted)]">
                <span>Confiabilidad</span>
                <span className="tabular-nums">{info.reliability}%</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full" style={{ background: "var(--line)" }}>
                <div className="h-full" style={{ width: `${info.reliability}%`, background: "var(--brand)" }} />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
                {info.matches === 0
                  ? "Juega partidos competitivos para que tu nivel se ajuste."
                  : `${info.matches} ${info.matches === 1 ? "partido" : "partidos"} competitivos. Entre más juegas, más estable es tu nivel.`}
              </p>
            </div>
          </div>

          {info.history.length > 0 && (
            <ul className="mt-6 divide-y border-y text-sm" style={{ borderColor: "var(--line)" }}>
              {info.history.map((h, i) => {
                const delta = h.before != null && h.after != null ? h.after - h.before : 0;
                return (
                  <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5" style={{ borderColor: "var(--line)" }}>
                    <span>
                      <span className="font-semibold">
                        {h.outcome === "W" ? "Ganaste" : h.outcome === "L" ? "Perdiste" : "Empate"}
                      </span>{" "}
                      <span className="tabular-nums text-[var(--muted)]">{h.sets.map(([a, b]) => `${a}-${b}`).join(", ")}</span>
                      {h.at && <span className="text-[var(--muted)]"> · {fmtDay(h.at)}</span>}
                    </span>
                    <span className="tabular-nums" style={{ color: delta >= 0 ? "rgb(4,120,87)" : "rgb(153,27,27)" }}>
                      {delta >= 0 ? "+" : ""}
                      {delta.toFixed(2)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <label className="mt-5 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={info.rankingVisible}
              onChange={async (e) => {
                const visible = e.target.checked;
                setInfo({ ...info, rankingVisible: visible });
                await fetch("/api/web/level/visibility", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ visible }),
                }).catch(() => null);
              }}
            />
            Aparecer en el{" "}
            <Link href="/ranking" className="underline underline-offset-4">
              ranking del club
            </Link>
          </label>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <Link href="/partidos" className="font-semibold underline underline-offset-4">
              Buscar partidos de mi nivel
            </Link>
            {!lowering ? (
              <button type="button" className="text-[var(--muted)] underline underline-offset-4" onClick={() => setLowering(true)}>
                Mi nivel está muy alto
              </button>
            ) : (
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[var(--muted)]">Bajarlo a</span>
                <select
                  className="rounded border bg-white px-2 py-1"
                  style={{ borderColor: "var(--line)" }}
                  value={lowerTo ?? ""}
                  onChange={(e) => setLowerTo(Number(e.target.value))}
                >
                  <option value="" disabled>
                    elige
                  </option>
                  {Array.from({ length: Math.floor(info.level / 0.25) }, (_, i) => Math.round((info.level! - 0.25 * (i + 1)) * 100) / 100)
                    .filter((v) => v >= 0)
                    .slice(0, 8)
                    .map((v) => (
                      <option key={v} value={v}>
                        {v.toFixed(2)}
                      </option>
                    ))}
                </select>
                <button type="button" className="btn-secondary !px-3 !py-1.5 !text-[0.68rem]" onClick={lower} disabled={saving || lowerTo == null}>
                  Bajar
                </button>
                <button type="button" className="text-[var(--muted)] underline" onClick={() => setLowering(false)}>
                  Cancelar
                </button>
              </span>
            )}
          </div>
          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        </div>
      )}
    </section>
  );
}
