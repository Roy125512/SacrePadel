import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizePhoneToE164 } from "@/lib/phone";

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
      return NextResponse.json({ error: userErr?.message ?? "Invalid token" }, { status: 401 });
    }

    const user = userData.user;

    const { data: prof, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("full_name, phone_e164, birth_date, notes, sex, division")
      .eq("id", user.id)
      .maybeSingle();

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
    if (!prof) return NextResponse.json({ error: "Profile no encontrado" }, { status: 404 });

    const full_name = String(prof.full_name ?? "").trim();

    // ✅ Normaliza teléfono para que acepte "+52 434..." o "434..."
    const phone_raw = String(prof.phone_e164 ?? "").trim();
    const n = normalizePhoneToE164(phone_raw, "MX");
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

    const { data: lastBooking, error: bErr } = await supabaseAdmin
      .from("bookings")
      .select("customer_id")
      .eq("user_id", user.id)
      .not("customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });

    if (lastBooking?.customer_id) {
      const customer_id = lastBooking.customer_id as string;

      const { data: updated, error: upErr } = await supabaseAdmin
        .from("customers")
        .update({ full_name, birthday, player_notes, sex, division })
        .eq("id", customer_id)
        .select("id, full_name, phone_e164, birthday, player_notes, sex, division")
        .single();

      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

      return NextResponse.json({ ok: true, action: "updated_by_booking", customer: updated });
    }

    if (!phone_e164) {
      return NextResponse.json(
        { error: "No hay reserva ligada al usuario y el perfil no tiene teléfono." },
        { status: 400 }
      );
    }

    const { data: existing, error: cErr } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("phone_e164", phone_e164)
      .maybeSingle();

    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

    if (existing?.id) {
      const { data: updated, error: upErr } = await supabaseAdmin
        .from("customers")
        .update({ full_name, birthday, player_notes, sex, division })
        .eq("id", existing.id)
        .select("id, full_name, phone_e164, birthday, player_notes, sex, division")
        .single();

      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

      return NextResponse.json({ ok: true, action: "updated_by_phone", customer: updated });
    }

    const { data: created, error: insErr } = await supabaseAdmin
      .from("customers")
      .insert({
        full_name,
        phone_e164, // ✅ ya normalizado a E.164
        birthday,
        player_notes,
        sex,
        division,
        is_active: true,
      })
      .select("id, full_name, phone_e164, birthday, player_notes, sex, division")
      .single();

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, action: "inserted", customer: created }, { status: 201 });
  } catch (e: any) {
    console.error("sync-profile crash:", e);
    return NextResponse.json(
      { error: e?.message ?? "Error desconocido en sync-profile" },
      { status: 500 }
    );
  }
}
