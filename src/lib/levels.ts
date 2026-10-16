import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/mailer";
import { mxParts } from "@/lib/bookingNotifications";
import { SITE } from "@/lib/site";
import {
  RESULT_WINDOW_DAYS,
  computeLevelChanges,
  divisionToLevel,
  initialLevelFromAnswers,
  parseSets,
  type LevelChange,
} from "@/lib/levels-shared";

/**
 * Nivel de juego (fase 4). Cuentan solo los partidos abiertos COMPETITIVOS
 * con sus 4 lugares ocupados por jugadores con cuenta. Un jugador captura el
 * resultado; alguien de la pareja contraria lo confirma o lo rechaza, hasta
 * RESULT_WINDOW_DAYS días después del partido. Al confirmarse se ajusta el
 * nivel de los 4 (ver computeLevelChanges).
 */

export type MatchResultRow = {
  id: string;
  team_a: string[];
  team_b: string[];
  sets: number[][];
  status: "PENDING" | "CONFIRMED" | "REJECTED";
  submitted_by: string;
  level_changes: Record<string, LevelChange> | null;
};

export type MatchContext = {
  bookingId: string;
  competitive: boolean;
  players: string[]; // user ids, en orden de lugar
  endAt: string;
  startAt: string;
  courtName: string;
  cancelled: boolean;
  result: MatchResultRow | null;
  /** Se puede capturar o confirmar ahora (ya terminó y no han pasado 7 días). */
  windowOpen: boolean;
};

const DAY = 86400_000;

export async function matchContext(bookingId: string): Promise<MatchContext | null> {
  const { data: b } = await supabaseAdmin
    .from("bookings")
    .select("id, status, start_at, end_at, is_open_match, match_type, courts ( name )")
    .eq("id", bookingId)
    .maybeSingle();
  if (!b || !b.is_open_match) return null;
  const { data: shares } = await supabaseAdmin
    .from("booking_shares")
    .select("seq, status, user_id")
    .eq("booking_id", bookingId)
    .order("seq", { ascending: true });
  const players = [
    ...new Set((shares ?? []).filter((s) => s.status === "PAID" && s.user_id).map((s) => s.user_id as string)),
  ];
  const { data: r } = await supabaseAdmin
    .from("match_results")
    .select("id, team_a, team_b, sets, status, submitted_by, level_changes")
    .eq("booking_id", bookingId)
    .maybeSingle();
  const end = new Date(b.end_at).getTime();
  const now = Date.now();
  return {
    bookingId,
    competitive: b.match_type === "COMPETITIVE",
    players,
    startAt: b.start_at,
    endAt: b.end_at,
    courtName: (b.courts as { name: string } | null)?.name ?? "Cancha",
    cancelled: b.status === "CANCELLED",
    result: (r as unknown as MatchResultRow) ?? null,
    windowOpen: now >= end && now <= end + RESULT_WINDOW_DAYS * DAY,
  };
}

/** Por qué no se puede capturar el resultado (o null si se puede). */
export function submitBlock(ctx: MatchContext, userId: string): string | null {
  if (!ctx.competitive) return "Solo los partidos competitivos cuentan para el nivel.";
  if (ctx.cancelled) return "Este partido se canceló.";
  if (ctx.players.length !== 4) return "Para contar, los 4 lugares deben ser de jugadores con cuenta.";
  if (!ctx.players.includes(userId)) return "Solo los jugadores del partido pueden capturar el resultado.";
  if (!ctx.windowOpen) {
    return new Date(ctx.endAt).getTime() > Date.now()
      ? "El resultado se captura cuando termine el partido."
      : `Ya pasaron ${RESULT_WINDOW_DAYS} días: este resultado ya no cuenta.`;
  }
  if (ctx.result && ctx.result.status !== "REJECTED") return "Este partido ya tiene resultado.";
  return null;
}

export type ActionResult = { ok: true } | { ok: false; message: string };

