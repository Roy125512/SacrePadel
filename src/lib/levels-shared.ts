// Nivel de juego de 0 a 7 (como Playtomic). Funciones puras: sirven en el
// navegador (cuestionario, validar marcador) y en el servidor (calcular).

export const LEVEL_MIN = 0;
export const LEVEL_MAX = 7;
/** Días después del partido para capturar y confirmar el resultado. */
export const RESULT_WINDOW_DAYS = 7;

/** Cuestionario del nivel inicial: puntos por respuesta. */
export const LEVEL_QUESTIONS = [
  {
    q: "¿Cuánto tiempo llevas jugando pádel?",
    a: [
      ["Estoy empezando", 0],
      ["Menos de 6 meses", 0.5],
      ["De 6 meses a 2 años", 1],
      ["De 2 a 5 años", 1.5],
      ["Más de 5 años", 2],
    ],
  },
  {
    q: "¿Qué tan seguido juegas?",
    a: [
      ["Casi nunca", 0],
      ["Una vez al mes", 0.25],
      ["Una vez por semana", 0.5],
      ["2 o 3 veces por semana", 0.75],
      ["Más de 3 veces por semana", 1],
    ],
  },
  {
    q: "¿Has jugado tenis, squash u otro deporte de raqueta?",
    a: [
      ["No", 0],
      ["Algo, por diversión", 0.5],
      ["Sí, a nivel competitivo", 1],
    ],
  },
  {
    q: "¿Cómo te va con las paredes?",
    a: [
      ["Todavía me cuestan", 0],
      ["Devuelvo algunas", 0.5],
      ["Las controlo casi siempre", 1],
      ["Las uso para atacar", 1.5],
    ],
  },
  {
    q: "¿Juegas torneos o ligas?",
    a: [
      ["No", 0],
      ["Torneos sociales", 0.5],
      ["Categoría 5ta o 4ta", 1],
      ["Categoría 3ra o superior", 2],
    ],
  },
] as const;

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number) => Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, n));

/** Nivel inicial a partir de las respuestas (índice elegido por pregunta). */
export function initialLevelFromAnswers(answers: number[]): number | null {
  if (answers.length !== LEVEL_QUESTIONS.length) return null;
  let sum = 0;
  for (let i = 0; i < answers.length; i++) {
    const opt = LEVEL_QUESTIONS[i].a[answers[i]];
    if (!opt) return null;
    sum += opt[1];
  }
  // 0 puntos → 0.5 (principiante); 7.5 puntos → 6.5.
  return round2(0.5 + sum * 0.8);
}

/** La división (categoría) que corresponde a un nivel. */
export function levelToDivision(level: number): string {
  if (level >= 6) return "1ra";
  if (level >= 5) return "2da";
  if (level >= 4) return "3ra";
  if (level >= 3) return "4ta";
  if (level >= 2) return "5ta";
  return "6ta";
}

/** Nivel aproximado de una división, para quien aún no tiene nivel. */
export function divisionToLevel(division: string | null | undefined): number {
  const map: Record<string, number> = { "1ra": 6.25, "2da": 5.25, "3ra": 4.25, "4ta": 3.25, "5ta": 2.25, "6ta": 1.25 };
  return map[(division ?? "").trim()] ?? 2.5;
}

export function formatLevel(level: number | null | undefined) {
  return level == null ? "—" : Number(level).toFixed(2);
}

/** Set válido: 6 con 2 de ventaja (6-0 … 6-4), 7-5 o 7-6. */
export function validSet(a: number, b: number): boolean {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return false;
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi === 6 && lo <= 4) || (hi === 7 && (lo === 5 || lo === 6));
}

export type Outcome = { winner: "A" | "B" | "TIE"; gamesA: number; gamesB: number };

/**
 * Valida el marcador (máximo 3 sets, al menos 2 completos) y dice quién ganó.
 * Con 2 sets repartidos (1-1) es empate; con 3, el tercero decide.
 */
export function parseSets(sets: number[][]): Outcome | { error: string } {
  if (!Array.isArray(sets) || sets.length < 2 || sets.length > 3) return { error: "Captura 2 o 3 sets." };
  for (const s of sets) {
    if (!Array.isArray(s) || s.length !== 2 || !validSet(s[0], s[1])) {
      return { error: "Revisa el marcador: cada set termina 6 con 2 de ventaja, 7-5 o 7-6." };
    }
  }
  const wonA = sets.filter(([a, b]) => a > b).length;
  const wonB = sets.length - wonA;
  if (sets.length === 3) {
    const [s1, s2] = sets;
    if (s1[0] > s1[1] === s2[0] > s2[1]) return { error: "Si alguien ganó los 2 primeros sets, no hay tercero." };
  }
  const gamesA = sets.reduce((acc, [a]) => acc + a, 0);
  const gamesB = sets.reduce((acc, [, b]) => acc + b, 0);
  return { winner: wonA > wonB ? "A" : wonB > wonA ? "B" : "TIE", gamesA, gamesB };
}

export type RatedPlayer = { id: string; level: number; reliability: number };
export type LevelChange = { before: number; after: number; reliabilityAfter: number };

/**
 * Ajuste tipo Elo con el promedio de cada pareja: se compara el resultado
 * esperado (por la diferencia de nivel) con el real (quién ganó y por cuánto).
 * Ganarle a una pareja más fuerte sube más; perder con una más débil baja
 * más. Un empate también mueve si los niveles eran distintos. Quien tiene
 * poca confiabilidad se mueve más rápido.
 */
export function computeLevelChanges(
  teamA: RatedPlayer[],
  teamB: RatedPlayer[],
  outcome: Outcome
): Record<string, LevelChange> {
  const avg = (t: RatedPlayer[]) => t.reduce((s, p) => s + p.level, 0) / t.length;
  const la = avg(teamA);
  const lb = avg(teamB);
  const expectedA = 1 / (1 + Math.pow(10, (lb - la) / 2));
  const result = outcome.winner === "A" ? 1 : outcome.winner === "B" ? 0 : 0.5;
  const games = outcome.gamesA + outcome.gamesB;
  const scoreA = 0.7 * result + 0.3 * (games > 0 ? outcome.gamesA / games : 0.5);

  const out: Record<string, LevelChange> = {};
  const apply = (p: RatedPlayer, score: number, expected: number) => {
    const k = 0.05 + 0.3 * (1 - p.reliability / 100);
    out[p.id] = {
      before: round2(p.level),
      after: round2(clamp(p.level + k * (score - expected))),
      reliabilityAfter: Math.min(100, p.reliability + 10),
    };
  };
  for (const p of teamA) apply(p, scoreA, expectedA);
  for (const p of teamB) apply(p, 1 - scoreA, 1 - expectedA);
  return out;
}
