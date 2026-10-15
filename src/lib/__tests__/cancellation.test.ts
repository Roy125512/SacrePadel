import { beforeAll, describe, expect, it, vi } from "vitest";
import { withinCancelWindow, CANCEL_NOTICE_HOURS } from "@/lib/config";

// Corre contra la base de datos en memoria del modo demo; el SMTP no está
// configurado, así que los correos fallan sin salir a la red.
vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
vi.stubEnv("SMTP_HOST", "");
vi.stubEnv("NOTIFY_EMAIL", "");

let cancelBooking: typeof import("@/lib/cancellation").cancelBooking;
let customerCancelBlock: typeof import("@/lib/cancellation").customerCancelBlock;
let db: any;

beforeAll(async () => {
  ({ cancelBooking, customerCancelBlock } = await import("@/lib/cancellation"));
  ({ supabaseAdmin: db } = await import("@/lib/supabaseAdmin"));
});

const H = 3600_000;
let slot = 0;
async function newBooking(hoursFromNow: number, extra: Record<string, unknown> = {}) {
  // Cada reserva en su propia hora para no chocar con el traslape.
  const start = new Date(Date.now() + hoursFromNow * H + slot++ * 2 * H);
  const { data, error } = await db
    .from("bookings")
    .insert({
      court_id: "court-3",
      start_at: start.toISOString(),
      end_at: new Date(start.getTime() + H).toISOString(),
      status: "CONFIRMED",
      source: "WEB",
      payment_status: "UNPAID",
      ...extra,
    })
    .select("id, start_at")
    .single();
  if (error) throw error;
  return data as { id: string; start_at: string };
}

describe("withinCancelWindow", () => {
  it(`permite cancelar con ${CANCEL_NOTICE_HOURS} h o más`, () => {
    const now = Date.parse("2030-01-10T12:00:00Z");
    expect(withinCancelWindow("2030-01-11T12:00:00Z", now)).toBe(true);
    expect(withinCancelWindow("2030-01-11T11:59:00Z", now)).toBe(false);
  });
});

describe("customerCancelBlock", () => {
  const far = new Date(Date.now() + 72 * H).toISOString();
  it("bloquea lo que ya no está confirmado", () => {
    expect(customerCancelBlock({ status: "CANCELLED", start_at: far, payment_status: "UNPAID", payment_method: null })).toBe(
      "not_cancellable"
    );
  });
  it("bloquea lo pagado en recepción", () => {
    expect(customerCancelBlock({ status: "CONFIRMED", start_at: far, payment_status: "PAID", payment_method: "CASH" })).toBe(
      "paid_at_club"
    );
  });
  it("permite lo pagado en línea a tiempo", () => {
    expect(
      customerCancelBlock({ status: "CONFIRMED", start_at: far, payment_status: "PAID", payment_method: "MERCADOPAGO" })
    ).toBeNull();
  });
});

describe("cancelBooking", () => {
  it("el cliente cancela con anticipación y el horario se libera", async () => {
    const b = await newBooking(48);
    const r = await cancelBooking(b.id, "CUSTOMER");
    expect(r).toMatchObject({ ok: true, refund: "none" });
    const { data } = await db.from("bookings").select("status, cancelled_by, cancelled_at").eq("id", b.id).single();
    expect(data.status).toBe("CANCELLED");
    expect(data.cancelled_by).toBe("CUSTOMER");
    expect(data.cancelled_at).toBeTruthy();
  });

  it("con menos de 24 h el cliente ya no puede, pero recepción sí", async () => {
    const b = await newBooking(3);
    expect(await cancelBooking(b.id, "CUSTOMER")).toMatchObject({ ok: false, reason: "too_late" });
    expect(await cancelBooking(b.id, "RECEPTION")).toMatchObject({ ok: true });
  });

  it("no cancela dos veces", async () => {
    const b = await newBooking(50);
    expect(await cancelBooking(b.id, "CUSTOMER")).toMatchObject({ ok: true });
    expect(await cancelBooking(b.id, "CUSTOMER")).toMatchObject({ ok: false, reason: "not_cancellable" });
  });

  it("lo cobrado en recepción no se cancela sin devolver el dinero", async () => {
    const b = await newBooking(60, { payment_status: "PAID", payment_method: "CASH", paid_amount: 350 });
    expect(await cancelBooking(b.id, "RECEPTION")).toMatchObject({ ok: false, reason: "paid_at_club" });
  });
});
