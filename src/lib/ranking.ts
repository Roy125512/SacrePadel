import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { levelToDivision } from "@/lib/levels-shared";

/**
 * Ranking del club: jugadores con nivel y al menos un partido competitivo
 * confirmado, que no hayan pedido ocultarse. Solo se muestra nombre y
 * inicial del apellido.
 */

export type RankRow = { id: string; name: string; level: number; division: string; matches: number; reliability: number };

export function publicName(full: string | null | undefined) {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Jugador";
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
}

export async function clubRanking(opts: { gender?: "M" | "F" | null; division?: string | null } = {}): Promise<RankRow[]> {
  let q = supabaseAdmin
    .from("profiles")
    .select("id, full_name, sex, level, level_matches, level_reliability, ranking_visible")
    .not("level", "is", null)
    .gte("level_matches", 1)
    .order("level", { ascending: false })
    .limit(500);
  if (opts.gender) q = q.eq("sex", opts.gender);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? [])
    .filter((p) => p.ranking_visible !== false)
    .map((p) => ({
      id: p.id,
      name: publicName(p.full_name),
      level: Number(p.level),
      division: levelToDivision(Number(p.level)),
      matches: p.level_matches ?? 0,
      reliability: p.level_reliability ?? 0,
    }))
    .filter((r) => !opts.division || r.division === opts.division)
    .sort((a, b) => b.level - a.level || b.matches - a.matches);
}

/** Quién jugó más partidos competitivos este mes (resultados confirmados). */
export async function mostActiveThisMonth(limit = 5): Promise<{ name: string; matches: number }[]> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const { data } = await supabaseAdmin
    .from("match_results")
    .select("team_a, team_b")
    .eq("status", "CONFIRMED")
    .gte("reviewed_at", monthStart)
    .limit(2000);
  const count = new Map<string, number>();
  for (const r of data ?? []) for (const id of [...(r.team_a as string[]), ...(r.team_b as string[])]) count.set(id, (count.get(id) ?? 0) + 1);
  const top = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  if (top.length === 0) return [];
  const { data: profs } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, ranking_visible")
    .in(
      "id",
      top.map(([id]) => id)
    );
  return top
    .map(([id, matches]) => ({ p: (profs ?? []).find((x) => x.id === id), matches }))
    .filter((x) => x.p && x.p.ranking_visible !== false)
    .map((x) => ({ name: publicName(x.p!.full_name), matches: x.matches }));
}
