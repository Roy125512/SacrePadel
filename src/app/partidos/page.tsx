import type { Metadata } from "next";
import Link from "next/link";
import { listOpenMatches, type OpenMatchCard } from "@/lib/openMatches";
import {
  MATCH_GENDER_LABEL,
  MATCH_TYPE_LABEL,
  formatMXN,
  levelRangeLabel,
  type MatchGender,
  type MatchType,
} from "@/lib/config";

export const metadata: Metadata = {
  title: "Partidos abiertos",
  description: "Únete a un partido de pádel en Sacré Pádel, Pátzcuaro: elige tu nivel, paga tu lugar y juega.",
};
export const dynamic = "force-dynamic";

const TZ = "America/Mexico_City";
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-MX", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });

/** Partidos abiertos: lista pública de partidos con lugares libres. */
export default async function PartidosPage() {
  const matches = await listOpenMatches().catch((e) => {
    console.error("listOpenMatches", e);
    return [] as OpenMatchCard[];
  });
  const days = new Map<string, OpenMatchCard[]>();
  for (const m of matches) days.set(dayKey(m.start_at), [...(days.get(dayKey(m.start_at)) ?? []), m]);

  return (
    <div className="page">
      <div className="mx-auto max-w-4xl px-6 pb-24 pt-28 sm:pt-32">
        <p className="text-[0.72rem] uppercase tracking-[0.3em] text-[var(--brand)]">Partidos abiertos</p>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-6">
          <h1 className="font-display text-5xl leading-[1.02] sm:text-6xl">
            Encuentra <em>con quién</em> jugar.
          </h1>
          <Link href="/reservar" className="btn-secondary">
            Crear un partido
          </Link>
        </div>
        <p className="mt-5 max-w-xl leading-relaxed text-[var(--muted)]">
          Únete a un partido de tu nivel y paga solo tu lugar. Si al final no puedes, sales sin costo hasta 24 h antes.
        </p>

        {matches.length === 0 ? (
          <div className="mt-12 border-y py-10" style={{ borderColor: "var(--line)" }}>
            <p className="font-display text-2xl">Por ahora no hay partidos abiertos.</p>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--muted)]">
              Crea uno: reserva una cancha, elige <b>Partido abierto</b> y paga solo tu lugar. Lo publicamos aquí para que
              se unan jugadores de tu nivel.
            </p>
            <Link href="/reservar" className="btn-primary mt-6 inline-flex">
              Crear un partido
            </Link>
          </div>
        ) : (
          [...days.entries()].map(([key, list]) => (
            <section key={key} className="mt-12">
              <h2 className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)] first-letter:uppercase">
                {dayLabel(list[0].start_at)}
              </h2>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {list.map((m) => (
                  <li key={m.token}>
                    <Link
                      href={`/reserva/pagar?t=${m.token}`}
                      className="group block border bg-[var(--surface)] p-5 transition-colors hover:border-[var(--brand)]"
                      style={{ borderColor: "var(--line)" }}
                    >
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="font-display text-3xl tabular-nums">{time(m.start_at)}</span>
                        <span className="text-sm text-[var(--muted)]">
                          {m.court_name} · {time(m.start_at)}–{time(m.end_at)}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.16em]">
                        {[
                          MATCH_TYPE_LABEL[(m.match_type ?? "FRIENDLY") as MatchType],
                          MATCH_GENDER_LABEL[(m.match_gender ?? "ANY") as MatchGender],
                          levelRangeLabel(m.match_level_min, m.match_level_max),
                        ].map((t) => (
                          <span key={t} className="border px-2 py-0.5" style={{ borderColor: "var(--line)" }}>
                            {t}
                          </span>
                        ))}
                      </div>
                      {/* Lugares: iniciales de quien ya está y huecos libres */}
                      <div className="mt-5 flex items-center gap-2">
                        {m.players.map((p, i) => (
                          <span
                            key={i}
                            title={`${p.name}${p.level != null ? ` · nivel ${p.level.toFixed(2)}` : p.division ? ` · ${p.division}` : ""}`}
                            className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white"
                            style={{ background: "var(--brand)" }}
                          >
                            {p.name.slice(0, 1).toUpperCase()}
                          </span>
                        ))}
                        {Array.from({ length: m.spots_left }, (_, i) => (
                          <span
                            key={`free-${i}`}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed text-sm text-[var(--muted)]"
                            style={{ borderColor: "var(--brand-200)" }}
                            aria-hidden
                          >
                            +
                          </span>
                        ))}
                        <span className="ml-auto text-right text-sm">
                          {m.spots_left === 0 ? (
                            <span className="text-[var(--muted)]">Completo</span>
                          ) : (
                            <>
                              <span className="font-semibold tabular-nums">{formatMXN(m.share_amount)}</span>
                              <span className="block text-xs text-[var(--muted)]">
                                {m.spots_left === 1 ? "1 lugar libre" : `${m.spots_left} lugares libres`}
                              </span>
                            </>
                          )}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
