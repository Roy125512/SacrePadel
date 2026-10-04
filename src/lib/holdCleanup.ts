import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { settleMpHold } from "@/lib/mpBookings";
import { DEMO } from "@/lib/demo/flag";

/**
 * Borra HOLDs web vencidos. Los que ya habían abierto el pago de Mercado
 * Pago no se borran a ciegas: settleMpHold primero revisa si se pagaron (y
 * en ese caso los confirma, con correos); si no pudo consultar a Mercado
 * Pago, no borra nada.
 *
 * Por qué importa: la regla de "no encimar reservas" de la base de datos
 * (bookings_no_overlap) también cuenta los HOLDs vencidos, porque no puede
 * comparar contra la hora actual. Un HOLD vencido que nadie borra bloquea
 * ese horario aunque la cuadrícula lo muestre libre.
 *
 * `scope` limita la limpieza a una cancha y un rango (lo que necesita
 * /api/web/hold antes de apartar); sin `scope` limpia todo.
 */
export async function cleanupExpiredWebHolds(scope?: { courtId: string; startIso: string; endIso: string }) {
  let query = supabaseAdmin
    .from("bookings")
    .select("id, mp_preference_id")
    .eq("status", "HOLD")
    .eq("source", "WEB")
    .lt("hold_expires_at", new Date().toISOString());

  if (scope) {
    query = query.eq("court_id", scope.courtId).lt("start_at", scope.endIso).gt("end_at", scope.startIso);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const expired = (data ?? []) as { id: string; mp_preference_id: string | null }[];
  if (expired.length === 0) return;

  const plainIds = expired.filter((h) => !h.mp_preference_id).map((h) => h.id);
  const withPayment = expired.filter((h) => h.mp_preference_id).map((h) => h.id);

  if (plainIds.length > 0) {
    await supabaseAdmin.from("bookings").delete().in("id", plainIds).eq("status", "HOLD");
  }

  if (withPayment.length > 0 && !DEMO) {
    const results = await Promise.allSettled(withPayment.map((id) => settleMpHold(id)));
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error("hold cleanup: failed to settle Mercado Pago HOLD", withPayment[i], r.reason);
      } else if (r.value === "confirmed") {
        console.warn("Expired HOLD had an approved Mercado Pago payment — confirmed:", withPayment[i]);
      }
    });
  }
}
