import { beforeAll, describe, expect, it, vi } from "vitest";

// Corre contra la base de datos en memoria del modo demo; el SMTP no está
// configurado, así que los correos fallan sin salir a la red.
vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
vi.stubEnv("SMTP_HOST", "");
vi.stubEnv("NOTIFY_EMAIL", "");

let finalizeMpBooking: typeof import("@/lib/mpBookings").finalizeMpBooking;
let db: any;

beforeAll(async () => {
  ({ finalizeMpBooking } = await import("@/lib/mpBookings"));
  ({ supabaseAdmin: db } = await import("@/lib/supabaseAdmin"));
});

let hour = 7;
async function newHold(extra: Record<string, unknown> = {}) {
  // Cada reserva en un horario distinto para no chocar con el traslape.
  const h = String(hour++).padStart(2, "0");
  const { data, error } = await db
    .from("bookings")
    .insert({
      court_id: "court-2",
      start_at: `2030-01-15T${h}:00:00-06:00`,
      end_at: `2030-01-15T${h}:00:00-06:00`.replace(`T${h}:00`, `T${String(hour).padStart(2, "0")}:00`),
      status: "HOLD",
      source: "WEB",
      payment_status: "UNPAID",
      hold_expires_at: new Date(Date.now() - 60_000).toISOString(), // ya vencido
      ...extra,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

const payment = (bookingId: string, amount: number, status = "approved") =>
  ({ id: 123, status, external_reference: bookingId, transaction_amount: amount, date_approved: "2030-01-01T00:00:00Z" }) as any;

async function get(id: string) {
  const { data } = await db.from("bookings").select("*").eq("id", id).maybeSingle();
  return data;
}

describe("finalizeMpBooking", () => {
  it("confirma un HOLD pagado aunque ya haya vencido", async () => {
    const b = await newHold();
    const r = await finalizeMpBooking(b.id, payment(b.id, 350));
    expect(r.ok).toBe(true);
    const after = await get(b.id);
    expect(after.status).toBe("CONFIRMED");
    expect(after.payment_status).toBe("PAID");
    expect(after.payment_method).toBe("MERCADOPAGO");
    expect(after.hold_expires_at).toBeNull();
  });

  it("registra lo que realmente cobró Mercado Pago, no el precio calculado", async () => {
    const b = await newHold();
    await finalizeMpBooking(b.id, payment(b.id, 100));
    expect(Number((await get(b.id)).paid_amount)).toBe(100);
  });

  it("es idempotente: un segundo aviso no cambia el pago", async () => {
    const b = await newHold();
    await finalizeMpBooking(b.id, payment(b.id, 350));
    const first = await get(b.id);
    await finalizeMpBooking(b.id, { ...payment(b.id, 999), id: 456 });
    const second = await get(b.id);
    expect(second.paid_amount).toBe(first.paid_amount);
    expect(second.mp_payment_id).toBe(first.mp_payment_id);
  });

  it("no resucita una reserva cancelada", async () => {
    const b = await newHold({ status: "CANCELLED" });
    const r = await finalizeMpBooking(b.id, payment(b.id, 350));
    expect(r).toEqual({ ok: false, reason: "cancelled" });
    expect((await get(b.id)).status).toBe("CANCELLED");
  });

  it("rechaza pagos no aprobados o de otra reserva", async () => {
    const b = await newHold();
    expect(await finalizeMpBooking(b.id, payment(b.id, 350, "pending"))).toEqual({ ok: false, reason: "not_approved" });
    expect(await finalizeMpBooking(b.id, payment("otra-reserva", 350))).toEqual({ ok: false, reason: "wrong_booking" });
    expect((await get(b.id)).status).toBe("HOLD");
  });

  it("avisa cuando la reserva ya no existe", async () => {
    const r = await finalizeMpBooking("no-existe", payment("no-existe", 350));
    expect(r).toEqual({ ok: false, reason: "not_found" });
  });
});
