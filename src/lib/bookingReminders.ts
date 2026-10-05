import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/mailer";
import { buildBookingReminderEmail } from "@/lib/bookingEmail";
import { mxParts } from "@/lib/bookingNotifications";
import { addDaysToYMD, ymdInBusinessTZ } from "@/lib/businessTime";
import { BUSINESS_TZ_OFFSET } from "@/lib/config";
import { fetchAllRows } from "@/lib/fetchAll";
import { SITE } from "@/lib/site";

export type ReminderSummary = {
  date: string;
  candidates: number;
  sent: number;
  skippedNoEmail: number;
  failed: number;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Manda un correo de recordatorio a cada reserva CONFIRMED del día
 * siguiente (hora del club) que tenga correo y que todavía no haya recibido
 * uno. Pensado para correr una vez al día (vercel.json → /api/cron/reminders).
 *
 * Cada reserva se "reclama" con un UPDATE condicional sobre
 * reminder_sent_at antes de mandar, así dos ejecuciones simultáneas nunca
 * mandan el mismo recordatorio dos veces. Si el envío falla se libera el
 * reclamo, para que una ejecución manual posterior lo pueda reintentar.
 */
export async function sendTomorrowReminders(now = new Date()): Promise<ReminderSummary> {
  const date = addDaysToYMD(ymdInBusinessTZ(now), 1);
  const dayStart = `${date}T00:00:00${BUSINESS_TZ_OFFSET}`;
  const dayEnd = `${addDaysToYMD(date, 1)}T00:00:00${BUSINESS_TZ_OFFSET}`;

  const { data, error } = await fetchAllRows((from, to) =>
    supabaseAdmin
      .from("bookings")
      .select(
        "id, start_at, end_at, payment_status, contact_email, courts ( name ), customers:customer_id ( full_name, email )"
      )
      .eq("status", "CONFIRMED")
      .is("reminder_sent_at", null)
      .gte("start_at", dayStart)
      .lt("start_at", dayEnd)
      .order("start_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to)
  );
  if (error) throw new Error(error.message);

  const summary: ReminderSummary = { date, candidates: data.length, sent: 0, skippedNoEmail: 0, failed: 0 };

  for (const b of data) {
    const to = String(b.contact_email || b.customers?.email || "").trim();
    if (!EMAIL_RE.test(to)) {
      summary.skippedNoEmail += 1;
      continue;
    }

    const { data: claimed } = await supabaseAdmin
      .from("bookings")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", b.id)
      .is("reminder_sent_at", null)
      .select("id")
      .maybeSingle();
    if (!claimed) continue; // otra ejecución ya lo tomó

    const s = mxParts(b.start_at);
    const e = mxParts(b.end_at);
    const mail = buildBookingReminderEmail({
      clubName: SITE.name,
      fullName: String(b.customers?.full_name ?? ""),
      courtName: String(b.courts?.name ?? "Cancha"),
      dateLocal: s.dateLocal,
      startTimeLocal: s.timeLocal,
      endTimeLocal: e.timeLocal,
      paid: b.payment_status === "PAID",
      whatsappPhone: SITE.whatsapp,
    });

    const sent = await sendEmail({ to, subject: mail.subject, html: mail.html, text: mail.text });
    if (sent.ok) {
      summary.sent += 1;
    } else {
      summary.failed += 1;
      console.error("reminder email failed", b.id, sent.error);
      await supabaseAdmin.from("bookings").update({ reminder_sent_at: null }).eq("id", b.id);
    }
  }

  return summary;
}
