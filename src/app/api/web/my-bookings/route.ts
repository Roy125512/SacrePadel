import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@/lib/supabaseServer";
import { customerCancelBlock } from "@/lib/cancellation";
import { dbErrorResponse } from "@/lib/apiError";

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
      .select("id, start_at, end_at, status, payment_status, payment_method, paid_amount, refunded_amount, courts ( name )")
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
        can_cancel: block === null,
        cancel_block: block,
      };
    });
    return NextResponse.json({ bookings });
  } catch (e) {
    return dbErrorResponse("GET /api/web/my-bookings", e);
  }
}
