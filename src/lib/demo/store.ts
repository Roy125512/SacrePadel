// In-memory fake of the Supabase Postgres tables + a minimal PostgREST-like
// query builder. Used only when DEMO mode is on. State lives on globalThis so
// it survives across requests within the single dev-server process (it resets
// on a full server restart / module recompile — fine for a demo).

import { DEMO_USERS } from "./session";

type Row = Record<string, any>;
type TableName = "bookings" | "customers" | "profiles" | "courts" | "booking_events";
type Store = Record<TableName, Row[]>;

const g = globalThis as any;

function uuid(): string {
  try {
    if (g.crypto && typeof g.crypto.randomUUID === "function") return g.crypto.randomUUID();
  } catch {}
  // Fallback (only hit if crypto is unavailable).
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function nowIso() {
  return new Date().toISOString();
}
function todayYMD() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function isoAt(ymd: string, hh: number, mm: number) {
  return `${ymd}T${pad2(hh)}:${pad2(mm)}:00-06:00`;
}

function seed(): Store {
  const courts: Row[] = [
    { id: "court-1", name: "Cancha 1", is_active: true, created_at: nowIso() },
    { id: "court-2", name: "Cancha 2", is_active: true, created_at: nowIso() },
  ];

  const profiles: Row[] = DEMO_USERS.map((u) => ({
    id: u.id,
    role: u.role,
    full_name: u.full_name,
    phone_e164: u.phone_e164,
    birth_date: u.birth_date ?? null,
    notes: u.notes ?? null,
    sex: u.sex ?? null,
    division: u.division ?? null,
    updated_at: nowIso(),
  }));

  const customers: Row[] = [
    {
      id: uuid(),
      full_name: "Juan Pérez",
      phone_e164: "+524521110001",
      email: null,
      notes: null,
      birthday: null,
      player_notes: null,
      sex: "M",
      division: "4ta",
      is_active: true,
      created_at: nowIso(),
    },
    {
      id: uuid(),
      full_name: "María López",
      phone_e164: "+524521110002",
      email: null,
      notes: null,
      birthday: null,
      player_notes: null,
      sex: "F",
      division: "5ta",
      is_active: true,
      created_at: nowIso(),
    },
  ];

  const ymd = todayYMD();
  const bookings: Row[] = [
    {
      id: uuid(),
      court_id: "court-1",
      start_at: isoAt(ymd, 9, 0),
      end_at: isoAt(ymd, 10, 30),
      status: "CONFIRMED",
      source: "WEB",
      kind: "STANDARD",
      payment_status: "UNPAID",
      paid_amount: null,
      payment_method: null,
      paid_at: null,
      customer_id: customers[0].id,
      user_id: null,
      hold_expires_at: null,
      cancelled_by: null,
      stripe_payment_intent_id: null,
      created_at: nowIso(),
    },
    {
      id: uuid(),
      court_id: "court-2",
      start_at: isoAt(ymd, 18, 0),
      end_at: isoAt(ymd, 19, 0),
      status: "CONFIRMED",
      source: "RECEPTION",
      kind: "STANDARD",
      payment_status: "PAID",
      paid_amount: 400,
      payment_method: "CASH",
      paid_at: nowIso(),
      customer_id: customers[1].id,
      user_id: null,
      hold_expires_at: null,
      cancelled_by: null,
      stripe_payment_intent_id: null,
      created_at: nowIso(),
    },
  ];

  return { bookings, customers, profiles, courts, booking_events: [] };
}

export function getStore(): Store {
  if (!g.__demoStore) g.__demoStore = seed();
  return g.__demoStore as Store;
}

// ---- relationship registry for embedded selects (PostgREST `rel ( cols )`) ----
const RELATIONS: Record<string, Record<string, { table: TableName; localKey: string }>> = {
  bookings: {
    courts: { table: "courts", localKey: "court_id" },
    customers: { table: "customers", localKey: "customer_id" },
  },
};

function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) out.push(cur);
  return out;
}

type ParsedSelect = {
  columns: string[]; // [] or ["*"] means "all"
  embeds: { key: string; name: string; cols: string }[];
};

