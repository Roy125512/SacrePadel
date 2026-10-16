import type { Metadata } from "next";
import Link from "next/link";
import { EVENT_KIND_LABEL, listPublicEvents } from "@/lib/events";
import { americanaStandings } from "@/lib/americana";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { MATCH_GENDER_LABEL, levelRangeLabel, type MatchGender } from "@/lib/config";

export const metadata: Metadata = {
  title: "Torneos y americanas",
  description: "Torneos, americanas y eventos de pádel en Sacré Pádel, Pátzcuaro. Inscríbete y paga en línea.",
};
export const dynamic = "force-dynamic";

const TZ = "America/Mexico_City";
const nowMs = () => Date.now();
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-MX", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });

/** Torneos y americanas: próximos (para inscribirse) y recientes (con ganador). */
export default async function TorneosPage() {
  const events = await listPublicEvents().catch((e) => {
    console.error("listPublicEvents", e);
    return [];
  });
  const now = nowMs();
  const upcoming = events.filter((e) => new Date(e.ends_at).getTime() > now && e.status !== "FINISHED");
  const past = events.filter((e) => !upcoming.includes(e)).reverse();

  // Ganador de las americanas terminadas.
  const winners = new Map<string, string>();
  for (const e of past) {
    if (!e.rounds) continue;
    const { data: regs } = await supabaseAdmin
      .from("event_registrations")
      .select("user_id, player_name")
      .eq("event_id", e.id)
      .eq("status", "CONFIRMED");
    const top = americanaStandings((regs ?? []).map((r) => r.user_id), e.rounds)[0];
    const name = (regs ?? []).find((r) => r.user_id === top?.id)?.player_name;
    if (top && top.points > 0 && name) winners.set(e.id, `${name.split(" ")[0]} · ${top.points} pts`);
  }

  return (
    <div className="page">
      <div className="mx-auto max-w-4xl px-6 pb-24 pt-28 sm:pt-32">
        <p className="text-[0.72rem] uppercase tracking-[0.3em] text-[var(--brand)]">Torneos y americanas</p>
        <h1 className="font-display mt-5 text-5xl leading-[1.02] sm:text-6xl">
          Juega <em>algo más</em> que un partido.
        </h1>
        <p className="mt-5 max-w-xl leading-relaxed text-[var(--muted)]">
          Americanas para conocer gente de tu nivel, torneos y eventos del club. Te inscribes y pagas en línea; si no
          puedes ir, cancelas sin costo hasta 24 h antes.
        </p>

        {upcoming.length === 0 ? (
          <div className="mt-12 border-y py-10" style={{ borderColor: "var(--line)" }}>
            <p className="font-display text-2xl">Pronto anunciamos el siguiente.</p>
            <p className="mt-3 text-sm text-[var(--muted)]">
              Mientras, <Link href="/partidos" className="underline underline-offset-4">únete a un partido abierto</Link>.
            </p>
          </div>
        ) : (
          <ul className="mt-12 grid gap-4 sm:grid-cols-2">
            {upcoming.map((e) => {
              const left = e.capacity - e.taken;
              return (
                <li key={e.id}>
                  <Link
                    href={`/torneos/${e.id}`}
                    className="block h-full border bg-[var(--surface)] p-5 transition-colors hover:border-[var(--brand)]"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <span className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">
                      {EVENT_KIND_LABEL[e.kind]}
                    </span>
                    <h2 className="font-display mt-1 text-2xl leading-tight">{e.title}</h2>
                    <p className="mt-1 text-sm text-[var(--muted)] first-letter:uppercase">
                      {day(e.starts_at)} · {time(e.starts_at)}–{time(e.ends_at)}
                    </p>
                    <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                      {levelRangeLabel(e.level_min, e.level_max)} · {MATCH_GENDER_LABEL[(e.gender ?? "ANY") as MatchGender]}
                    </p>
                    <div className="mt-4 flex items-end justify-between">
                      <span className="font-semibold tabular-nums">
                        {e.price > 0 ? `$${e.price}` : "Gratis"}
                        <span className="text-xs font-normal text-[var(--muted)]"> {e.entry === "PAIR" ? "por pareja" : "por persona"}</span>
                      </span>
                      <span className="text-sm text-[var(--muted)]">
                        {e.status !== "OPEN" ? "Inscripciones cerradas" : left <= 0 ? "Cupo lleno" : left === 1 ? "1 lugar" : `${left} lugares`}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {past.length > 0 && (
          <>
            <p className="mt-14 text-[0.72rem] uppercase tracking-[0.2em] text-[var(--muted)]">Recientes</p>
            <ul className="mt-3 divide-y border-y text-sm" style={{ borderColor: "var(--line)" }}>
              {past.map((e) => (
                <li key={e.id} style={{ borderColor: "var(--line)" }}>
                  <Link href={`/torneos/${e.id}`} className="flex flex-wrap justify-between gap-x-6 gap-y-1 py-3 hover:text-[var(--brand)]">
                    <span>
                      <span className="inline-block first-letter:uppercase">{day(e.starts_at)}</span> · {e.title}
                    </span>
                    <span className="text-[var(--muted)]">{winners.has(e.id) ? `🏆 ${winners.get(e.id)}` : "Ver resultados"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
