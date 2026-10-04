import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireReceptionAccess } from "@/lib/guards/reception";
import { dbErrorResponse } from "@/lib/apiError";
import { normalizePhoneToE164 } from "@/lib/phone";

export async function POST(req: Request) {
  const gate = await requireReceptionAccess({ asJson: true, nextPath: "/reception" });
  if (!gate.ok) return gate.res;

  const body = await req.json().catch(() => ({}));

  const full_name = String(body.full_name ?? "").trim();
  const phoneRaw = String(body.phone_e164 ?? "").trim();
  const phone_e164 = phoneRaw ? normalizePhoneToE164(phoneRaw) : null;
  if (phoneRaw && !phone_e164) {
    return NextResponse.json({ error: "Teléfono inválido. Usa 10 dígitos, p. ej. 443 123 4567." }, { status: 400 });
  }
  const email = String(body.email ?? "").trim();

  // notas recepción (si llega)
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";

  // nuevos (si llegan desde perfil o UI)
  const birthday = typeof body.birthday === "string" ? body.birthday : null;
  const player_notes = typeof body.player_notes === "string" ? body.player_notes.trim() : null;

  if (!full_name) {
    return NextResponse.json({ error: "El nombre completo es requerido" }, { status: 400 });
  }

  // ✅ Si viene teléfono, buscamos si ya existe por phone_e164
  if (phone_e164) {
    const { data: existing, error: exErr } = await supabaseAdmin
      .from("customers")
      .select("id, full_name, phone_e164, email, notes, birthday, player_notes")
      .eq("phone_e164", phone_e164)
      .maybeSingle();

    if (exErr) return dbErrorResponse("POST /api/customers find existing", exErr);

    // ✅ Si existe, actualizamos nombre SOLO si cambió (y viene un nombre válido)
    if (existing) {
      const incomingName = full_name.trim();
      const currentName = String(existing.full_name ?? "").trim();

      if (incomingName && incomingName !== currentName) {
        const { data: updated, error: updErr } = await supabaseAdmin
          .from("customers")
          .update({ full_name: incomingName })
          .eq("id", existing.id)
          .select("id, full_name, phone_e164, email, notes, birthday, player_notes")
          .single();

        if (updErr) return dbErrorResponse("POST /api/customers update name", updErr);

        return NextResponse.json({ customer: updated }, { status: 200 });
      }

      // Si no cambió el nombre, regresamos el existente tal cual
      return NextResponse.json({ customer: existing }, { status: 200 });
    }
  }

  // Si no existe, insertamos
  const { data, error } = await supabaseAdmin
    .from("customers")
    .insert({
      full_name,
      phone_e164: phone_e164 || null,
      email: email || null,
      notes: notes || null,
      birthday,
      player_notes,
      is_active: true,
    })
    .select("id, full_name, phone_e164, email, notes, birthday, player_notes")
    .single();

  if (error) return dbErrorResponse("POST /api/customers insert", error);

  return NextResponse.json({ customer: data }, { status: 201 });
}
