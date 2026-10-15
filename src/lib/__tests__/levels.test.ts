import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  computeLevelChanges,
  initialLevelFromAnswers,
  levelToDivision,
  parseSets,
  validSet,
} from "@/lib/levels-shared";

// Base de datos en memoria del modo demo.
vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
vi.stubEnv("SMTP_HOST", "");
vi.stubEnv("NOTIFY_EMAIL", "");

let lv: typeof import("@/lib/levels");
let db: any;
beforeAll(async () => {
  lv = await import("@/lib/levels");
  ({ supabaseAdmin: db } = await import("@/lib/supabaseAdmin"));
});

describe("cuestionario y categorías", () => {
  it("nivel inicial entre 0.5 y 6.5", () => {
    expect(initialLevelFromAnswers([0, 0, 0, 0, 0])).toBe(0.5);
    expect(initialLevelFromAnswers([4, 4, 2, 3, 3])).toBe(6.5);
    expect(initialLevelFromAnswers([2, 2, 1, 1, 1])).toBe(2.9);
    expect(initialLevelFromAnswers([0, 0])).toBeNull();
    expect(initialLevelFromAnswers([9, 0, 0, 0, 0])).toBeNull();
  });
  it("categoría por nivel", () => {
    expect(levelToDivision(6.1)).toBe("1ra");
    expect(levelToDivision(3.0)).toBe("4ta");
    expect(levelToDivision(0.5)).toBe("6ta");
  });
});

describe("marcador", () => {
  it("sets válidos", () => {
    expect(validSet(6, 4)).toBe(true);
    expect(validSet(7, 6)).toBe(true);
    expect(validSet(7, 5)).toBe(true);
    expect(validSet(6, 5)).toBe(false);
    expect(validSet(7, 4)).toBe(false);
    expect(validSet(5, 3)).toBe(false);
  });
  it("ganador, empate y terceros sets", () => {
    expect(parseSets([[6, 4], [6, 2]])).toMatchObject({ winner: "A", gamesA: 12, gamesB: 6 });
    expect(parseSets([[6, 4], [3, 6]])).toMatchObject({ winner: "TIE" });
    expect(parseSets([[6, 4], [3, 6], [5, 7]])).toMatchObject({ winner: "B" });
    expect(parseSets([[6, 4], [6, 3], [6, 1]])).toHaveProperty("error");
    expect(parseSets([[6, 4]])).toHaveProperty("error");
  });
});

describe("ajuste de nivel", () => {
  const p = (id: string, level: number, reliability = 50) => ({ id, level, reliability });
  const win = { winner: "A" as const, gamesA: 12, gamesB: 8 };

  it("quien gana sube, quien pierde baja", () => {
    const c = computeLevelChanges([p("a1", 3), p("a2", 3)], [p("b1", 3), p("b2", 3)], win);
    expect(c.a1.after).toBeGreaterThan(3);
    expect(c.b1.after).toBeLessThan(3);
    expect(c.a1.reliabilityAfter).toBe(60);
  });
  it("ganarle a una pareja más fuerte sube más", () => {
    const even = computeLevelChanges([p("a", 3), p("x", 3)], [p("b", 3), p("y", 3)], win).a;
    const upset = computeLevelChanges([p("a", 3), p("x", 3)], [p("b", 4), p("y", 4)], win).a;
    expect(upset.after - upset.before).toBeGreaterThan(even.after - even.before);
  });
  it("con poca confiabilidad se mueve más rápido", () => {
    const fresh = computeLevelChanges([p("a", 3, 0), p("x", 3)], [p("b", 3), p("y", 3)], win).a;
    const steady = computeLevelChanges([p("a", 3, 100), p("x", 3)], [p("b", 3), p("y", 3)], win).a;
    expect(fresh.after - fresh.before).toBeGreaterThan(steady.after - steady.before);
  });
  it("un empate entre niveles distintos favorece a la pareja más débil", () => {
    const c = computeLevelChanges([p("a", 2), p("x", 2)], [p("b", 4), p("y", 4)], { winner: "TIE", gamesA: 9, gamesB: 9 });
    expect(c.a.after).toBeGreaterThan(2);
    expect(c.b.after).toBeLessThan(4);
  });
});