export async function submitResult(
  bookingId: string,
  userId: string,
  partnerId: string,
  sets: number[][]
): Promise<ActionResult> {
  const ctx = await matchContext(bookingId);
  if (!ctx) return { ok: false, message: "No encontramos este partido." };
  const block = submitBlock(ctx, userId);
  if (block) return { ok: false, message: block };
  if (partnerId === userId || !ctx.players.includes(partnerId)) return { ok: false, message: "Elige a tu pareja." };
  const parsed = parseSets(sets);
  if ("error" in parsed) return { ok: false, message: parsed.error };

  const teamA = [userId, partnerId];
  const teamB = ctx.players.filter((p) => !teamA.includes(p));
  const row = {
    booking_id: bookingId,
    team_a: teamA,
    team_b: teamB,
    sets,
    status: "PENDING",
    submitted_by: userId,
    submitted_at: new Date().toISOString(),
    reviewed_by: null,
    reviewed_at: null,
    level_changes: null,
  };
  // Reemplaza un resultado rechazado; nunca uno pendiente o confirmado.
  if (ctx.result) {
    const { data, error } = await supabaseAdmin
      .from("match_results")
      .update(row)
      .eq("id", ctx.result.id)
      .eq("status", "REJECTED")
      .select("id")
      .maybeSingle();
    if (error || !data) return { ok: false, message: "El resultado cambió mientras tanto. Recarga la página." };
  } else {
    const { error } = await supabaseAdmin.from("match_results").insert(row);
    if (error) return { ok: false, message: "Alguien ya capturó el resultado. Recarga la página." };
  }

  await notifyReviewers(bookingId, teamB, ctx).catch((e) => console.error("notifyReviewers", e));
  return { ok: true };
}

/** La pareja contraria confirma (y se ajustan los niveles) o rechaza. */
export async function reviewResult(bookingId: string, userId: string, accept: boolean): Promise<ActionResult> {
  const ctx = await matchContext(bookingId);
  const r = ctx?.result;
  if (!ctx || !r) return { ok: false, message: "Este partido no tiene resultado por confirmar." };
  if (r.status !== "PENDING") return { ok: false, message: "Este resultado ya se revisó." };
  if (!r.team_b.includes(userId)) return { ok: false, message: "Lo confirma alguien de la pareja contraria." };
  if (!ctx.windowOpen) return { ok: false, message: `Ya pasaron ${RESULT_WINDOW_DAYS} días: este resultado ya no cuenta.` };

  if (!accept) {
    await supabaseAdmin
      .from("match_results")
      .update({ status: "REJECTED", reviewed_by: userId, reviewed_at: new Date().toISOString() })
      .eq("id", r.id)
      .eq("status", "PENDING");
    return { ok: true };
  }

  const outcome = parseSets(r.sets);
  if ("error" in outcome) return { ok: false, message: outcome.error };
  const ids = [...r.team_a, ...r.team_b];
  const { data: profs } = await supabaseAdmin
    .from("profiles")
    .select("id, level, level_reliability, level_matches, division")
    .in("id", ids);
  const byId = new Map((profs ?? []).map((p) => [p.id, p]));
  // Quien aún no tiene nivel entra con el de su división, sin confiabilidad.
  const rated = (id: string) => {
    const p = byId.get(id);
    return {
      id,
      level: p?.level != null ? Number(p.level) : divisionToLevel(p?.division),
      reliability: p?.level != null ? (p?.level_reliability ?? 0) : 0,
    };
  };
  const changes = computeLevelChanges(r.team_a.map(rated), r.team_b.map(rated), outcome);

  // Primero se marca como confirmado (condicional): si dos personas
  // confirman a la vez, solo una aplica los cambios.
  const { data: claimed } = await supabaseAdmin
    .from("match_results")
    .update({ status: "CONFIRMED", reviewed_by: userId, reviewed_at: new Date().toISOString(), level_changes: changes })
    .eq("id", r.id)
    .eq("status", "PENDING")
    .select("id")
    .maybeSingle();
  if (!claimed) return { ok: false, message: "Este resultado ya se revisó." };

  const now = new Date().toISOString();
  for (const [id, c] of Object.entries(changes)) {
    await supabaseAdmin
      .from("profiles")
      .update({
        level: c.after,
        level_reliability: c.reliabilityAfter,
        level_matches: (byId.get(id)?.level_matches ?? 0) + 1,
        level_updated_at: now,
      })
      .eq("id", id);
  }
  return { ok: true };
}

