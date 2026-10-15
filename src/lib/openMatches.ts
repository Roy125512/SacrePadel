import { PaymentRefund } from "mercadopago";
import { mpConfig } from "@/lib/mercadopago";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { alertOwner } from "@/lib/bookingNotifications";
import { syncBookingFromShares } from "@/lib/splitPayments";
import { divisionNumber, withinCancelWindow, CANCEL_NOTICE_HOURS, type MatchGender } from "@/lib/config";
import { levelToDivision } from "@/lib/levels-shared";
import { DEMO } from "@/lib/demo/flag";

/**
 * Partidos abiertos (como Playtomic). Un partido abierto es una reserva con
 * pago dividido entre 4 (ver splitPayments) que se publica en /partidos.
 * Para unirse hay que tener cuenta y cumplir el nivel y el género del
 * partido; quien se une paga su parte. Se puede salir hasta
 * CANCEL_NOTICE_HOURS antes, con reembolso; su lugar vuelve a quedar libre.
 */

const refunds = new PaymentRefund(mpConfig);

export type MatchRules = {
  match_gender: string | null;
  match_level_min: number | null;
  match_level_max: number | null;
};

export type PlayerProfile = { sex: string | null; division: string | null; level?: number | null };

/** Por qué este jugador no puede unirse (o null si sí puede). */
export function joinBlock(rules: MatchRules, player: PlayerProfile): string | null {
  const g = (rules.match_gender ?? "ANY") as MatchGender;
  if (g === "MALE" && player.sex !== "M") return "Este partido es varonil.";
  if (g === "FEMALE" && player.sex !== "F") return "Este partido es femenil.";
  const min = rules.match_level_min ?? 1;
  const max = rules.match_level_max ?? 6;
  if (min > 1 || max < 6) {
    // Con nivel calculado, manda el nivel; si no, la división que eligió.
    const n = divisionNumber(player.level != null ? levelToDivision(Number(player.level)) : player.division);
    if (!n) return "Para unirte, primero calcula tu nivel en tu perfil.";
    if (n < min || n > max) return "Tu división no está en el rango de nivel de este partido.";
  }
  return null;
}

export type LeaveResult = { ok: true; refundedMXN: number } | { ok: false; message: string };

/** Quien se unió a un partido abierto se sale; se le reembolsa su parte. */
export async function leaveMatch(bookingId: string, userId: string): Promise<LeaveResult> {
  const { data: b } = await supabaseAdmin
    .from("bookings")
    .select("id, status, start_at, user_id, is_open_match")
    .eq("id", bookingId)
    .maybeSingle();
  if (!b || !b.is_open_match) return { ok: false, message: "No encontramos este partido." };
  if (b.status !== "CONFIRMED") return { ok: false, message: "Este partido ya no está activo." };
  if (b.user_id === userId) {
    return { ok: false, message: "Creaste este partido: para no jugarlo, cancela la reserva desde Mis reservas." };
  }
  if (!withinCancelWindow(b.start_at)) {
    return {
      ok: false,
      message: `Faltan menos de ${CANCEL_NOTICE_HOURS} horas: ya no puedes salirte en línea. Escríbenos por WhatsApp.`,
    };
  }

  const { data: mine } = await supabaseAdmin
    .from("booking_shares")
    .select("id, amount, mp_payment_id, payment_method")
    .eq("booking_id", bookingId)
    .eq("user_id", userId)
    .eq("status", "PAID");
  if (!mine || mine.length === 0) return { ok: false, message: "No estás en este partido." };

  let refundedMXN = 0;
  for (const s of mine) {
    if (s.payment_method === "MERCADOPAGO" && s.mp_payment_id && !DEMO) {
      try {
        // Cada lugar se paga con su propio pago, así que se devuelve completo.
        await refunds.create({
          payment_id: s.mp_payment_id,
          body: { amount: Number(s.amount) },
          requestOptions: { idempotencyKey: `leave-${s.id}-${s.mp_payment_id}` },
        });
      } catch (e) {
        console.error("leaveMatch refund", bookingId, s.mp_payment_id, e);
        await alertOwner("Reembolso de un jugador que se salió — hacerlo a mano", [
          `Un jugador se salió del partido ${bookingId}; devuélvele $${s.amount} MXN del pago ${s.mp_payment_id}.`,
        ]);
      }
    }
    refundedMXN += Number(s.amount);
    // El lugar vuelve a quedar libre.
    await supabaseAdmin
      .from("booking_shares")
      .update({
        status: "PENDING",
        user_id: null,
        payer_name: null,
        payer_email: null,
        payment_method: null,
        mp_payment_id: null,
        paid_at: null,
        checkout_until: null,
      })
      .eq("id", s.id)
      .eq("status", "PAID");
  }
  await syncBookingFromShares(bookingId);
  return { ok: true, refundedMXN: Math.round(refundedMXN * 100) / 100 };
}

export type OpenMatchCard = {
  token: string;
  start_at: string;
  end_at: string;
  court_name: string;
  match_type: string | null;
  match_gender: string | null;
  match_level_min: number | null;
  match_level_max: number | null;
  share_amount: number;
  players: { name: string; division: string | null; level: number | null }[];
  spots_left: number;
};

/** Partidos abiertos próximos, con sus jugadores (solo el primer nombre). */
export async function listOpenMatches(limit = 40): Promise<OpenMatchCard[]> {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("id, split_token, start_at, end_at, match_type, match_gender, match_level_min, match_level_max, courts ( name )")
    .eq("is_open_match", true)
    .eq("status", "CONFIRMED")
    .in("payment_status", ["PARTIAL", "PAID"])
    .gt("start_at", new Date().toISOString())
    .order("start_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const { data: shares } = await supabaseAdmin
    .from("booking_shares")
    .select("booking_id, seq, amount, status, payer_name, user_id")
    .in(
      "booking_id",
      rows.map((r) => r.id)
    );
  const userIds = [...new Set((shares ?? []).map((s) => s.user_id).filter((x): x is string => !!x))];
  const { data: profiles } = userIds.length
    ? await supabaseAdmin.from("profiles").select("id, full_name, division, level").in("id", userIds)
    : { data: [] as { id: string; full_name: string | null; division: string | null; level: number | null }[] };
  const prof = new Map((profiles ?? []).map((p) => [p.id, p]));

  return rows
    .filter((r) => r.split_token)
    .map((r) => {
      const mine = (shares ?? []).filter((s) => s.booking_id === r.id).sort((a, b) => a.seq - b.seq);
      const paid = mine.filter((s) => s.status === "PAID");
      return {
        token: r.split_token!,
        start_at: r.start_at,
        end_at: r.end_at,
        court_name: (r.courts as { name: string } | null)?.name ?? "Cancha",
        match_type: r.match_type,
        match_gender: r.match_gender,
        match_level_min: r.match_level_min,
        match_level_max: r.match_level_max,
        share_amount: Number(mine.find((s) => s.seq === 2)?.amount ?? mine[0]?.amount ?? 0),
        players: paid.map((s) => {
          const p = s.user_id ? prof.get(s.user_id) : undefined;
          return {
            name: firstName(p?.full_name ?? s.payer_name) ?? "Jugador",
            division: p?.division ?? null,
            level: p?.level != null ? Number(p.level) : null,
          };
        }),
        spots_left: mine.length - paid.length,
      };
    });
}

export function firstName(s: string | null | undefined) {
  return (s ?? "").trim().split(/\s+/)[0] || null;
}
