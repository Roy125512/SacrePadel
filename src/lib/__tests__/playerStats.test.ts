import { beforeAll, describe, expect, it, vi } from "vitest";

// Base de datos en memoria del modo demo.
vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
vi.stubEnv("SMTP_HOST", "");
vi.stubEnv("NOTIFY_EMAIL", "");

let playerStats: typeof import("@/lib/playerStats").playerStats;
let db: any;
beforeAll(async () => {
  ({ playerStats } = await import("@/lib/playerStats"));
  ({ supabaseAdmin: db } = await import("@/lib/supabaseAdmin"));
});

const ME = "cccccccc-0000-4000-8000-000000000001";
const ANA = "cccccccc-0000-4000-8000-000000000002";
const H = 3600_000;

async function booking(startIso: string, hours: number, extra: Record<string, unknown> = {}) {
  const start = new Date(startIso);
  const { data } = await db
    .from("bookings")
    .insert({
      court_id: "court-stats",
      start_at: start.toISOString(),
      end_at: new Date(start.getTime() + hours * H).toISOString(),
      status: "COMPLETED",
      source: "WEB",
      payment_status: "PAID",
      courts: undefined,
      ...extra,
    })
    .select("*")
    .single();
  return data;
}

describe("estadísticas del jugador", () => {
  it("cuenta lo que reservó, a lo que se unió y sus resultados", async () => {
    await db.from("profiles").upsert({ id: ANA, role: "customer", full_name: "Ana Torres" });
    const now = Date.parse("2026-10-15T20:00:00Z");
    // Reservó una de 1.5 h (19:00 club) y se unió a otra de 1 h.
    await booking("2026-10-10T01:00:00Z", 1.5, { user_id: ME });
    const joined = await booking("2026-09-20T01:00:00Z", 1, { user_id: "someone-else", is_open_match: true });
    for (const [i, uid] of [ME, ANA, "x1", "x2"].entries()) {
      await db.from("booking_shares").insert({ booking_id: joined.id, seq: i + 1, amount: 100, status: "PAID", user_id: uid });
    }
    // Cancelada y futura: no cuentan.
    await booking("2026-10-12T01:00:00Z", 1, { user_id: ME, status: "CANCELLED" });
    await booking("2026-10-20T01:00:00Z", 1, { user_id: ME, status: "CONFIRMED" });
    await db.from("match_results").insert({
      booking_id: joined.id,
      team_a: [ME, ANA],
      team_b: ["x1", "x2"],
      sets: [[6, 3], [6, 4]],
      status: "CONFIRMED",
      submitted_by: ME,
      reviewed_at: "2026-09-20T03:00:00Z",
      level_changes: { [ME]: { before: 3, after: 3.12 } },
    });

    const s = await playerStats(ME, now);
    expect(s.played).toBe(2);
    expect(s.hours).toBe(2.5);
    expect(s.results).toEqual({ wins: 1, losses: 0, ties: 0 });
    expect(s.favoriteHour).toBe("19:00");
    expect(s.partners).toEqual([{ name: "Ana", count: 1 }]);
    expect(s.levelSeries.map((p) => p.level)).toEqual([3, 3.12]);
    expect(s.monthly).toHaveLength(6);
    expect(s.monthly.find((m) => m.month === "2026-10")?.count).toBe(1);
    expect(s.monthly.find((m) => m.month === "2026-09")?.count).toBe(1);
    expect(s.recent[0].outcome).toBeNull();
    expect(s.recent[1]).toMatchObject({ outcome: "W", sets: [[6, 3], [6, 4]] });
  });

  it("sin partidos: todo en cero", async () => {
    const s = await playerStats("cccccccc-0000-4000-8000-0000000000ff");
    expect(s).toMatchObject({ played: 0, hours: 0, partners: [], levelSeries: [] });
  });
});
