import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Base de datos en memoria del modo demo + envío de correo simulado.
vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");

const sendEmail = vi.fn(async (_args: { to: string; subject: string }) => ({ ok: true as const }));
vi.mock("@/lib/mailer", () => ({ sendEmail: (args: any) => sendEmail(args) }));

let sendTomorrowReminders: typeof import("@/lib/bookingReminders").sendTomorrowReminders;
let db: any;

// "Ahora" = 4 oct 2026, 6 p.m. en Pátzcuaro → mañana = 5 oct.
const NOW = new Date("2026-10-05T00:00:00Z");

beforeAll(async () => {
  ({ sendTomorrowReminders } = await import("@/lib/bookingReminders"));
  ({ supabaseAdmin: db } = await import("@/lib/supabaseAdmin"));

  const { data: cust } = await db.from("customers").insert({ full_name: "Rita Ríos", email: "rita@x.com" }).select("id").single();
  const rows = [
    // mañana, confirmada, con correo de contacto → recordatorio
    { start: "2026-10-05T10:00:00-06:00", end: "2026-10-05T11:00:00-06:00", status: "CONFIRMED", contact_email: "ana@x.com" },
    // mañana, sin contact_email pero el cliente sí tiene correo → recordatorio
    { start: "2026-10-05T12:00:00-06:00", end: "2026-10-05T13:00:00-06:00", status: "CONFIRMED", customer_id: cust.id },
    // mañana, sin ningún correo → se omite
    { start: "2026-10-05T14:00:00-06:00", end: "2026-10-05T15:00:00-06:00", status: "CONFIRMED" },
    // mañana pero cancelada → no
    { start: "2026-10-05T16:00:00-06:00", end: "2026-10-05T17:00:00-06:00", status: "CANCELLED", contact_email: "no@x.com" },
    // pasado mañana → no
    { start: "2026-10-06T10:00:00-06:00", end: "2026-10-06T11:00:00-06:00", status: "CONFIRMED", contact_email: "luego@x.com" },
    // hoy → no
    { start: "2026-10-04T20:00:00-06:00", end: "2026-10-04T21:00:00-06:00", status: "CONFIRMED", contact_email: "hoy@x.com" },
  ];
  for (const r of rows) {
    const { error } = await db.from("bookings").insert({
      court_id: "court-reminders-test",
      start_at: r.start,
      end_at: r.end,
      status: r.status,
      source: "WEB",
      payment_status: "UNPAID",
      contact_email: r.contact_email ?? null,
      customer_id: r.customer_id ?? null,
    });
    if (error) throw new Error(error.message);
  }
});

beforeEach(() => sendEmail.mockClear());

describe("sendTomorrowReminders", () => {
  it("manda recordatorio solo a reservas confirmadas de mañana con correo", async () => {
    const summary = await sendTomorrowReminders(NOW);
    expect(summary.date).toBe("2026-10-05");
    expect(summary.sent).toBe(2);
    // Al menos la nuestra sin correo (el demo trae reservas de ejemplo sin correo).
    expect(summary.skippedNoEmail).toBeGreaterThanOrEqual(1);
    expect(sendEmail.mock.calls.map((c) => c[0].to).sort()).toEqual(["ana@x.com", "rita@x.com"]);
    expect(sendEmail.mock.calls[0][0].subject).toContain("Recordatorio");
  });

  it("no manda el mismo recordatorio dos veces", async () => {
    const summary = await sendTomorrowReminders(NOW);
    expect(summary.sent).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
