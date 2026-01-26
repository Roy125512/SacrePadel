import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireReceptionAccess } from "@/lib/guards/reception";


export async function POST(req: Request) {
  const gate = await requireReceptionAccess();
  if (!gate.ok) return gate.res;

  const body = await req.json().catch(() => ({}));
  const booking_id = (body.booking_id || "").trim();
  const customer_id = (body.customer_id || "").trim();

  if (!booking_id || !customer_id) {
    return NextResponse.json(
      { error: "booking_id and customer_id are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .update({ customer_id })
    .eq("id", booking_id)
    .select(`
      id,
      customer_id,
      customers ( id, full_name, phone_e164 )
    `)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    {
      booking: {
        id: data.id,
        customer_id: data.customer_id,
        customer_name: (data as any).customers?.full_name ?? null,
        customer_phone: (data as any).customers?.phone_e164 ?? null,
      },
    },
    { status: 200 }
  );
}
