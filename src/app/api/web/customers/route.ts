import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizePhone } from "@/lib/phone";
import { createClient } from "@/lib/supabaseServer";

export async function GET(req: Request) {
  // ✅ 1) Requiere sesión
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // ✅ 2) Requiere rol (owner o reception)
  const { data: prof, error: profErr } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profErr) {
    return NextResponse.json({ error: profErr.message }, { status: 500 });
  }

  const role = String(prof?.role ?? "").toLowerCase().trim();
  if (role !== "owner" && role !== "reception") {
    return NextResponse.json({ error: "Prohibido" }, { status: 403 });
  }

  // ✅ 3) Búsqueda normal
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ customers: [] }, { status: 200 });
  }

  const looksPhone = /[0-9+()\-.\s]/.test(q) && q.replace(/\D/g, "").length >= 6;
  let phoneE164: string | null = null;

  if (looksPhone) {
    const n = normalizePhone(q, "MX");
    phoneE164 = n.e164;
  }


  let query = supabaseAdmin
    .from("customers")
    .select("id, full_name, phone_e164, created_at")
    .limit(8)
    .order("created_at", { ascending: false });

  if (phoneE164) {
    query = query.eq("phone_e164", phoneE164);
  } else {
    query = query.ilike("full_name", `%${q}%`);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ customers: data ?? [] }, { status: 200 });
}