function parseSelect(sel: string): ParsedSelect {
  const columns: string[] = [];
  const embeds: { key: string; name: string; cols: string }[] = [];
  if (!sel || sel.trim() === "*") return { columns: ["*"], embeds };
  for (const tokRaw of splitTopLevel(sel)) {
    const t = tokRaw.trim();
    if (!t) continue;
    const p = t.indexOf("(");
    if (p >= 0) {
      const head = t.slice(0, p).trim(); // "customers:customer_id" | "courts"
      const inner = t.slice(p + 1, t.lastIndexOf(")")).trim();
      const alias = head.includes(":") ? head.split(":")[0].trim() : head;
      embeds.push({ key: alias, name: alias, cols: inner });
    } else {
      columns.push(t);
    }
  }
  return { columns, embeds };
}

function project(row: Row, cols: string): Row {
  const parsed = parseSelect(cols);
  if (parsed.columns.includes("*") || parsed.columns.length === 0) return { ...row };
  const out: Row = {};
  for (const c of parsed.columns) out[c] = row[c] ?? null;
  return out;
}

function attachEmbeds(table: string, row: Row, embeds: ParsedSelect["embeds"], store: Store): Row {
  const out: Row = { ...row };
  for (const e of embeds) {
    const rel = RELATIONS[table]?.[e.name];
    if (!rel) {
      out[e.key] = null;
      continue;
    }
    const target = store[rel.table].find((r) => r.id === row[rel.localKey]);
    out[e.key] = target ? project(target, e.cols) : null;
  }
  return out;
}

function cmp(a: any, b: any): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  const da = typeof a === "string" ? Date.parse(a) : NaN;
  const db = typeof b === "string" ? Date.parse(b) : NaN;
  if (!Number.isNaN(da) && !Number.isNaN(db)) return da === db ? 0 : da < db ? -1 : 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

// Emulates Postgres ILIKE: % -> any run of chars, _ -> any single char, case-insensitive.
function ilikeMatch(cell: any, pattern: string): boolean {
  if (cell == null) return false;
  const escaped = String(pattern)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/%/g, ".*")
    .replace(/_/g, ".");
  return new RegExp(`^${escaped}$`, "i").test(String(cell));
}

function clauseMatch(row: Row, clause: string): boolean {
  const c = clause.trim();
  if (c.startsWith("and(")) {
    const inner = c.slice(4, c.lastIndexOf(")"));
    return splitTopLevel(inner).every((p) => clauseMatch(row, p));
  }
  if (c.startsWith("or(")) {
    const inner = c.slice(3, c.lastIndexOf(")"));
    return splitTopLevel(inner).some((p) => clauseMatch(row, p));
  }
  const dot = c.split(".");
  const col = dot[0];
  const op = dot[1];
  const val = dot.slice(2).join(".");
  const cell = row[col];
  switch (op) {
    case "eq":
      return String(cell) === val;
    case "neq":
      return String(cell) !== val;
    case "gt":
      return cmp(cell, val) > 0;
    case "gte":
      return cmp(cell, val) >= 0;
    case "lt":
      return cmp(cell, val) < 0;
    case "lte":
      return cmp(cell, val) <= 0;
    case "is":
      return val === "null" ? cell == null : String(cell) === val;
    case "ilike":
      return ilikeMatch(cell, val);
    default:
      return true;
  }
}

type Filter =
  | { t: "eq" | "neq"; c: string; v: any }
  | { t: "in"; c: string; v: any[] }
  | { t: "is"; c: string; v: any }
  | { t: "not"; c: string; op: string; v: any }
  | { t: "gt" | "gte" | "lt" | "lte"; c: string; v: any }
  | { t: "ilike"; c: string; v: string }
  | { t: "or"; raw: string };

const ACTIVE_STATUSES = ["HOLD", "CONFIRMED", "COMPLETED", "NO_SHOW"];

class FakeQuery {
  private store: Store;
  private table: TableName;
  private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private selectStr = "*";
  private selectOpts: { count?: string; head?: boolean } = {};
  private payload: any = null;
  private onConflict = "id";
  private filters: Filter[] = [];
  private orderSpec: { c: string; asc: boolean } | null = null;
  private limitN: number | null = null;
  private rangeSpec: [number, number] | null = null;
  private rowMode: "many" | "single" | "maybe" = "many";
  private _promise: Promise<any> | null = null;

