import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { LevelChange } from "@/lib/levels-shared";

/**
 * Estadísticas del jugador para su perfil (fase 5): partidos jugados (los que
 * reservó y los partidos abiertos a los que se unió), horas en cancha,
 * victorias (resultados confirmados), con quién juega más, horario y cancha
 * favoritos, actividad por mes y evolución de su nivel.
 */

const TZ = "America/Mexico_City";
const PLAYED = ["CONFIRMED", "COMPLETED"];

export type PlayerStats = {
  played: number;
  hours: number;
  results: { wins: number; losses: number; ties: number };
  favoriteHour: string | null;
  favoriteCourt: string | null;
  partners: { name: string; count: number }[];
  monthly: { month: string; count: number }[];
  levelSeries: { at: string; level: number }[];
  recent: { start_at: string; court: string; outcome: "W" | "L" | "T" | null; sets: number[][] | null }[];
};

const mode = <T,>(xs: T[]): T | null => {
  const m = new Map<T, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  let best: T | null = null;
  let n = 0;
  for (const [k, v] of m) if (v > n) [best, n] = [k, v];
  return best;
};

export async function playerStats(userId: string, nowMs = Date.now()): Promise<PlayerStats> {
  const nowIso = new Date(nowMs).toISOString();

  // Partidos que reservó y partidos abiertos a los que se unió.
  const { data: own } = await supabaseAdmin
    .from("bookings")
    .select("id, start_at, end_at, courts ( name )")
    .eq("user_id", userId)
    .in("status", PLAYED)
    .lt("end_at", nowIso)
    .limit(500);
  const { data: myShares } = await supabaseAdmin
    .from("booking_shares")
    .select("booking_id")
    .eq("user_id", userId)
    .eq("status", "PAID")
    .limit(500);
  const joinedIds = [...new Set((myShares ?? []).map((s) => s.booking_id))].filter(
    (id) => !(own ?? []).some((b) => b.id === id)
  );
  const { data: joined } = joinedIds.length
    ? await supabaseAdmin
        .from("bookings")
        .select("id, start_at, end_at, courts ( name )")
        .in("id", joinedIds)
        .in("status", PLAYED)
        .lt("end_at", nowIso)
    : { data: [] };

  const games = [...(own ?? []), ...(joined ?? [])].sort((a, b) => b.start_at.localeCompare(a.start_at));
  const court = (g: { courts: unknown }) => (g.courts as { name: string } | null)?.name ?? "Cancha";
  const hours = games.reduce((acc, g) => acc + (new Date(g.end_at).getTime() - new Date(g.start_at).getTime()) / 3600_000, 0);
  const hourOf = (iso: string) =>
    new Date(iso).toLocaleTimeString("es-MX", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });

  // Resultados confirmados donde jugó.
  const { data: results } = await supabaseAdmin
    .from("match_results")
    .select("booking_id, team_a, team_b, sets, reviewed_at, level_changes")
    .eq("status", "CONFIRMED")
    .order("reviewed_at", { ascending: true })
    .limit(1000);
  const mine = (results ?? []).filter(
    (r) => (r.team_a as string[]).includes(userId) || (r.team_b as string[]).includes(userId)
  );
  const outcomeOf = (r: (typeof mine)[number]) => {
    const inA = (r.team_a as string[]).includes(userId);
    const sets = (r.sets as number[][]).map(([a, b]) => (inA ? [a, b] : [b, a]));
    const won = sets.filter(([m, t]) => m > t).length;
    const lost = sets.length - won;
    return { sets, outcome: (won > lost ? "W" : lost > won ? "L" : "T") as "W" | "L" | "T" };
  };
  const tally = { wins: 0, losses: 0, ties: 0 };
  const byBooking = new Map<string, { sets: number[][]; outcome: "W" | "L" | "T" }>();
  for (const r of mine) {
    const o = outcomeOf(r);
    byBooking.set(r.booking_id, o);
    if (o.outcome === "W") tally.wins++;
    else if (o.outcome === "L") tally.losses++;
    else tally.ties++;
  }

  // Con quién juega más: compañeros de pareja en resultados y, si no hay,
  // los demás jugadores de sus partidos abiertos.
  const partnerCount = new Map<string, number>();
  for (const r of mine) {
    const team = (r.team_a as string[]).includes(userId) ? (r.team_a as string[]) : (r.team_b as string[]);
    for (const p of team) if (p !== userId) partnerCount.set(p, (partnerCount.get(p) ?? 0) + 1);
  }
  if (partnerCount.size === 0 && games.length) {
    const { data: co } = await supabaseAdmin
      .from("booking_shares")
      .select("booking_id, user_id")
      .in(
        "booking_id",
        games.map((g) => g.id)
      )
      .eq("status", "PAID");
    for (const s of co ?? []) {
      if (s.user_id && s.user_id !== userId) partnerCount.set(s.user_id, (partnerCount.get(s.user_id) ?? 0) + 1);
    }
  }
  const topIds = [...partnerCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const { data: names } = topIds.length
    ? await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .in(
          "id",
          topIds.map(([id]) => id)
        )
    : { data: [] as { id: string; full_name: string | null }[] };
  const nameOf = (id: string) => ((names ?? []).find((n) => n.id === id)?.full_name ?? "").trim().split(/\s+/)[0] || "Jugador";

  // Actividad de los últimos 6 meses.
  const monthKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ }).slice(0, 7);
  const monthly: { month: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(nowMs);
    d.setUTCDate(15);
    d.setUTCMonth(d.getUTCMonth() - i);
    const key = monthKey(d);
    monthly.push({ month: key, count: games.filter((g) => monthKey(new Date(g.start_at)) === key).length });
  }

  // Evolución del nivel: el de antes del primer resultado y después de cada uno.
  const levelSeries: { at: string; level: number }[] = [];
  for (const r of mine) {
    const c = (r.level_changes as Record<string, LevelChange> | null)?.[userId];
    if (!c || !r.reviewed_at) continue;
    if (levelSeries.length === 0) levelSeries.push({ at: r.reviewed_at, level: c.before });
    levelSeries.push({ at: r.reviewed_at, level: c.after });
  }

  return {
    played: games.length,
    hours: Math.round(hours * 10) / 10,
    results: tally,
    favoriteHour: mode(games.map((g) => hourOf(g.start_at))),
    favoriteCourt: mode(games.map(court)),
    partners: topIds.map(([id, count]) => ({ name: nameOf(id), count })),
    monthly,
    levelSeries,
    recent: games.slice(0, 6).map((g) => ({
      start_at: g.start_at,
      court: court(g),
      outcome: byBooking.get(g.id)?.outcome ?? null,
      sets: byBooking.get(g.id)?.sets ?? null,
    })),
  };
}
