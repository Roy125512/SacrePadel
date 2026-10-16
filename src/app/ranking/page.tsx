import type { Metadata } from "next";
import Link from "next/link";
import { clubRanking, mostActiveThisMonth, type RankRow } from "@/lib/ranking";
import { formatLevel } from "@/lib/levels-shared";
import { DIVISIONS } from "@/lib/config";

export const metadata: Metadata = {
  title: "Ranking del club",
  description: "Los niveles de los jugadores de Sacré Pádel, Pátzcuaro, por categoría.",
};
export const dynamic = "force-dynamic";

type Search = { g?: string; c?: string };

/** Ranking público por nivel (0–7), con filtros de género y categoría. */
export default async function RankingPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const gender = sp.g === "M" || sp.g === "F" ? sp.g : null;
  const division = DIVISIONS.some((d) => d.code === sp.c) ? sp.c! : null;
  const [rows, active] = await Promise.all([
    clubRanking({ gender, division }).catch((): RankRow[] => []),
    mostActiveThisMonth().catch(() => []),
  ]);
  const href = (g: string | null, c: string | null) => {
    const q = new URLSearchParams();
    if (g) q.set("g", g);
    if (c) q.set("c", c);
    const s = q.toString();
    return s ? `/ranking?${s}` : "/ranking";
  };
  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm transition-colors ${on ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] hover:border-[var(--brand)]"}`;

  return (
    <div className="page">
      <div className="mx-auto max-w-3xl px-6 pb-24 pt-28 sm:pt-32">
        <p className="text-[0.72rem] uppercase tracking-[0.3em] text-[var(--brand)]">Ranking del club</p>
        <h1 className="font-display mt-5 text-5xl leading-[1.02] sm:text-6xl">
          Los que <em>más</em> juegan.
        </h1>
        <p className="mt-5 max-w-xl leading-relaxed text-[var(--muted)]">
          Nivel de 0 a 7 que se ajusta con los partidos competitivos. Aparecen quienes ya tienen al menos un resultado
          confirmado.{" "}
          <Link href="/perfil#nivel" className="underline underline-offset-4">Ver mi nivel</Link>
        </p>

        {active.length > 0 && (
          <div className="mt-8 border-y py-5" style={{ borderColor: "var(--line)" }}>
            <p className="text-[0.72rem] uppercase tracking-[0.2em] text-[var(--muted)]">Más activos este mes</p>
            <ol className="mt-3 flex flex-wrap gap-2 text-sm">
              {active.map((a, i) => (
                <li key={a.name + i} className="border px-3 py-1.5" style={{ borderColor: "var(--line)" }}>
                  {i === 0 ? "🔥 " : ""}
                  {a.name} <span className="text-[var(--muted)]">· {a.matches}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <nav className="mt-8 flex flex-wrap gap-2" aria-label="Género">
          {[
            [null, "Todos"],
            ["M", "Varonil"],
            ["F", "Femenil"],
          ].map(([g, l]) => (
            <Link key={l} href={href(g, division)} className={chip(gender === g)}>
              {l}
            </Link>
          ))}
        </nav>
        <nav className="mt-3 flex flex-wrap gap-2" aria-label="Categoría">
          <Link href={href(gender, null)} className={chip(!division)}>
            Todas
          </Link>
          {DIVISIONS.map((d) => (
            <Link key={d.code} href={href(gender, d.code)} className={chip(division === d.code)}>
              {d.code}
            </Link>
          ))}
        </nav>

        {rows.length === 0 ? (
          <p className="mt-10 text-[var(--muted)]">
            Todavía no hay jugadores aquí. Juega un{" "}
            <Link href="/partidos" className="underline underline-offset-4">partido competitivo</Link> y confirma el resultado
            para aparecer.
          </p>
        ) : (
          <ol className="mt-8 divide-y border-y" style={{ borderColor: "var(--line)" }}>
            {rows.map((r, i) => (
              <li key={r.id} className="flex items-center gap-4 py-3.5" style={{ borderColor: "var(--line)" }}>
                <span className={`w-8 text-right tabular-nums ${i < 3 ? "font-display text-2xl" : "text-[var(--muted)]"}`}>{i + 1}</span>
                <span className="flex-1">
                  <span className={i < 3 ? "font-semibold" : ""}>{r.name}</span>
                  <span className="block text-xs text-[var(--muted)]">
                    {r.division} · {r.matches} {r.matches === 1 ? "partido" : "partidos"} · confiabilidad {r.reliability}%
                  </span>
                </span>
                <span className="font-display text-2xl tabular-nums">{formatLevel(r.level)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
