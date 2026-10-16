// Americana: cada jugador se inscribe solo y en cada ronda juega con una
// pareja distinta contra rivales distintos. Gana quien sume más puntos (los
// juegos o puntos que hizo su pareja en cada partido). Funciones puras.

export type AmericanaMatch = {
  court: number; // índice de la cancha del evento (0, 1, …)
  teamA: [string, string];
  teamB: [string, string];
  scoreA: number | null;
  scoreB: number | null;
};
export type AmericanaRound = { round: number; matches: AmericanaMatch[]; resting: string[] };

export type Standing = {
  id: string;
  points: number;
  played: number;
  won: number;
  diff: number;
};

type Rng = () => number;

function shuffle<T>(xs: T[], rng: Rng): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Arma `rounds` rondas para estos jugadores con `courts` canchas. En cada
 * ronda juegan 4 por cancha; si sobran (o no alcanzan las canchas),
 * descansan quienes menos han descansado. Las parejas y rivales se eligen
 * probando muchas combinaciones al azar y quedándose con la que menos
 * repite: primero que no se repita pareja, luego que no se repitan rivales.
 */
export function generateAmericana(players: string[], courts: number, rounds: number, rng: Rng = Math.random): AmericanaRound[] {
  if (players.length < 4 || courts < 1 || rounds < 1) return [];
  const perRound = Math.min(Math.floor(players.length / 4), courts) * 4;
  const partners = new Map<string, number>();
  const opponents = new Map<string, number>();
  const rested = new Map<string, number>(players.map((p) => [p, 0]));
  const out: AmericanaRound[] = [];

  for (let r = 1; r <= rounds; r++) {
    // Descansan los que menos han descansado (desempate al azar).
    const order = shuffle(players, rng).sort((a, b) => (rested.get(a) ?? 0) - (rested.get(b) ?? 0));
    const resting = order.slice(0, players.length - perRound);
    const playing = players.filter((p) => !resting.includes(p));
    for (const p of resting) rested.set(p, (rested.get(p) ?? 0) + 1);

    let best: AmericanaMatch[] = [];
    let bestCost = Infinity;
    for (let attempt = 0; attempt < 400 && bestCost > 0; attempt++) {
      const s = shuffle(playing, rng);
      const matches: AmericanaMatch[] = [];
      let cost = 0;
      for (let i = 0; i < s.length; i += 4) {
        const [a, b, c, d] = s.slice(i, i + 4);
        cost += 100 * ((partners.get(key(a, b)) ?? 0) + (partners.get(key(c, d)) ?? 0));
        for (const x of [a, b]) for (const y of [c, d]) cost += opponents.get(key(x, y)) ?? 0;
        matches.push({ court: i / 4, teamA: [a, b], teamB: [c, d], scoreA: null, scoreB: null });
      }
      if (cost < bestCost) {
        bestCost = cost;
        best = matches;
      }
    }
    for (const m of best) {
      partners.set(key(...m.teamA), (partners.get(key(...m.teamA)) ?? 0) + 1);
      partners.set(key(...m.teamB), (partners.get(key(...m.teamB)) ?? 0) + 1);
      for (const x of m.teamA) for (const y of m.teamB) opponents.set(key(x, y), (opponents.get(key(x, y)) ?? 0) + 1);
    }
    out.push({ round: r, matches: best, resting });
  }
  return out;
}

/** Tabla: puntos, luego partidos ganados, luego diferencia. */
export function americanaStandings(players: string[], rounds: AmericanaRound[]): Standing[] {
  const t = new Map<string, Standing>(players.map((id) => [id, { id, points: 0, played: 0, won: 0, diff: 0 }]));
  for (const r of rounds) {
    for (const m of r.matches) {
      if (m.scoreA == null || m.scoreB == null) continue;
      const side = (ids: string[], mine: number, theirs: number) => {
        for (const id of ids) {
          const s = t.get(id);
          if (!s) continue;
          s.points += mine;
          s.played += 1;
          s.diff += mine - theirs;
          if (mine > theirs) s.won += 1;
        }
      };
      side(m.teamA, m.scoreA, m.scoreB);
      side(m.teamB, m.scoreB, m.scoreA);
    }
  }
  return [...t.values()].sort((a, b) => b.points - a.points || b.won - a.won || b.diff - a.diff);
}

/** Rondas recomendadas: que cada quien juegue con varias parejas sin alargarse. */
export function suggestedRounds(players: number) {
  return Math.max(3, Math.min(7, players - 1));
}
