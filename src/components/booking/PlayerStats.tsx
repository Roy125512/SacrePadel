"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PlayerStats as Stats } from "@/lib/playerStats";

const TZ = "America/Mexico_City";
const monthLabel = (ym: string) =>
  new Date(`${ym}-15T12:00:00Z`).toLocaleDateString("es-MX", { month: "short", timeZone: TZ }).replace(".", "");
const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });

/** "Tus estadísticas" del perfil. */
export default function PlayerStats() {
  const [s, setS] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/web/stats", { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        setS(await r.json());
      } catch {
        setFailed(true);
      }
    })();
  }, []);

  if (failed) return null;

  return (
    <section id="estadisticas" className="mt-12 scroll-mt-24">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">Tus estadísticas</p>

      {!s ? (
        <p className="mt-4 text-sm text-[var(--muted)]">Cargando…</p>
      ) : s.played === 0 ? (
        <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
          Aquí verás tus partidos, horas en cancha, victorias y con quién juegas más.{" "}
          <Link href="/reservar" className="font-semibold text-[var(--foreground)] underline underline-offset-4">
            Reserva tu primer partido
          </Link>{" "}
          o{" "}
          <Link href="/partidos" className="font-semibold text-[var(--foreground)] underline underline-offset-4">
            únete a uno
          </Link>
          .
        </p>
      ) : (
        <>
          {/* Cifras */}
          <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden border sm:grid-cols-4" style={{ borderColor: "var(--line)", background: "var(--line)" }}>
            {(() => {
              const decided = s.results.wins + s.results.losses + s.results.ties;
              return [
                ["Partidos", String(s.played)],
                ["Horas en cancha", String(s.hours)],
                ["Victorias", decided ? `${Math.round((s.results.wins / decided) * 100)}%` : "—"],
                ["Tu horario", s.favoriteHour ?? "—"],
              ];
            })().map(([k, v]) => (
              <div key={k} className="bg-[var(--background)] px-4 py-4">
                <dt className="text-[0.62rem] uppercase tracking-[0.2em] text-[var(--muted)]">{k}</dt>
                <dd className="font-display mt-1 text-3xl tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          {(s.results.wins + s.results.losses + s.results.ties > 0 || s.favoriteCourt) && (
            <p className="mt-2 text-xs text-[var(--muted)]">
              {s.results.wins + s.results.losses + s.results.ties > 0 &&
                `${s.results.wins} ${s.results.wins === 1 ? "ganado" : "ganados"} · ${s.results.losses} ${
                  s.results.losses === 1 ? "perdido" : "perdidos"
                }${s.results.ties ? ` · ${s.results.ties} ${s.results.ties === 1 ? "empate" : "empates"}` : ""} en partidos competitivos. `}
              {s.favoriteCourt && `Tu cancha: ${s.favoriteCourt}.`}
            </p>
          )}

          <div className="mt-8 grid gap-8 sm:grid-cols-2">
            {/* Actividad por mes */}
            <div>
              <p className="text-[0.62rem] uppercase tracking-[0.2em] text-[var(--muted)]">Partidos por mes</p>
              {(() => {
                const max = Math.max(1, ...s.monthly.map((m) => m.count));
                return (
                  <div className="mt-3 flex h-28 items-end gap-2" role="img" aria-label="Partidos por mes">
                    {s.monthly.map((m) => (
                      <div key={m.month} className="flex flex-1 flex-col items-center gap-1.5">
                        <span className="text-[0.65rem] tabular-nums text-[var(--muted)]">{m.count || ""}</span>
                        <div
                          className="w-full"
                          style={{ height: `${(m.count / max) * 72 + 2}px`, background: m.count ? "var(--brand)" : "var(--line)" }}
                        />
                        <span className="text-[0.65rem] capitalize text-[var(--muted)]">{monthLabel(m.month)}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Evolución del nivel */}
            <div>
              <p className="text-[0.62rem] uppercase tracking-[0.2em] text-[var(--muted)]">Evolución de tu nivel</p>
              {s.levelSeries.length < 2 ? (
                <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
                  Juega partidos competitivos y confirma los resultados para ver cómo cambia tu nivel.
                </p>
              ) : (
                (() => {
                  const pts = s.levelSeries.map((p) => p.level);
                  const lo = Math.min(...pts) - 0.1;
                  const hi = Math.max(...pts) + 0.1;
                  const W = 300;
                  const H = 96;
                  const xy = pts.map((v, i) => [(i / (pts.length - 1)) * W, H - ((v - lo) / (hi - lo)) * H]);
                  const last = pts[pts.length - 1];
                  const delta = last - pts[0];
                  return (
                    <div className="mt-3">
                      <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full overflow-visible" role="img" aria-label="Evolución del nivel">
                        <polyline
                          fill="none"
                          stroke="var(--brand)"
                          strokeWidth="2"
                          vectorEffect="non-scaling-stroke"
                          points={xy.map(([x, y]) => `${x},${y}`).join(" ")}
                        />
                        {xy.map(([x, y], i) => (
                          <circle key={i} cx={x} cy={y} r="3" fill="var(--brand)" />
                        ))}
                      </svg>
                      <p className="mt-2 text-sm tabular-nums">
                        {pts[0].toFixed(2)} → <b>{last.toFixed(2)}</b>{" "}
                        <span style={{ color: delta >= 0 ? "rgb(4,120,87)" : "rgb(153,27,27)" }}>
                          ({delta >= 0 ? "+" : ""}
                          {delta.toFixed(2)})
                        </span>
                      </p>
                    </div>
                  );
                })()
              )}
            </div>
          </div>

          {s.partners.length > 0 && (
            <div className="mt-8">
              <p className="text-[0.62rem] uppercase tracking-[0.2em] text-[var(--muted)]">Con quién juegas más</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {s.partners.map((p) => (
                  <li key={p.name} className="flex items-center gap-2 border px-3 py-1.5 text-sm" style={{ borderColor: "var(--line)" }}>
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[0.7rem] font-semibold text-white"
                      style={{ background: "var(--brand)" }}
                      aria-hidden
                    >
                      {p.name.slice(0, 1).toUpperCase()}
                    </span>
                    {p.name}
                    <span className="text-xs text-[var(--muted)]">
                      {p.count} {p.count === 1 ? "partido" : "partidos"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8">
            <p className="text-[0.62rem] uppercase tracking-[0.2em] text-[var(--muted)]">Últimos partidos</p>
            <ul className="mt-3 divide-y border-y text-sm" style={{ borderColor: "var(--line)" }}>
              {s.recent.map((g, i) => (
                <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5" style={{ borderColor: "var(--line)" }}>
                  <span className="first-letter:uppercase">
                    {fmtDay(g.start_at)} · {g.court}
                  </span>
                  <span className="tabular-nums text-[var(--muted)]">
                    {g.outcome ? (
                      <>
                        <b style={{ color: g.outcome === "W" ? "rgb(4,120,87)" : g.outcome === "L" ? "rgb(153,27,27)" : "inherit" }}>
                          {g.outcome === "W" ? "Ganaste" : g.outcome === "L" ? "Perdiste" : "Empate"}
                        </b>{" "}
                        {g.sets?.map(([a, b]) => `${a}-${b}`).join(", ")}
                      </>
                    ) : (
                      "Jugado"
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
