import { beforeAll, describe, expect, it, vi } from "vitest";
import { splitAmounts, formatMXN } from "@/lib/config";
import { computeExpectedAmountMXN } from "@/lib/pricing-shared";

// Corre contra la base de datos en memoria del modo demo (sin Mercado Pago
// real: los reembolsos se marcan pero no se llaman); el SMTP no está
// configurado, así que los correos fallan sin salir a la red.
vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
vi.stubEnv("SMTP_HOST", "");
vi.stubEnv("NOTIFY_EMAIL", "");

type Split = typeof import("@/lib/splitPayments");
let sp: Split;
let finalizeMpBooking: typeof import("@/lib/mpBookings").finalizeMpBooking;
let cancelBooking: typeof import("@/lib/cancellation").cancelBooking;
let db: any;

beforeAll(async () => {
  sp = await import("@/lib/splitPayments");
  ({ finalizeMpBooking } = await import("@/lib/mpBookings"));
  ({ cancelBooking } = await import("@/lib/cancellation"));
  ({ supabaseAdmin: db } = await import("@/lib/supabaseAdmin"));
});

const H = 3600_000;
let slot = 0;
/** Reserva de 1 h en la cancha 4, cada una en su propio horario. */
async function newBooking(startMs: number, extra: Record<string, unknown> = {}, exact = false) {
  // Un día distinto por reserva: misma hora, misma tarifa, sin traslapes.
  const start = new Date(exact ? startMs : startMs + slot++ * 24 * H);
  const { data, error } = await db
    .from("bookings")
    .insert({
      court_id: "court-split-test",
      start_at: start.toISOString(),
      end_at: new Date(start.getTime() + H).toISOString(),
      status: "HOLD",
      source: "WEB",
      payment_status: "UNPAID",
      ...extra,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

let payId = 1000;
const payment = (ref: string, amount: number, meta: Record<string, string> = {}) =>
  ({
    id: payId++,
    status: "approved",
    external_reference: ref,
    transaction_amount: amount,
    date_approved: new Date().toISOString(),
    metadata: meta,
  }) as any;

async function get(id: string) {
  const { data } = await db.from("bookings").select("*").eq("id", id).maybeSingle();
  return data;
}

/** Reserva dividida ya confirmada: la parte 1 pagada por quien reservó. */
async function confirmedSplit(startMs: number, parts = 4, extra: Record<string, unknown> = {}, exact = false) {
  const b = await newBooking(startMs, extra, exact);
  const total = computeExpectedAmountMXN(b.start_at, b.end_at);
  const { chargeNow } = await sp.prepareSplit(b.id, total, parts, null);
  const r = await finalizeMpBooking(b.id, payment(b.id, chargeNow), { displayName: "Roy" });
  expect(r.ok).toBe(true);
  return { b: await get(b.id), shares: await sp.getShares(b.id) };
}

describe("splitAmounts", () => {
  it("reparte con centavos exactos y el sobrante a quien reserva", () => {
    expect(splitAmounts(400, 4)).toEqual([100, 100, 100, 100]);
    expect(splitAmounts(350, 3)).toEqual([116.68, 116.66, 116.66]);
    expect(splitAmounts(525, 4).reduce((a, n) => a + n, 0)).toBeCloseTo(525, 5);
    expect(formatMXN(112.5)).toBe("$112.50");
    expect(formatMXN(350)).toBe("$350");
  });

  it("la referencia de pago de partes ida y vuelta", () => {
    const ref = sp.sharesRef("b-1", ["s-1", "s-2"]);
    expect(sp.parseSharesRef(ref)).toEqual({ bookingId: "b-1", shareIds: ["s-1", "s-2"] });
    expect(sp.parseSharesRef("4f0c…")).toBeNull();
  });
});

describe("pago dividido", () => {
  // 19:00 en el club: tarifa de noche, $400 → partes de $100.
  const future = Date.parse("2030-03-11T01:00:00Z");

  it("quien reserva paga su parte y la cancha queda confirmada como parcial", async () => {
    const { b, shares } = await confirmedSplit(future);
    expect(b.status).toBe("CONFIRMED");
    expect(b.payment_status).toBe("PARTIAL");
    expect(b.paid_amount).toBe(100);
    expect(b.split_parts).toBe(4);
    expect(b.split_token).toBeTruthy();
    expect(shares.map((s) => s.status)).toEqual(["PAID", "PENDING", "PENDING", "PENDING"]);
  });

  it("los compañeros pagan con la liga; dos personas no se quedan la misma parte", async () => {
    const { b } = await confirmedSplit(future);
    const first = await sp.claimSharesForCheckout(b.id, 2);
    expect(first).toMatchObject({ ok: true, amount: 200 });
    // Mientras ese checkout sigue abierto solo queda 1 parte libre.
    const second = await sp.claimSharesForCheckout(b.id, 2);
    expect(second).toMatchObject({ ok: false });
    if (first.ok) {
      const p = payment(sp.sharesRef(b.id, first.shareIds), 200, { payer_name: "Ana Torres" });
      expect(await sp.finalizeSharesPayment(p)).toMatchObject({ ok: true, assigned: 2, extraRefunded: 0 });
      // Reintento del webhook: no cambia nada.
      expect(await sp.finalizeSharesPayment(p)).toMatchObject({ ok: true, assigned: 2 });
    }
    const after = await get(b.id);
    expect(after.payment_status).toBe("PARTIAL");
    expect(after.paid_amount).toBe(300);
    expect(after.online_paid_amount).toBe(300);
  });

  it("si alguien paga partes ya cubiertas, toma otra pendiente y devuelve el excedente", async () => {
    const { b, shares } = await confirmedSplit(future);
    const ids23 = [shares[1].id, shares[2].id];
    await sp.finalizeSharesPayment(payment(sp.sharesRef(b.id, ids23), 200));
    // Otra persona pagó las mismas 2 partes (su checkout había vencido): solo queda la 4.
    const r = await sp.finalizeSharesPayment(payment(sp.sharesRef(b.id, ids23), 200));
    expect(r).toMatchObject({ ok: true, assigned: 1, extraRefunded: 100 });
    const after = await get(b.id);
    expect(after.payment_status).toBe("PAID");
    expect(after.paid_amount).toBe(400);
  });

  it("al cancelar a tiempo se reembolsa a cada quien y se cancelan las partes pendientes", async () => {
    const { b, shares } = await confirmedSplit(future + 400 * 24 * H);
    await sp.finalizeSharesPayment(payment(sp.sharesRef(b.id, [shares[1].id]), 100, { payer_email: "ana@x.com" }));
    const r = await cancelBooking(b.id, "CUSTOMER");
    expect(r).toMatchObject({ ok: true, refund: "refunded", refundedMXN: 200, split: true });
    const after = await get(b.id);
    expect(after.status).toBe("CANCELLED");
    expect(after.payment_status).toBe("REFUNDED");
    expect((await sp.getShares(b.id)).map((s) => s.status)).toEqual(["REFUNDED", "REFUNDED", "CANCELLED", "CANCELLED"]);
  });

  it("lo que falta 2 h después del partido es deuda de quien reservó", async () => {
    const { data: c } = await db.from("customers").insert({ full_name: "Deudor", phone_e164: "+524520000999" }).select("id").single();
    expect(await sp.findOutstandingDebt(c.id)).toBeNull();
    // Terminó hace 1 h: todavía no es deuda.
    await confirmedSplit(Date.now() - 2 * H, 4, { customer_id: c.id, court_id: "court-split-test-2" }, true);
    // Terminó hace mucho más de 2 h.
    const old = await confirmedSplit(Date.parse("2025-01-06T01:00:00Z"), 4, { customer_id: c.id });
    const debt = await sp.findOutstandingDebt(c.id);
    expect(debt).toMatchObject({ bookingId: old.b.id, remaining: 300, token: old.b.split_token });
    expect(sp.debtMessage(debt!)).toContain("$300");
  });

  it("reportes: lo parcial cuenta como ingreso y lo de Mercado Pago va aparte", async () => {
    const { enrichBooking, computeAggregateStats } = await import("@/lib/reception/utils");
    const base = {
      id: "x",
      court_name: "Cancha 1",
      start_at: "2030-03-10T19:00:00-06:00",
      end_at: "2030-03-10T20:00:00-06:00",
      status: "CONFIRMED" as const,
    };
    const partial = enrichBooking({
      ...base,
      payment_status: "PARTIAL",
      payment_method: "MERCADOPAGO",
      paid_amount: 100,
      online_paid_amount: 100,
      split_parts: 4,
    });
    expect(partial.pending_amount).toBe(300);
    const done = enrichBooking({
      ...base,
      id: "y",
      payment_status: "PAID",
      payment_method: "CASH",
      paid_amount: 400,
      online_paid_amount: 100,
      split_parts: 4,
    });
    const stats = computeAggregateStats([partial, done], 1);
    expect(stats.ingresos).toBe(500);
    expect(stats.pendiente).toBe(300);
    expect(stats.mercadopago).toBe(200);
    expect(stats.efectivo).toBe(300);
  });
});
