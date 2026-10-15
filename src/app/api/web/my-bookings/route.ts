import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@/lib/supabaseServer";
import { customerCancelBlock } from "@/lib/cancellation";
import { dbErrorResponse } from "@/lib/apiError";
import { computeExpectedAmountMXN } from "@/lib/pricing-shared";
import { SPLIT_DEBT_GRACE_HOURS } from "@/lib/config";
import { splitUrl } from "@/lib/splitPayments";

// "Mis reservas" del perfil: próximas y de los últimos 60 días, con si se
// pueden cancelar en línea y por qué no.
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

    const since = new Date(Date.now() - 60 * 86400_000).toISOString();
    const { data, error } = await supabaseAdmin
      .from("bookings")
      .select("id, start_at, end_at, status, payment_status, payment_method, paid_amount, refunded_amount, split_parts, split_token, is_open_match, courts ( name )")
      .eq("user_id", auth.user.id)
      .in("status", ["CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"])
      .gte("start_at", since)
      .order("start_at", { ascending: false })
      .limit(50);
    if (error) return dbErrorResponse("GET /api/web/my-bookings", error);

    const now = Date.now();
    const bookings = (data ?? []).map((b) => {
      const block = customerCancelBlock(b, now);
      return {
        id: b.id,
        start_at: b.start_at,
        end_at: b.end_at,
        status: b.status,
        payment_status: b.payment_status,
        payment_method: b.payment_method,
        paid_amount: b.paid_amount,
        refunded_amount: b.refunded_amount,
        court_name: (b.courts as { name: string } | null)?.name ?? "Cancha",
        upcoming: new Date(b.end_at).getTime() > now,
        // Pago dividido: liga para compartir y cuánto falta.
        split:
          b.split_parts && b.split_token
            ? {
                open_match: !!b.is_open_match,
                parts: b.split_parts,
                url: splitUrl(b.split_token),
                remaining:
                  b.payment_status === "PARTIAL"
                    ? Math.round((computeExpectedAmountMXN(b.start_at, b.end_at) - Number(b.paid_amount ?? 0)) * 100) / 100
                    : 0,
                // Partes (lugares) que faltan.
                missing:
                  b.payment_status === "PARTIAL"
                    ? Math.round(
                        ((computeExpectedAmountMXN(b.start_at, b.end_at) - Number(b.paid_amount ?? 0)) * b.split_parts) /
                          Math.max(1, computeExpectedAmountMXN(b.start_at, b.end_at))
                      )
                    : 0,
                // Ya pasó el plazo: lo que falta es deuda de quien reservó.
                overdue:
                  b.payment_status === "PARTIAL" &&
                  b.status !== "CANCELLED" &&
                  new Date(b.end_at).getTime() + SPLIT_DEBT_GRACE_HOURS * 3600_000 < now,
              }
            : null,
        can_cancel: block === null,
        cancel_block: block,
      };
    });
    // Partidos abiertos a los que se unió (de otra persona).
    const { data: myShares } = await supabaseAdmin
      .from("booking_shares")
      .select("booking_id")
      .eq("user_id", auth.user.id)
      .eq("status", "PAID");
    const joinedIds = [...new Set((myShares ?? []).map((s) => s.booking_id))];
    const { data: joinedRows } = joinedIds.length
      ? await supabaseAdmin
          .from("bookings")
          .select("id, start_at, end_at, status, split_token, user_id, courts ( name )")
          .in("id", joinedIds)
          .neq("user_id", auth.user.id)
          .eq("is_open_match", true)
          .gte("start_at", since)
          .order("start_at", { ascending: true })
      : { data: [] };
    const joined = (joinedRows ?? []).map((b) => ({
      id: b.id,
      start_at: b.start_at,
      end_at: b.end_at,
      status: b.status,
      token: b.split_token,
      court_name: (b.courts as { name: string } | null)?.name ?? "Cancha",
      upcoming: new Date(b.end_at).getTime() > now,
    }));

    return NextResponse.json({ bookings, joined });
  } catch (e) {
    return dbErrorResponse("GET /api/web/my-bookings", e);
  }
}
