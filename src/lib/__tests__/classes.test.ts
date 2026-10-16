import { beforeAll, describe, expect, it, vi } from "vitest";

// Base de datos en memoria del modo demo.
vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
vi.stubEnv("SMTP_HOST", "");
vi.stubEnv("NOTIFY_EMAIL", "");

let cl: typeof import("@/lib/classes");
let db: any;
beforeAll(async () => {
  cl = await import("@/lib/classes");
  ({ supabaseAdmin: db } = await import("@/lib/supabaseAdmin"));
});

const at = (ymd: string, hhmm: string) => `${ymd}T${hhmm}:00-06:00`;

describe("horarios de clase", () => {
  // 2030-03-04 es lunes.
  const ymd = "2030-03-04";
  const base = {
    windows: [{ dow: 1, start: "07:00", end: "10:00" }],
    ymd,
    minutes: 60,
    nowMs: Date.parse("2030-03-01T00:00:00Z"),
    coachBusy: [],
    courtBusy: [],
    courtIds: ["c1", "c2"],
  };
  it("dentro del horario del entrenador, cada 30 min", () => {
    expect(cl.coachStartTimes(base).map((t) => t.slice(11, 16))).toEqual(["07:00", "07:30", "08:00", "08:30", "09:00"]);
    expect(cl.coachStartTimes({ ...base, minutes: 90 })).toHaveLength(4);
    expect(cl.coachStartTimes({ ...base, ymd: "2030-03-05" })).toEqual([]); // martes: no da clase
  });
  it("sin choques con sus otras clases y con al menos una cancha libre", () => {
    const busy = { start_at: at(ymd, "08:00"), end_at: at(ymd, "09:00") };
    expect(cl.coachStartTimes({ ...base, coachBusy: [busy] }).map((t) => t.slice(11, 16))).toEqual(["07:00", "09:00"]);
    const both = [{ court_id: "c1", ...busy }, { court_id: "c2", ...busy }];
    expect(cl.coachStartTimes({ ...base, courtBusy: both }).map((t) => t.slice(11, 16))).toEqual(["07:00", "09:00"]);
    expect(cl.coachStartTimes({ ...base, courtBusy: [both[0]] })).toHaveLength(5);
  });
  it("no con menos de 1 h de anticipación", () => {
    expect(cl.coachStartTimes({ ...base, nowMs: Date.parse(at(ymd, "07:20")) }).map((t) => t.slice(11, 16))).toEqual(["08:30", "09:00"]);
  });
  it("precio y validación", () => {
    expect(cl.classPrice({ rate_individual: 500, rate_pair: 700 }, "INDIVIDUAL", 90)).toBe(750);
    expect(cl.classPrice({ rate_individual: 500, rate_pair: null }, "PAIR", 60)).toBeNull();
    expect(cl.validWindows([{ dow: 1, start: "10:00", end: "09:00" }])).toBe(false);
  });
});

describe("reservar clase", () => {
  const COACH = "99999999-9999-4999-8999-999999999991";
  const USER = { id: "99999999-9999-4999-8999-0000000000a1", email: "alumno@x.com" };
  let next: string;

  beforeAll(async () => {
    // Un lunes lejano: el entrenador da clase todo el día; la cancha propia de la prueba.
    next = "2030-04-01";
    await db.from("courts").insert({ id: "court-class-test", name: "Cancha prueba", is_active: true });
    await db.from("coaches").insert({ id: COACH, name: "Coach Prueba", rate_individual: 500, rate_pair: 700, weekly_hours: [{ dow: 1, start: "07:00", end: "21:00" }], active: true });
    await db.from("profiles").upsert({ id: USER.id, role: "customer", full_name: "Alumno Uno", phone_e164: "+524521119999" });
  });

  it("pagando en recepción queda confirmada con el precio de la clase", async () => {
    const r = await cl.bookClass({ coachId: COACH, startAt: at(next, "08:00"), minutes: 90, type: "PAIR", pay: "CLUB", user: USER, origin: "http://x" });
    expect(r).toMatchObject({ ok: true, confirmed: true });
    const { data } = await db.from("bookings").select("*").eq("coach_id", COACH).eq("status", "CONFIRMED");
    expect(data[0]).toMatchObject({ kind: "CLASS", class_type: "PAIR", list_price: 1050, payment_status: "UNPAID" });
    // El entrenador ya no está libre a esa hora.
    const times = await cl.availableClassTimes((await cl.getCoach(COACH))!, next, 60);
    expect(times.map((t) => t.slice(11, 16))).not.toContain("08:30");
  });

  it("no deja reservar fuera de horario ni sin teléfono", async () => {
    expect(await cl.bookClass({ coachId: COACH, startAt: at(next, "22:00"), minutes: 60, type: "INDIVIDUAL", pay: "CLUB", user: USER, origin: "http://x" })).toMatchObject({ ok: false });
    const noPhone = { id: "99999999-9999-4999-8999-0000000000a2", email: "b@x.com" };
    await db.from("profiles").upsert({ id: noPhone.id, role: "customer", full_name: "Sin Tel" });
    expect(await cl.bookClass({ coachId: COACH, startAt: at(next, "12:00"), minutes: 60, type: "INDIVIDUAL", pay: "CLUB", user: noPhone, origin: "http://x" })).toMatchObject({ ok: false, message: expect.stringContaining("teléfono") });
  });

  it("en línea (sin Mercado Pago en demo) no deja el horario apartado", async () => {
    const r = await cl.bookClass({ coachId: COACH, startAt: at(next, "15:00"), minutes: 60, type: "INDIVIDUAL", pay: "ONLINE", user: USER, origin: "http://x" });
    expect(r.ok).toBe(false);
    const { data } = await db.from("bookings").select("id").eq("coach_id", COACH).eq("status", "HOLD");
    expect(data).toHaveLength(0);
  });

  it("el pago en línea se valida contra el precio de la clase", async () => {
    const { finalizeMpBooking } = await import("@/lib/mpBookings");
    const { data: b } = await db
      .from("bookings")
      .insert({ court_id: "court-class-test", start_at: at(next, "18:00"), end_at: at(next, "19:00"), status: "HOLD", source: "WEB", kind: "CLASS", coach_id: COACH, list_price: 500, payment_status: "UNPAID" })
      .select("id")
      .single();
    const r = await finalizeMpBooking(b.id, { id: 77, status: "approved", external_reference: b.id, transaction_amount: 500 } as any);
    expect(r.ok).toBe(true);
    const { enrichBooking } = await import("@/lib/reception/utils");
    expect(enrichBooking({ id: "z", court_name: "x", start_at: at(next, "18:00"), end_at: at(next, "19:00"), status: "CONFIRMED", list_price: 500 }).amount).toBe(500);
  });
});
