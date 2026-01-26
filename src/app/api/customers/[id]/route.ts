import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const TARIFF_PER_HOUR = 350;

function clampInt(v: any, def: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: paramId } = await params;

  // 1) id por params
  let id = (paramId ?? "").trim();

  // 2) fallback por pathname (por si algo llega raro)
  if (!id) {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    id = (parts[parts.length - 1] ?? "").trim();
  }


  const url = new URL(req.url);
  const limit = clampInt(url.searchParams.get("limit"), 200, 1, 200);
  const offset = clampInt(url.searchParams.get("offset"), 0, 0, 5000);

  const { data: customer, error: cErr } = await supabaseAdmin
    .from("customers")
    .select("id, full_name, phone_e164, email, notes, birthday, player_notes, sex, division, is_active, created_at")
    .eq("id", id)
    .maybeSingle();

  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const { count: totalCount, error: countErr } = await supabaseAdmin
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", id);

  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });

  const { data: bookings, error: bErr } = await supabaseAdmin
    .from("bookings")
    .select(
      `
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
    `
    )
    .eq("customer_id", id)
    .order("start_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });

  const rows = (bookings ?? []).map((b: any) => {
    const startMs = new Date(b.start_at).getTime();
    const endMs = new Date(b.end_at).getTime();
    const hours = Math.max(0, (endMs - startMs) / (1000 * 60 * 60));
    const expected_amount = Math.round(hours * TARIFF_PER_HOUR * 100) / 100;

    return {
      id: b.id,
      start_at: b.start_at,
      end_at: b.end_at,
      status: b.status,
      source: b.source ?? null,
      kind: b.kind ?? null,
      payment_status: b.payment_status ?? "UNPAID",
      paid_amount: Number(b.paid_amount ?? 0),
      expected_amount,
      payment_method: b.payment_method ?? null,
      paid_at: b.paid_at ?? null,
      court_name: b.courts?.name ?? "N/A",
    };
  });

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
        birthday: customer.birthday,
        player_notes: customer.player_notes,

        sex: customer.sex ?? null,
        division: customer.division ?? null,

        is_active: customer.is_active,
        created_at: customer.created_at,
      },
      stats: {
        total_visits: totalCount ?? 0,
        total_paid: totalPaid,
        last_visit_at: lastVisit,
      },
      recent_bookings: rows,
      pagination: {
        limit,
        offset,
        total: totalCount ?? 0,
        has_more: offset + rows.length < (totalCount ?? 0),
      },
    },
    { status: 200 }
  );
}

export async function PATCH(req: Request, ctx: { params?: { id?: string } }) {
  let id = (ctx?.params?.id ?? "").trim();

  if (!id) {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    id = (parts[parts.length - 1] ?? "").trim();
  }

  if (!id || id === "customers") {
    return NextResponse.json({ error: "Missing customer id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));

  const notes = typeof body.notes === "string" ? body.notes.trim() : undefined;

  const birthday =
    body.birthday === null ? null : typeof body.birthday === "string" ? body.birthday : undefined;

  const player_notes =
    body.player_notes === null
      ? null
      : typeof body.player_notes === "string"
      ? body.player_notes.trim()
      : undefined;

  const patch: any = {};
  if (notes !== undefined) patch.notes = notes || null;
  if (birthday !== undefined) patch.birthday = birthday;
  if (player_notes !== undefined) patch.player_notes = player_notes || null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("customers")
    .update(patch)
    .eq("id", id)
    .select("id, full_name, phone_e164, email, notes, birthday, player_notes, sex, division, is_active, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ customer: data }, { status: 200 });
}