describe("capturar y confirmar resultado", () => {
  const U = ["bbbbbbbb-0000-4000-8000-000000000001", "bbbbbbbb-0000-4000-8000-000000000002", "bbbbbbbb-0000-4000-8000-000000000003", "bbbbbbbb-0000-4000-8000-000000000004"];
  let n = 0;

  /** Partido competitivo ya jugado (terminó hace `hoursAgo` h) con los 4 jugadores. */
  async function playedMatch(hoursAgo = 3, type = "COMPETITIVE") {
    // Cancha propia de las pruebas y 4 h entre partidos: sin traslapes.
    const end = Date.now() - hoursAgo * 3600_000 - n++ * 4 * 3600_000;
    const start = end - 3600_000;
    const { data: b } = await db
      .from("bookings")
      .insert({
        court_id: "court-levels-test",
        start_at: new Date(start).toISOString(),
        end_at: new Date(end).toISOString(),
        status: "COMPLETED",
        source: "WEB",
        payment_status: "PAID",
        is_open_match: true,
        match_type: type,
        split_parts: 4,
        split_token: crypto.randomUUID(),
      })
      .select("*")
      .single();
    for (const [i, uid] of U.entries()) {
      await db.from("booking_shares").insert({ booking_id: b.id, seq: i + 1, amount: 100, status: "PAID", user_id: uid });
    }
    return b;
  }

  it("se captura, la otra pareja confirma y cambian los 4 niveles", async () => {
    for (const [i, uid] of U.entries()) {
      await db.from("profiles").upsert({ id: uid, role: "customer", level: 3 + i * 0.1, level_reliability: 30, level_matches: 3 });
    }
    const b = await playedMatch();
    // Nadie de fuera ni uno mismo como pareja.
    expect(await lv.submitResult(b.id, "bbbbbbbb-0000-4000-8000-00000000000f", U[1], [[6, 4], [6, 4]])).toMatchObject({ ok: false });
    expect(await lv.submitResult(b.id, U[0], U[0], [[6, 4], [6, 4]])).toMatchObject({ ok: false });
    expect(await lv.submitResult(b.id, U[0], U[1], [[6, 5], [6, 4]])).toMatchObject({ ok: false });

    expect(await lv.submitResult(b.id, U[0], U[1], [[6, 4], [6, 3]])).toEqual({ ok: true });
    // Ya hay resultado pendiente: no se captura otro.
    expect(await lv.submitResult(b.id, U[2], U[3], [[6, 0], [6, 0]])).toMatchObject({ ok: false });
    // Lo confirma la pareja contraria, no la que lo capturó.
    expect(await lv.reviewResult(b.id, U[1], true)).toMatchObject({ ok: false });
    expect(await lv.reviewResult(b.id, U[2], true)).toEqual({ ok: true });
    expect(await lv.reviewResult(b.id, U[3], true)).toMatchObject({ ok: false });

    const { data: profs } = await db.from("profiles").select("id, level, level_matches").in("id", U);
    const lvl = Object.fromEntries(profs.map((p: any) => [p.id, p]));
    expect(lvl[U[0]].level).toBeGreaterThan(3);
    expect(lvl[U[2]].level).toBeLessThan(3.2);
    expect(lvl[U[0]].level_matches).toBe(4);

    const mine = await lv.myLevel(U[0]);
    expect(mine.history[0]).toMatchObject({ outcome: "W", sets: [[6, 4], [6, 3]] });
  });

  it("si la otra pareja lo rechaza, se puede capturar de nuevo", async () => {
    const b = await playedMatch(5);
    await lv.submitResult(b.id, U[0], U[2], [[6, 1], [6, 1]]);
    expect(await lv.reviewResult(b.id, U[1], false)).toEqual({ ok: true });
    expect(await lv.submitResult(b.id, U[1], U[3], [[6, 4], [4, 6], [7, 6]])).toEqual({ ok: true });
  });

  it("solo competitivos, después del partido y dentro de 7 días", async () => {
    const friendly = await playedMatch(3, "FRIENDLY");
    expect(await lv.submitResult(friendly.id, U[0], U[1], [[6, 4], [6, 4]])).toMatchObject({ ok: false });
    const old = await playedMatch(24 * 8);
    expect(await lv.submitResult(old.id, U[0], U[1], [[6, 4], [6, 4]])).toMatchObject({ ok: false });
    const future = await playedMatch(-48);
    expect(await lv.submitResult(future.id, U[0], U[1], [[6, 4], [6, 4]])).toMatchObject({ ok: false });
  });

  it("nivel inicial una sola vez y solo se puede bajar", async () => {
    const id = "bbbbbbbb-0000-4000-8000-0000000000aa";
    await db.from("profiles").upsert({ id, role: "customer", level: null });
    expect(await lv.setInitialLevel(id, [2, 2, 1, 1, 1])).toMatchObject({ ok: true, level: 2.9 });
    expect(await lv.setInitialLevel(id, [4, 4, 2, 3, 3])).toMatchObject({ ok: false });
    expect(await lv.lowerLevel(id, 3)).toMatchObject({ ok: false });
    expect(await lv.lowerLevel(id, 2.5)).toEqual({ ok: true });
  });
});
