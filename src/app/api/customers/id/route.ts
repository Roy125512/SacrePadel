import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request, ctx: { params?: { id?: string } }) {
  // 1) intenta params.id (lo normal)
  let id = (ctx?.params?.id ?? "").trim();

  // 2) fallback: saca el id del pathname /api/customers/<id>
  if (!id) {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    id = (parts[parts.length - 1] ?? "").trim();
  }

  // 3) valida
  if (!id || id === "customers") {
    return NextResponse.json({ error: "Missing customer id" }, { status: 400 });
  }

  const { data: customer, error: cErr } = await supabaseAdmin
    .from("customers")
    .select("id, full_name, phone_e164, email, notes, is_active, created_at")
    .eq("id", id)
    .maybeSingle();

  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const { data: bookings, error: bErr } = await supabaseAdmin
    .from("bookings")
    .select(`
      id,
      start_at,
      end_at,
      status,
      source,
      kind,
      payment_status,
      paid_amount,
      payment_method,
      paid_at,
      courts ( name )
    `)
    .eq("customer_id", id)
    .order("start_at", { ascending: false })
    .limit(30);

  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });

  const rows = (bookings ?? []).map((b: any) => ({
    id: b.id,
    start_at: b.start_at,
    end_at: b.end_at,
    status: b.status,
    source: b.source ?? null,
    kind: b.kind ?? null,
    payment_status: b.payment_status ?? "UNPAID",
    paid_amount: Number(b.paid_amount ?? 0),
    payment_method: b.payment_method ?? null,
    paid_at: b.paid_at ?? null,
    court_name: b.courts?.name ?? "N/A",
  }));

  const totalVisits = rows.length;
  const totalPaid = rows
    .filter((r) => r.payment_status === "PAID")
    .reduce((acc, r) => acc + (r.paid_amount ?? 0), 0);
  const lastVisit = rows.length > 0 ? rows[0].start_at : null;

  return NextResponse.json(
    {
      customer: {
        id: customer.id,
        full_name: customer.full_name,
        phone_e164: customer.phone_e164,
        email: customer.email,
        notes: customer.notes,
        is_active: customer.is_active,
        created_at: customer.created_at,
      },
      stats: {
        total_visits: totalVisits,
        total_paid: totalPaid,
        last_visit_at: lastVisit,
      },
      recent_bookings: rows,
    },
    { status: 200 }
  );
}
