import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/mailer";
import { mxParts } from "@/lib/bookingNotifications";
import { ymdInBusinessTZ } from "@/lib/businessTime";
import { SITE } from "@/lib/site";

/**
 * "Avísame si se libera" (como Playtomic). Un jugador se anota para un
 * horario (cualquier cancha a esa hora), un partido abierto lleno o un torneo
 * lleno; cuando alguien cancela, le llega un correo. Se avisa una sola vez y
 * gana quien reserve primero.
 */

export type AlertKind = "SLOT" | "MATCH" | "EVENT";
const MAX_PENDING_PER_EMAIL = 10;

export async function createAlert(a: {
  kind: AlertKind;
  email: string;
  userId: string | null;
  startAt?: string | null;
  refId?: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const email = a.email.trim().toLowerCase();
  if (a.kind === "SLOT") {
    if (!a.startAt || new Date(a.startAt).getTime() <= Date.now()) return { ok: false, message: "Ese horario ya pasó." };
  } else if (!a.refId) return { ok: false, message: "Solicitud inválida." };

  const { data: pending } = await supabaseAdmin
    .from("slot_alerts")
    .select("id, kind, start_at, ref_id")
    .eq("email", email)
    .is("notified_at", null);
  const same = (pending ?? []).find(
    (p) =>
      p.kind === a.kind &&
      (a.kind === "SLOT" ? new Date(p.start_at ?? 0).getTime() === new Date(a.startAt!).getTime() : p.ref_id === a.refId)
  );
  if (same) return { ok: true }; // ya estaba anotado
  if ((pending ?? []).length >= MAX_PENDING_PER_EMAIL) {
    return { ok: false, message: "Ya tienes muchos avisos pendientes." };
  }
  const { error } = await supabaseAdmin.from("slot_alerts").insert({
    kind: a.kind,
    email,
    user_id: a.userId,
    start_at: a.kind === "SLOT" ? new Date(a.startAt!).toISOString() : null,
    ref_id: a.kind === "SLOT" ? null : a.refId,
  });
  if (error) {
    console.error("createAlert", error);
    return { ok: false, message: "No se pudo guardar el aviso." };
  }
  return { ok: true };
}

/** Marca como avisadas (condicional: si dos procesos avisan a la vez, solo uno manda). */
async function claim(ids: string[]) {
  if (ids.length === 0) return [];
  const { data } = await supabaseAdmin
    .from("slot_alerts")
    .update({ notified_at: new Date().toISOString() })
    .in("id", ids)
    .is("notified_at", null)
    .select("id, email");
  return data ?? [];
}

const font = "font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;";
function html(lines: string[], cta: { href: string; label: string }) {
  return `<div style="${font}font-size:14px;line-height:1.6;color:#13110E">${lines
    .map((l) => `<p>${l}</p>`)
    .join("")}<p><a href="${cta.href}" style="color:#9A6A45;font-weight:700">${cta.label}</a></p><p style="color:#9ca3af;font-size:12px">Te avisamos una sola vez. Si ya no te interesa, ignora este correo.</p></div>`;
}

/** Se liberó una cancha de `startAt` a `endAt`: avisa a quien esperaba esa hora. */
export async function notifySlotFreed(startAt: string, endAt: string) {
  try {
    if (new Date(endAt).getTime() <= Date.now()) return;
    const { data } = await supabaseAdmin
      .from("slot_alerts")
      .select("id, start_at")
      .eq("kind", "SLOT")
      .is("notified_at", null)
      .gte("start_at", new Date(startAt).toISOString())
      .lt("start_at", new Date(endAt).toISOString());
    const rows = (data ?? []).filter((r) => r.start_at && new Date(r.start_at).getTime() > Date.now());
    const sent = await claim(rows.map((r) => r.id));
    for (const r of sent) {
      const row = rows.find((x) => x.id === r.id)!;
      const when = mxParts(row.start_at!);
      const url = `${SITE.url}/reservar?date=${ymdInBusinessTZ(row.start_at!)}`;
      await sendEmail({
        to: r.email,
        subject: `Se liberó una cancha el ${when.dateLocal} a las ${when.timeLocal} - Sacré Pádel`,
        text: `¡Buenas noticias! Se liberó una cancha el ${when.dateLocal} a las ${when.timeLocal}. Gana quien reserve primero: ${url}`,
        html: html(
          [`¡Buenas noticias! Se liberó una cancha el <b>${when.dateLocal}</b> a las <b>${when.timeLocal}</b>.`, "Gana quien reserve primero."],
          { href: url, label: "Reservar ahora" }
        ),
      }).catch(() => null);
    }
  } catch (e) {
    console.error("notifySlotFreed", e);
  }
}

/** Se abrió un lugar en un partido abierto o en un torneo. */
export async function notifySpotOpened(kind: "MATCH" | "EVENT", refId: string, title: string, url: string) {
  try {
    const { data } = await supabaseAdmin
      .from("slot_alerts")
      .select("id")
      .eq("kind", kind)
      .eq("ref_id", refId)
      .is("notified_at", null);
    const sent = await claim((data ?? []).map((r) => r.id));
    for (const r of sent) {
      await sendEmail({
        to: r.email,
        subject: `Se abrió un lugar: ${title} - Sacré Pádel`,
        text: `Se abrió un lugar en ${title}. Gana quien se inscriba primero: ${url}`,
        html: html([`Se abrió un lugar en <b>${title}</b>.`, "Gana quien entre primero."], { href: url, label: "Ver y apartar mi lugar" }),
      }).catch(() => null);
    }
  } catch (e) {
    console.error("notifySpotOpened", e);
  }
}
