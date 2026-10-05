import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizePhone } from "@/lib/phone";
import { dbErrorResponse } from "@/lib/apiError";
import { resolveWebCustomer } from "@/lib/customers";


function getBearerToken(req: NextRequest) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: "Missing Authorization Bearer token" }, { status: 401 });
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return dbErrorResponse("POST /api/customers/sync-profile getUser", userErr, 401);
    }

    const user = userData.user;

    const { data: prof, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("full_name, phone_e164, birth_date, notes, sex, division")
      .eq("id", user.id)
      .maybeSingle();

    if (pErr) return dbErrorResponse("POST /api/customers/sync-profile fetch profile", pErr);
    if (!prof) return NextResponse.json({ error: "Profile no encontrado" }, { status: 404 });

    const full_name = String(prof.full_name ?? "").trim();

    // ✅ Normaliza teléfono para que acepte "+52 434..." o "434..."
    const phone_raw = String(prof.phone_e164 ?? "").trim();
    const n = normalizePhone(phone_raw, "MX");
    const phone_e164 = phone_raw ? (n.isValid ? (n.e164 ?? "") : "") : "";


    const birthday = prof.birth_date ?? null;
    const player_notes = (prof.notes ?? null) as string | null;
    const sex = (prof.sex ?? null) as string | null;
    const division = (prof.division ?? null) as string | null;

    if (!full_name) {
      return NextResponse.json({ error: "Tu perfil necesita nombre." }, { status: 400 });
    }

    // ✅ Si el usuario escribió algo en teléfono pero no es válido, falla con mensaje claro
    if (phone_raw && !phone_e164) {
      return NextResponse.json(
        { error: "Teléfono inválido en el perfil. Usa 434 123 4567 o +52 434 123 4567." },
        { status: 400 }
      );
    }

    // Antes se tomaba el cliente de la última reserva del usuario o el que
    // tuviera ese teléfono y se le sobrescribían los datos — como el
    // teléfono del perfil no se verifica, eso permitía cambiar el nombre y
    // datos de otra persona. resolveWebCustomer solo sobrescribe el
    // registro propio de la cuenta; uno encontrado por teléfono solo se
    // completa en campos vacíos.
    const { data: owned } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!owned && !phone_e164) {
      return NextResponse.json({ ok: true, action: "skipped_no_phone" }, { status: 200 });
    }

    const resolved = await resolveWebCustomer(
      { full_name, phone_e164: phone_e164 || null, email: user.email ?? null, birthday, player_notes, sex, division },
      user.id
    );
    if ("error" in resolved) return dbErrorResponse("POST /api/customers/sync-profile resolve", resolved.error);

    return NextResponse.json({ ok: true, action: owned ? "updated" : "linked_or_created", customer: { id: resolved.id } });
  } catch (e) {
    return dbErrorResponse("POST /api/customers/sync-profile", e);
  }
}
