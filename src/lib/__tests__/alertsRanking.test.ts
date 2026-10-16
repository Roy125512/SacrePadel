import { beforeAll, describe, expect, it, vi } from "vitest";

// Base de datos en memoria del modo demo; el correo no sale a la red.
vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
vi.stubEnv("SMTP_HOST", "");
vi.stubEnv("NOTIFY_EMAIL", "");

let alerts: typeof import("@/lib/alerts");
let ranking: typeof import("@/lib/ranking");
let cancelBooking: typeof import("@/lib/cancellation").cancelBooking;
let db: any;
beforeAll(async () => {
  alerts = await import("@/lib/alerts");
  ranking = await import("@/lib/ranking");
  ({ cancelBooking } = await import("@/lib/cancellation"));
  ({ supabaseAdmin: db } = await import("@/lib/supabaseAdmin"));
});

const H = 3600_000;
const pending = async (email: string) =>
  (await db.from("slot_alerts").select("id, notified_at").eq("email", email)).data.filter((a: any) => !a.notified_at).length;

describe("avísame si se libera", () => {
  it("no duplica y avisa solo a quien esperaba esa hora", async () => {
    const at = new Date(Date.now() + 72 * H);
    at.setUTCMinutes(0, 0, 0);
    const start = at.toISOString();
    expect(await alerts.createAlert({ kind: "SLOT", email: "Ana@x.com", userId: null, startAt: start })).toEqual({ ok: true });
    expect(await alerts.createAlert({ kind: "SLOT", email: "ana@x.com", userId: null, startAt: start })).toEqual({ ok: true });
    expect(await pending("ana@x.com")).toBe(1);
    const later = new Date(at.getTime() + 3 * H).toISOString();
    await alerts.createAlert({ kind: "SLOT", email: "beto@x.com", userId: null, startAt: later });
    expect(await alerts.createAlert({ kind: "SLOT", email: "c@x.com", userId: null, startAt: new Date(Date.now() - H).toISOString() })).toMatchObject({ ok: false });

    // Alguien cancela su reserva de esa hora → avisa a Ana, no a Beto.
    const { data: b } = await db
      .from("bookings")
      .insert({ court_id: "court-alert-test", start_at: start, end_at: new Date(at.getTime() + H).toISOString(), status: "CONFIRMED", source: "WEB", payment_status: "UNPAID" })
      .select("id")
      .single();
    expect(await cancelBooking(b.id, "CUSTOMER")).toMatchObject({ ok: true });
    expect(await pending("ana@x.com")).toBe(0);
    expect(await pending("beto@x.com")).toBe(1);
  });

  it("lugar en partido o torneo: avisa una vez", async () => {
    const ref = "eeeeeeee-0000-4000-8000-000000000001";
    await alerts.createAlert({ kind: "EVENT", email: "d@x.com", userId: null, refId: ref });
    await alerts.notifySpotOpened("EVENT", ref, "Americana", "https://x");
    expect(await pending("d@x.com")).toBe(0);
  });
});

describe("ranking", () => {
  it("solo quien tiene partidos confirmados y quiere aparecer; nombre corto", async () => {
    const mk = (id: string, full_name: string, level: number, extra: Record<string, unknown> = {}) =>
      db.from("profiles").upsert({ id, role: "customer", full_name, level, level_matches: 2, level_reliability: 20, sex: "F", ...extra });
    await mk("ffffffff-0000-4000-8000-000000000001", "Ana María Torres", 4.2);
    await mk("ffffffff-0000-4000-8000-000000000002", "Oculta Pérez", 5.0, { ranking_visible: false });
    await mk("ffffffff-0000-4000-8000-000000000003", "Sin Partidos", 6.0, { level_matches: 0 });
    await mk("ffffffff-0000-4000-8000-000000000004", "Bea Luna", 2.5);
    const rows = (await ranking.clubRanking({ gender: "F" })).filter((r) => r.id.startsWith("ffffffff"));
    expect(rows.map((r) => r.name)).toEqual(["Ana T.", "Bea L."]);
    expect(rows[0]).toMatchObject({ division: "3ra", level: 4.2 });
    const third = (await ranking.clubRanking({ division: "3ra" })).filter((r) => r.id.startsWith("ffffffff"));
    expect(third.map((r) => r.name)).toEqual(["Ana T."]);
    expect(ranking.publicName("Roy")).toBe("Roy");
  });
});