  constructor(store: Store, table: TableName) {
    this.store = store;
    this.table = table;
  }

  select(str?: string, opts?: { count?: string; head?: boolean }) {
    this.selectStr = str && str.trim() ? str : "*";
    if (opts) this.selectOpts = opts;
    return this;
  }
  insert(payload: any) {
    this.op = "insert";
    this.payload = payload;
    return this;
  }
  update(payload: any) {
    this.op = "update";
    this.payload = payload;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  upsert(payload: any, opts?: { onConflict?: string }) {
    this.op = "upsert";
    this.payload = payload;
    if (opts?.onConflict) this.onConflict = opts.onConflict;
    return this;
  }
  eq(c: string, v: any) {
    this.filters.push({ t: "eq", c, v });
    return this;
  }
  neq(c: string, v: any) {
    this.filters.push({ t: "neq", c, v });
    return this;
  }
  in(c: string, v: any[]) {
    this.filters.push({ t: "in", c, v });
    return this;
  }
  is(c: string, v: any) {
    this.filters.push({ t: "is", c, v });
    return this;
  }
  not(c: string, op: string, v: any) {
    this.filters.push({ t: "not", c, op, v });
    return this;
  }
  gt(c: string, v: any) {
    this.filters.push({ t: "gt", c, v });
    return this;
  }
  gte(c: string, v: any) {
    this.filters.push({ t: "gte", c, v });
    return this;
  }
  lt(c: string, v: any) {
    this.filters.push({ t: "lt", c, v });
    return this;
  }
  lte(c: string, v: any) {
    this.filters.push({ t: "lte", c, v });
    return this;
  }
  ilike(c: string, v: string) {
    this.filters.push({ t: "ilike", c, v });
    return this;
  }
  or(raw: string) {
    this.filters.push({ t: "or", raw });
    return this;
  }
  order(c: string, opts?: { ascending?: boolean }) {
    this.orderSpec = { c, asc: opts?.ascending !== false };
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  range(a: number, b: number) {
    this.rangeSpec = [a, b];
    return this;
  }
  single() {
    this.rowMode = "single";
    return this;
  }
  maybeSingle() {
    this.rowMode = "maybe";
    return this;
  }

  // Make the builder awaitable like the real supabase-js query builder.
  then(resolve: any, reject?: any) {
    return this.run().then(resolve, reject);
  }
  catch(reject: any) {
    return this.run().catch(reject);
  }
  finally(cb: any) {
    return this.run().finally(cb);
  }

  private match1(row: Row, f: Filter): boolean {
    switch (f.t) {
      case "eq":
        return row[f.c] === f.v || String(row[f.c]) === String(f.v);
      case "neq":
        return !(row[f.c] === f.v || String(row[f.c]) === String(f.v));
      case "in":
        return Array.isArray(f.v) && f.v.some((x) => row[f.c] === x || String(row[f.c]) === String(x));
      case "is":
        return f.v === null ? row[f.c] == null : row[f.c] === f.v;
      case "not":
        if (f.op === "is") return f.v === null ? row[f.c] != null : row[f.c] !== f.v;
        return true;
      case "gt":
        return cmp(row[f.c], f.v) > 0;
      case "gte":
        return cmp(row[f.c], f.v) >= 0;
      case "lt":
        return cmp(row[f.c], f.v) < 0;
      case "lte":
        return cmp(row[f.c], f.v) <= 0;
      case "ilike":
        return ilikeMatch(row[f.c], f.v);
      case "or":
        return splitTopLevel(f.raw).some((c) => clauseMatch(row, c));
      default:
        return true;
    }
  }

  private matches(row: Row): boolean {
    return this.filters.every((f) => this.match1(row, f));
  }

  private newRow(item: Row): Row {
    const base: Row = { ...item };
    if (base.id === undefined) base.id = uuid();
    if (base.created_at === undefined) base.created_at = nowIso();
    if (this.table === "bookings") {
      return {
        court_id: null,
        start_at: null,
        end_at: null,
        status: "HOLD",
        source: "WEB",
        kind: "STANDARD",
        payment_status: "UNPAID",
        paid_amount: null,
        payment_method: null,
        paid_at: null,
        customer_id: null,
        user_id: null,
        hold_expires_at: null,
        cancelled_by: null,
        stripe_payment_intent_id: null,
        ...base,
      };
    }
    if (this.table === "customers") {
      return {
        full_name: null,
        phone_e164: null,
        email: null,
        notes: null,
        birthday: null,
        player_notes: null,
        sex: null,
        division: null,
        is_active: true,
        ...base,
      };
    }
    return base;
  }

  // Mimic the `bookings_no_overlap` exclusion constraint so double-booking
  // fails the same way it would in production.
  private overlapError(row: Row): string | null {
    if (this.table !== "bookings") return null;
    if (!row.start_at || !row.end_at) return null;
    if (!ACTIVE_STATUSES.includes(row.status)) return null;
    const now = Date.now();
    const s = Date.parse(row.start_at);
    const e = Date.parse(row.end_at);
    for (const b of this.store.bookings) {
      if (b === row) continue;
      if (b.court_id !== row.court_id) continue;
      if (!ACTIVE_STATUSES.includes(b.status)) continue;
      if (b.status === "HOLD" && b.hold_expires_at && Date.parse(b.hold_expires_at) <= now) continue;
      const bs = Date.parse(b.start_at);
      const be = Date.parse(b.end_at);
      if (s < be && e > bs) return "bookings_no_overlap";
    }
    return null;
  }

  private shape(rows: Row[]) {
    const { embeds } = parseSelect(this.selectStr);
    const data = rows.map((r) => (embeds.length ? attachEmbeds(this.table, r, embeds, this.store) : { ...r }));
    const count = this.selectOpts?.count ? data.length : null;
    if (this.rowMode === "single") {
      if (data.length === 0) {
        return {
          data: null,
          error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" },
          count,
        };
      }
      return { data: data[0], error: null, count };
    }
    if (this.rowMode === "maybe") {
      return { data: data[0] ?? null, error: null, count };
    }
    return { data, error: null, count };
  }

  private async run(): Promise<any> {
    if (this._promise) return this._promise;
    this._promise = (async () => {
      try {
        const list = this.store[this.table];

        if (this.op === "insert" || this.op === "upsert") {
          const items = Array.isArray(this.payload) ? this.payload : [this.payload];
          const result: Row[] = [];
          for (const item of items) {
            if (this.op === "upsert") {
              const key = this.onConflict || "id";
              const idx = list.findIndex((r) => r[key] === item[key]);
              if (idx >= 0) {
                list[idx] = { ...list[idx], ...item };
                result.push(list[idx]);
                continue;
              }
            }
            const row = this.newRow(item);
            const ovl = this.overlapError(row);
            if (ovl) return { data: null, error: { message: ovl }, count: null };
            list.push(row);
            result.push(row);
          }
          return this.shape(result);
        }

        let matched = list.filter((r) => this.matches(r));

        if (this.op === "update") {
          for (const r of matched) Object.assign(r, this.payload);
        } else if (this.op === "delete") {
          for (const r of matched) {
            const i = list.indexOf(r);
            if (i >= 0) list.splice(i, 1);
          }
        }

        if (this.selectOpts?.head) {
          return { data: null, error: null, count: matched.length };
        }

        if (this.orderSpec) {
          const { c, asc } = this.orderSpec;
          matched = [...matched].sort((a, b) => cmp(a[c], b[c]) * (asc ? 1 : -1));
        }
        if (this.rangeSpec) {
          matched = matched.slice(this.rangeSpec[0], this.rangeSpec[1] + 1);
        } else if (this.limitN != null) {
          matched = matched.slice(0, this.limitN);
        }

        return this.shape(matched);
      } catch (e: any) {
        return { data: null, error: { message: e?.message ?? "demo store error" }, count: null };
      }
    })();
    return this._promise;
  }
}

export function makeFrom(store: Store) {
  return (table: TableName) => new FakeQuery(store, table);
}
