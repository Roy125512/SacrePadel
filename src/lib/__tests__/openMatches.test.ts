import { beforeAll, describe, expect, it, vi } from "vitest";
import { computeExpectedAmountMXN } from "@/lib/pricing-shared";
import { levelRangeLabel, divisionNumber } from "@/lib/config";

// Base de datos en memoria del modo demo; sin Mercado Pago ni correo reales.
vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
vi.stubEnv("SMTP_HOST", "");
vi.stubEnv("NOTIFY_EMAIL", "");

let om: typeof import("@/lib/openMatches");
let sp: typeof import("@/lib/splitPayments");
let finalizeMpBooking: typeof import("@/lib/mpBookings").finalizeMpBooking;
let db: any;

beforeAll(async () => {
  om = await import("@/lib/openMatches");
  sp = await import("@/lib/splitPayments");
  ({ finalizeMpBooking } = await import("@/lib/mpBookings"));
  ({ supabaseAdmin: db } = await import("@/lib/supabaseAdmin"));
});

const H = 3600_000;
const ORGANIZER = "aaaaaaaa-0000-4000-8000-000000000001";
const ANA = "aaaaaaaa-0000-4000-8000-000000000002";
const LUIS = "aaaaaaaa-0000-4000-8000-000000000003";

let day = 0;
let payId = 5000;
const payment = (ref: string, amount: number, meta: Record<string, string> = {}) =>
  ({ id: payId++, status: "approved", external_reference: ref, transaction_amount: amount, metadata: meta }) as any;

/** Partido abierto confirmado (quien lo crea ya pagó su lugar), a las 19:00 del club. */
async function openMatch(startMs = Date.parse("2030-05-01T01:00:00Z") + day++ * 24 * H) {
  const start = new Date(startMs);
  const { data: b } = await db
    .from("bookings")
    .insert({
      court_id: "court-match-test",
      start_at: start.toISOString(),
      end_at: new Date(start.getTime() + H).toISOString(),
      status: "HOLD",
      source: "WEB",
      payment_status: "UNPAID",
      user_id: ORGANIZER,
      is_open_match: true,
      match_type: "COMPETITIVE",
      match_gender: "ANY",
      match_level_min: 3,
      match_level_max: 5,
    })
    .select("*")
    .single();
  const { chargeNow } = await sp.prepareSplit(b.id, computeExpectedAmountMXN(b.start_at, b.end_at), 4, null);
  await finalizeMpBooking(b.id, payment(b.id, chargeNow), { displayName: "Org" });
  const { data } = await db.from("bookings").select("*").eq("id", b.id).single();
  return data;
}

async function join(bookingId: string, userId: string) {
  const claim = await sp.claimSharesForCheckout(bookingId, 1);
  if (!claim.ok) throw new Error(claim.message);
  return sp.finalizeSharesPayment(payment(sp.sharesRef(bookingId, claim.shareIds), claim.amount, { user_id: userId }));
}

describe("reglas para unirse", () => {
  const rules = { match_gender: "ANY", match_level_min: 3, match_level_max: 5 };
  it("nivel y género", () => {
    expect(om.joinBlock(rules, { sex: "F", division: "4ta" })).toBeNull();
    expect(om.joinBlock(rules, { sex: "M", division: "2da" })).toMatch(/rango/);
    expect(om.joinBlock(rules, { sex: "M", division: null })).toMatch(/perfil/);
    expect(om.joinBlock({ ...rules, match_gender: "FEMALE" }, { sex: "M", division: "4ta" })).toMatch(/femenil/);
    // Todos los niveles: no hace falta división.
    expect(om.joinBlock({ match_gender: "ANY", match_level_min: 1, match_level_max: 6 }, { sex: null, division: null })).toBeNull();
  });
  it("etiquetas de nivel", () => {
    expect(levelRangeLabel(3, 5)).toBe("3ra – 5ta");
    expect(levelRangeLabel(1, 6)).toBe("Todos los niveles");
    expect(divisionNumber("4ta")).toBe(4);
  });
});

describe("partidos abiertos", () => {
  it("quien lo crea ocupa el lugar 1 y el partido aparece en la lista", async () => {
    const b = await openMatch();
    const shares = await sp.getShares(b.id);
    expect(shares[0]).toMatchObject({ status: "PAID", user_id: ORGANIZER });
    const list = await om.listOpenMatches();
    const card = list.find((m) => m.token === b.split_token);
    expect(card).toMatchObject({ spots_left: 3, match_type: "COMPETITIVE", match_level_min: 3, share_amount: 100 });
  });

  it("un jugador se une, no puede pagar dos veces y se puede salir con reembolso", async () => {
    const b = await openMatch();
    expect(await join(b.id, ANA)).toMatchObject({ ok: true, assigned: 1 });
    expect((await sp.getShares(b.id)).filter((s) => s.user_id === ANA)).toHaveLength(1);
    // Segundo pago del mismo jugador: se le devuelve.
    expect(await join(b.id, ANA)).toMatchObject({ ok: false, reason: "duplicate" });

    expect(await om.leaveMatch(b.id, ANA)).toMatchObject({ ok: true, refundedMXN: 100 });
    const after = await sp.getShares(b.id);
    expect(after.filter((s) => s.status === "PAID")).toHaveLength(1);
    const { data } = await db.from("bookings").select("paid_amount, payment_status").eq("id", b.id).single();
    expect(data).toMatchObject({ paid_amount: 100, payment_status: "PARTIAL" });
  });

  it("quien lo creó no se sale (cancela), y con menos de 24 h nadie se sale en línea", async () => {
    const b = await openMatch();
    expect(await om.leaveMatch(b.id, ORGANIZER)).toMatchObject({ ok: false });
    const soon = await openMatch(Date.now() + 5 * H);
    await join(soon.id, LUIS);
    const r = await om.leaveMatch(soon.id, LUIS);
    expect(r.ok).toBe(false);
  });

  it("al llenarse queda pagado y completo", async () => {
    const b = await openMatch();
    for (const u of [ANA, LUIS, "aaaaaaaa-0000-4000-8000-000000000004"]) await join(b.id, u);
    const { data } = await db.from("bookings").select("payment_status").eq("id", b.id).single();
    expect(data.payment_status).toBe("PAID");
    const card = (await om.listOpenMatches()).find((m) => m.token === b.split_token);
    expect(card?.spots_left).toBe(0);
  });
});
