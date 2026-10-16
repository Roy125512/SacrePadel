import { beforeAll, describe, expect, it, vi } from "vitest";
import { americanaStandings, generateAmericana } from "@/lib/americana";

// Base de datos en memoria del modo demo; sin Mercado Pago ni correo reales.
vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
vi.stubEnv("SMTP_HOST", "");
vi.stubEnv("NOTIFY_EMAIL", "");

let ev: typeof import("@/lib/events");
let db: any;
beforeAll(async () => {
  ev = await import("@/lib/events");
  ({ supabaseAdmin: db } = await import("@/lib/supabaseAdmin"));
});

const P = Array.from({ length: 8 }, (_, i) => `p${i + 1}`);

describe("americana", () => {
  it("cada ronda: 4 por cancha, nadie juega dos veces y sin repetir pareja", () => {
    const rounds = generateAmericana(P, 2, 7);
    const pairs = new Set<string>();
    let repeats = 0;
    for (const r of rounds) {
      const seen = r.matches.flatMap((m) => [...m.teamA, ...m.teamB]);
      expect(seen).toHaveLength(8);
      expect(new Set(seen).size).toBe(8);
      for (const m of r.matches) {
        for (const t of [m.teamA, m.teamB]) {
          const k = [...t].sort().join("|");
          if (pairs.has(k)) repeats++;
          pairs.add(k);
        }
      }
    }
    expect(repeats).toBe(0);
  });

  it("si sobran jugadores, descansan por turnos", () => {
    const rounds = generateAmericana(P.slice(0, 6), 2, 6);
    const rests = new Map<string, number>();
    for (const r of rounds) {
      expect(r.matches).toHaveLength(1);
      expect(r.resting).toHaveLength(2);
      for (const p of r.resting) rests.set(p, (rests.get(p) ?? 0) + 1);
    }
    expect(Math.max(...rests.values()) - Math.min(...rests.values())).toBeLessThanOrEqual(1);
  });

  it("tabla por puntos", () => {
    const rounds = [
      { round: 1, resting: [], matches: [{ court: 0, teamA: ["a", "b"] as [string, string], teamB: ["c", "d"] as [string, string], scoreA: 16, scoreB: 8 }] },
      { round: 2, resting: [], matches: [{ court: 0, teamA: ["a", "c"] as [string, string], teamB: ["b", "d"] as [string, string], scoreA: 10, scoreB: 14 }] },
    ];
    const t = americanaStandings(["a", "b", "c", "d"], rounds);
    expect(t.map((s) => s.id)).toEqual(["b", "a", "d", "c"]);
    expect(t[0]).toMatchObject({ points: 30, won: 2 });
  });
});

