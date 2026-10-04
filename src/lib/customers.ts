import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Datos de cliente que llegan desde el sitio público (reserva web o perfil).
// Ningún campo es confiable para identificar a la persona: el teléfono no se
// verifica, así que cualquiera puede escribir el de otro cliente.
export type WebCustomerInput = {
  full_name: string;
  phone_e164: string | null;
  email?: string | null;
  birthday?: string | null;
  player_notes?: string | null;
  sex?: string | null;
  division?: string | null;
};

type CustomerRow = {
  id: string;
  user_id: string | null;
  full_name: string | null;
  phone_e164: string | null;
  email: string | null;
  birthday: string | null;
  player_notes: string | null;
  sex: string | null;
  division: string | null;
};

const CUSTOMER_COLS = "id, user_id, full_name, phone_e164, email, birthday, player_notes, sex, division";

const FIELDS = ["full_name", "email", "birthday", "player_notes", "sex", "division"] as const;

function clean(v: string | null | undefined) {
  const s = (v ?? "").trim();
  return s ? s : null;
}

/**
 * Busca o crea el registro de cliente para una reserva/perfil del sitio web.
 *
 * Reglas (ver migrations/008_customer_ownership_and_booking_contact.sql):
 * - Si la cuenta logueada ya es dueña de un cliente (customers.user_id), se
 *   usa ese y se actualizan sus datos con lo nuevo (sin borrar con vacíos).
 * - Si no, se busca por teléfono. Un cliente encontrado SOLO por teléfono
 *   nunca se sobrescribe: únicamente se llenan sus campos vacíos. Así nadie
 *   puede cambiar el nombre/correo de otra persona escribiendo su número.
 * - Si no existe, se crea (con dueño si hay cuenta logueada).
 */
export async function resolveWebCustomer(
  input: WebCustomerInput,
  userId: string | null
): Promise<{ id: string } | { error: { message: string } }> {
  const incoming: Record<(typeof FIELDS)[number], string | null> = {
    full_name: clean(input.full_name),
    email: clean(input.email),
    birthday: clean(input.birthday),
    player_notes: clean(input.player_notes),
    sex: clean(input.sex),
    division: clean(input.division),
  };

  if (userId) {
    const { data: owned, error } = await supabaseAdmin
      .from("customers")
      .select(CUSTOMER_COLS)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return { error };

    if (owned) {
      const patch: Record<string, string> = {};
      for (const f of FIELDS) {
        const v = incoming[f];
        if (v !== null && v !== owned[f]) patch[f] = v;
      }
      if (Object.keys(patch).length > 0) {
        const { error: upErr } = await supabaseAdmin.from("customers").update(patch).eq("id", owned.id);
        if (upErr) return { error: upErr };
      }
      return { id: owned.id };
    }
  }

  if (input.phone_e164) {
    const { data: byPhone, error } = await supabaseAdmin
      .from("customers")
      .select(CUSTOMER_COLS)
      .eq("phone_e164", input.phone_e164)
      .maybeSingle();
    if (error) return { error };

    if (byPhone) {
      const row = byPhone as CustomerRow;
      const patch: Record<string, string> = {};
      for (const f of FIELDS) {
        const v = incoming[f];
        if (v !== null && !clean(row[f])) patch[f] = v;
      }
      if (Object.keys(patch).length > 0) {
        const { error: upErr } = await supabaseAdmin.from("customers").update(patch).eq("id", row.id);
        if (upErr) return { error: upErr };
      }
      return { id: row.id };
    }
  }

  const { data: created, error: insErr } = await supabaseAdmin
    .from("customers")
    .insert({
      ...incoming,
      phone_e164: input.phone_e164,
      user_id: userId,
      is_active: true,
    })
    .select("id")
    .single();
  if (insErr) return { error: insErr };

  return { id: created.id };
}

/** Datos del perfil de la cuenta, en el formato de customers. */
export async function profileCustomerFields(userId: string) {
  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("full_name, phone_e164, birth_date, notes, sex, division")
    .eq("id", userId)
    .maybeSingle();

  return {
    full_name: (prof?.full_name as string | null) ?? null,
    phone_e164: (prof?.phone_e164 as string | null) ?? null,
    birthday: (prof?.birth_date as string | null) ?? null,
    player_notes: (prof?.notes as string | null) ?? null,
    sex: (prof?.sex as string | null) ?? null,
    division: (prof?.division as string | null) ?? null,
  };
}
