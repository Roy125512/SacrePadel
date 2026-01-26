import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireReceptionAccess } from "@/lib/guards/reception";

export async function GET(req: Request) {
  const gate = await requireReceptionAccess();
  if (!gate.ok) return gate.res;

  const { searchParams } = new URL(req.url);

  const date = searchParams.get("date"); // YYYY-MM-DD
  const start = searchParams.get("start"); // YYYY-MM-DD
  const end = searchParams.get("end"); // YYYY-MM-DD
  const isRange = Boolean(start || end);

  if (!date && !isRange) {
    return NextResponse.json(
      {
        error:
          "Missing required query param: either date=YYYY-MM-DD OR start=YYYY-MM-DD&end=YYYY-MM-DD",
      },
      { status: 400 }
    );
  }
  if (isRange && (!start || !end)) {
    return NextResponse.json(
      { error: "For range mode, both start and end are required (YYYY-MM-DD)." },
      { status: 400 }
    );
  }

  const windowStart = isRange ? start! : date!;
  const windowEnd = isRange ? end! : date!;

  const dayStartIso = `${windowStart}T00:00:00-06:00`;
  const dayEndIso = `${windowEnd}T23:59:59-06:00`;

  const selectWithCancelledBy = `
    id,
    court_id,
    start_at,
    end_at,
    status,
    source,
    kind,
    payment_status,
    paid_amount,
    payment_method,
    paid_at,
    customer_id,
    cancelled_by,
    courts ( name ),
    customers:customer_id ( id, full_name, phone_e164 )
  `;

  let res = await supabaseAdmin
    .from("bookings")
    .select(selectWithCancelledBy)
    .lt("start_at", dayEndIso)
    .gt("end_at", dayStartIso)
    .or("status.neq.CANCELLED,and(status.eq.CANCELLED,cancelled_by.eq.RECEPTION)")
    .order("start_at", { ascending: true });

  if (res.error && String(res.error.message).toLowerCase().includes("cancelled_by")) {
    const selectNoCancelledBy = `
      id,
      court_id,
      start_at,
      end_at,
      status,
      source,
      kind,
      payment_status,
      paid_amount,
      payment_method,
      paid_at,
      customer_id,
      courts ( name ),
      customers:customer_id ( id, full_name, phone_e164 )
    `;

    res = await supabaseAdmin
      .from("bookings")
      .select(selectNoCancelledBy)
      .lt("start_at", dayEndIso)
      .gt("end_at", dayStartIso)
      .neq("status", "CANCELLED")
      .order("start_at", { ascending: true });
  }

  if (res.error) {
    return NextResponse.json({ error: res.error.message }, { status: 500 });
  }

  const bookings = (res.data ?? []).map((b: any) => {
    const customerId = b.customers?.id ?? b.customer_id ?? null;
    return {
      id: b.id,
      court_id: b.court_id,
      court_name: b.courts?.name ?? "N/A",
      start_at: b.start_at,
      end_at: b.end_at,
      status: b.status,
      source: b.source,
      kind: b.kind,
      payment_status: b.payment_status ?? "UNPAID",
      paid_amount: Number(b.paid_amount ?? 0),
      payment_method: b.payment_method ?? null,
      paid_at: b.paid_at ?? null,
      customer_id: customerId,
      customer_name: b.customers?.full_name ?? null,
      customer_phone: b.customers?.phone_e164 ?? null,
      cancelled_by: b.cancelled_by ?? null,
    };
  });

  return NextResponse.json(
    {
      date: isRange ? null : date,
      start: isRange ? windowStart : null,
      end: isRange ? windowEnd : null,
      timezone_offset: "-06:00",
      count: bookings.length,
      bookings,
    },
    { status: 200 }
  );
}
