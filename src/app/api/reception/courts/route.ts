import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireReceptionAccess } from "@/lib/guards/reception";
import { fetchActiveCourts } from "@/lib/availability";
import { dbErrorResponse } from "@/lib/apiError";

export async function GET() {
  const gate = await requireReceptionAccess({ asJson: true });
  if (!gate.ok) return gate.res;

  try {
    const courts = await fetchActiveCourts(supabaseAdmin);
    return NextResponse.json({ courts }, { status: 200 });
  } catch (e: any) {
    return dbErrorResponse("GET /api/reception/courts", e);
  }
}