describe("eventos", () => {
  let n = 0;
  const day = () => {
    const d = new Date(Date.now() + (10 + n++) * 86400_000);
    return d.toISOString().slice(0, 10);
  };
  const user = (i: number) => ({ id: `dddddddd-0000-4000-8000-0000000000${String(i).padStart(2, "0")}`, email: null });

  async function newEvent(extra: Partial<import("@/lib/events").NewEvent> = {}) {
    const d = day();
    const r = await ev.createEvent(
      {
        title: "Americana prueba",
        kind: "AMERICANA",
        starts_at: `${d}T18:00:00-06:00`,
        ends_at: `${d}T21:00:00-06:00`,
        court_ids: ["court-ev-a", "court-ev-b"],
        entry: "INDIVIDUAL",
        capacity: 4,
        price: 0,
        ...extra,
      },
      "admin",
      "Recepción"
    );
    if (!r.ok) throw new Error(r.message);
    return r.id;
  }

  it("aparta las canchas y no deja empalmar otro evento", async () => {
    const id = await newEvent();
    const { data: bks } = await db.from("bookings").select("court_id, kind, status").eq("event_id", id);
    expect(bks).toHaveLength(2);
    expect(bks[0]).toMatchObject({ kind: "EVENT", status: "CONFIRMED" });
    const e = await ev.getEvent(id);
    const clash = await ev.createEvent(
      { title: "Otro", kind: "SOCIAL", starts_at: e!.starts_at, ends_at: e!.ends_at, court_ids: ["court-ev-a"], entry: "INDIVIDUAL", capacity: 4, price: 0 },
      "admin",
      null
    );
    expect(clash.ok).toBe(false);
  });

  it("inscripción gratis, cupo, nivel y cancelación", async () => {
    const id = await newEvent({ level_min: 3, level_max: 5 });
    for (let i = 1; i <= 5; i++) {
      await db.from("profiles").upsert({ id: user(i).id, role: "customer", full_name: `Jugador ${i}`, level: 3.5 });
    }
    await db.from("profiles").upsert({ id: user(9).id, role: "customer", full_name: "Muy alto", level: 6.5 });
    expect(await ev.registerForEvent(id, user(9), null, "http://x")).toMatchObject({ ok: false });
    for (let i = 1; i <= 4; i++) expect(await ev.registerForEvent(id, user(i), null, "http://x")).toMatchObject({ ok: true, confirmed: true });
    expect(await ev.registerForEvent(id, user(1), null, "http://x")).toMatchObject({ ok: false });
    expect(await ev.registerForEvent(id, user(5), null, "http://x")).toMatchObject({ ok: false, message: "Ya se llenó el cupo." });
    expect(await ev.cancelMyRegistration(id, user(2).id)).toMatchObject({ ok: true });
    expect(await ev.registerForEvent(id, user(5), null, "http://x")).toMatchObject({ ok: true, confirmed: true });
  });

  it("con precio: se aparta el lugar y el pago confirma", async () => {
    const id = await newEvent({ price: 250 });
    await db.from("profiles").upsert({ id: user(20).id, role: "customer", full_name: "Paga" });
    // En demo no hay Mercado Pago, pero el lugar queda apartado.
    expect(await ev.registerForEvent(id, user(20), null, "http://x")).toMatchObject({ ok: false });
    const { data: reg } = await db.from("event_registrations").select("id, status").eq("event_id", id).eq("user_id", user(20).id).single();
    expect(reg.status).toBe("PENDING");
    const r = await ev.finalizeEventPayment({ id: 9001, status: "approved", external_reference: `event:${reg.id}`, transaction_amount: 250 } as any);
    expect(r.ok).toBe(true);
    const { data: after } = await db.from("event_registrations").select("status, payment_status").eq("id", reg.id).single();
    expect(after).toMatchObject({ status: "CONFIRMED", payment_status: "PAID" });
  });

  it("rondas con los confirmados y cancelar el evento libera las canchas", async () => {
    const id = await newEvent({ capacity: 8 });
    expect(await ev.generateEventRounds(id, 3)).toMatchObject({ ok: false });
    for (let i = 30; i < 36; i++) {
      await db.from("profiles").upsert({ id: user(i).id, role: "customer", full_name: `J ${i}` });
      await ev.registerForEvent(id, user(i), null, "http://x");
    }
    expect(await ev.generateEventRounds(id, 3)).toEqual({ ok: true });
    const e = await ev.getEvent(id);
    expect(e!.rounds).toHaveLength(3);
    expect(e!.status).toBe("CLOSED");
    expect(await ev.saveEventScore(id, 1, 0, 16, 9)).toEqual({ ok: true });
    expect(await ev.generateEventRounds(id, 3)).toMatchObject({ ok: false });

    expect(await ev.cancelEvent(id)).toMatchObject({ ok: true });
    const { data: bks } = await db.from("bookings").select("status").eq("event_id", id);
    expect(bks.every((b: any) => b.status === "CANCELLED")).toBe(true);
    expect(await ev.activeRegistrations(id)).toHaveLength(0);
  });
});