/** Nivel inicial con el cuestionario: solo una vez. */
export async function setInitialLevel(userId: string, answers: number[]): Promise<ActionResult & { level?: number }> {
  const level = initialLevelFromAnswers(answers);
  if (level == null) return { ok: false, message: "Responde todas las preguntas." };
  const { data } = await supabaseAdmin
    .from("profiles")
    .update({ level, level_reliability: 0, level_updated_at: new Date().toISOString() })
    .eq("id", userId)
    .is("level", null)
    .select("id")
    .maybeSingle();
  if (!data) return { ok: false, message: "Ya tienes nivel." };
  return { ok: true, level };
}

/** Bajar el nivel a mano (como Playtomic: subirlo solo se gana jugando). */
export async function lowerLevel(userId: string, level: number): Promise<ActionResult> {
  const { data: p } = await supabaseAdmin.from("profiles").select("level").eq("id", userId).maybeSingle();
  if (p?.level == null) return { ok: false, message: "Primero calcula tu nivel." };
  const target = Math.round(level * 100) / 100;
  if (!(target >= 0 && target < Number(p.level))) return { ok: false, message: "Solo puedes bajar tu nivel." };
  await supabaseAdmin
    .from("profiles")
    .update({ level: target, level_updated_at: new Date().toISOString() })
    .eq("id", userId);
  return { ok: true };
}

/** Avisa a la pareja contraria que confirme el resultado (best-effort). */
async function notifyReviewers(bookingId: string, reviewers: string[], ctx: MatchContext) {
  const { data: b } = await supabaseAdmin
    .from("bookings")
    .select("user_id, contact_email, split_token")
    .eq("id", bookingId)
    .maybeSingle();
  const { data: shares } = await supabaseAdmin
    .from("booking_shares")
    .select("user_id, payer_email")
    .eq("booking_id", bookingId)
    .in("user_id", reviewers);
  const emails = new Set<string>();
  for (const s of shares ?? []) if (s.payer_email) emails.add(s.payer_email);
  if (b?.user_id && reviewers.includes(b.user_id) && b.contact_email) emails.add(b.contact_email);
  const url = `${SITE.url}/reserva/pagar?t=${b?.split_token ?? ""}`;
  const when = mxParts(ctx.startAt);
  for (const to of emails) {
    await sendEmail({
      to,
      subject: "Confirma el resultado de tu partido - Sacré Pádel",
      text: `Capturaron el resultado de tu partido del ${when.dateLocal} a las ${when.timeLocal} en ${ctx.courtName}. Confírmalo (o recházalo si no es correcto) para que cuente para tu nivel: ${url}`,
      html: `<div style="font-family:sans-serif;font-size:14px;line-height:1.6"><p>Capturaron el resultado de tu partido del ${when.dateLocal} a las ${when.timeLocal} en ${ctx.courtName}.</p><p><a href="${url}" style="color:#9A6A45;font-weight:700">Confirmar el resultado</a> (o recházalo si no es correcto) para que cuente para tu nivel.</p></div>`,
    });
  }
}

/** Mi nivel y mis últimos partidos que contaron. */
export async function myLevel(userId: string) {
  const { data: p } = await supabaseAdmin
    .from("profiles")
    .select("level, level_reliability, level_matches, division, ranking_visible")
    .eq("id", userId)
    .maybeSingle();
  const { data: results } = await supabaseAdmin
    .from("match_results")
    .select("booking_id, team_a, team_b, sets, reviewed_at, level_changes")
    .eq("status", "CONFIRMED")
    .order("reviewed_at", { ascending: false })
    .limit(200);
  const history = (results ?? [])
    .filter((r) => (r.team_a as string[]).includes(userId) || (r.team_b as string[]).includes(userId))
    .slice(0, 10)
    .map((r) => {
      const mineA = (r.team_a as string[]).includes(userId);
      const sets = (r.sets as number[][]).map(([a, b]) => (mineA ? [a, b] : [b, a]));
      const won = sets.filter(([m, t]) => m > t).length;
      const lost = sets.length - won;
      const change = (r.level_changes as Record<string, LevelChange> | null)?.[userId];
      return {
        at: r.reviewed_at,
        sets,
        outcome: won > lost ? "W" : lost > won ? "L" : "T",
        before: change?.before ?? null,
        after: change?.after ?? null,
      };
    });
  return {
    level: p?.level != null ? Number(p.level) : null,
    reliability: p?.level_reliability ?? 0,
    matches: p?.level_matches ?? 0,
    division: p?.division ?? null,
    rankingVisible: p?.ranking_visible !== false,
    history,
  };
}
