// Fake Supabase client for the browser. Implements the auth methods the app
// uses (session is a cookie) plus a tiny `.from("profiles")` backed by
// localStorage so the profile page can read/write without a server round-trip.

import {
  DEMO_COOKIE,
  decodeSession,
  encodeSession,
  resolveDemoUser,
  toAuthUser,
  toSession,
  type DemoUser,
} from "./session";

type Listener = (event: string, session: any) => void;

const g = globalThis as any;
if (!g.__demoBrowserListeners) g.__demoBrowserListeners = new Set<Listener>();
const listeners: Set<Listener> = g.__demoBrowserListeners;

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const escaped = name.replace(/[.$?*|{}()[\]\\/+^]/g, "\\$&");
  const m = document.cookie.match(new RegExp("(?:^|; )" + escaped + "=([^;]*)"));
  return m ? m[1] : undefined;
}
function writeCookie(name: string, value: string) {
  if (typeof document !== "undefined") {
    document.cookie = `${name}=${value}; path=/; max-age=86400; SameSite=Lax`;
  }
}
function clearCookie(name: string) {
  if (typeof document !== "undefined") {
    document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
  }
}

function currentUser(): DemoUser | null {
  return decodeSession(readCookie(DEMO_COOKIE));
}
function notify(event: string) {
  const u = currentUser();
  const session = u ? toSession(u) : null;
  listeners.forEach((cb) => {
    try {
      cb(event, session);
    } catch {}
  });
}

function readProfiles(): Record<string, any> {
  try {
    return JSON.parse(localStorage.getItem("demo_profiles") || "{}");
  } catch {
    return {};
  }
}
function writeProfiles(map: Record<string, any>) {
  try {
    localStorage.setItem("demo_profiles", JSON.stringify(map));
  } catch {}
}

function profileFor(userId: string): Row | null {
  const u = currentUser();
  const overlay = readProfiles()[userId];
  const fromSession =
    u && u.id === userId
      ? {
          id: u.id,
          role: u.role,
          full_name: u.full_name,
          phone_e164: u.phone_e164,
          birth_date: u.birth_date ?? null,
          notes: u.notes ?? null,
          sex: u.sex ?? null,
          division: u.division ?? null,
        }
      : null;
  if (!fromSession && !overlay) return null;
  return { ...(fromSession || { id: userId, role: "customer" }), ...(overlay || {}) };
}

type Row = Record<string, any>;

function browserFrom(table: string) {
  let idEq: string | null = null;
  let op: "select" | "upsert" = "select";
  let payload: any = null;

  async function run() {
    if (table !== "profiles") return { data: null, error: null };
    if (op === "upsert") {
      const map = readProfiles();
      const p = Array.isArray(payload) ? payload[0] : payload;
      if (p && p.id) map[p.id] = { ...(map[p.id] || {}), ...p };
      writeProfiles(map);
      return { data: null, error: null };
    }
    const data = idEq ? profileFor(idEq) : null;
    return { data, error: null };
  }

  const api: any = {
    select() {
      op = "select";
      return api;
    },
    upsert(p: any) {
      op = "upsert";
      payload = p;
      return api;
    },
    eq(col: string, val: any) {
      if (col === "id") idEq = val;
      return api;
    },
    maybeSingle() {
      return run();
    },
    async single() {
      const r = await run();
      if (!r.data) return { data: null, error: { message: "no rows" } };
      return r;
    },
    then(resolve: any, reject?: any) {
      return run().then(resolve, reject);
    },
  };
  return api;
}

function buildAuth() {
  return {
    async getSession() {
      const u = currentUser();
      return { data: { session: u ? toSession(u) : null }, error: null };
    },
    async getUser() {
      const u = currentUser();
      return {
        data: { user: u ? toAuthUser(u) : null },
        error: u ? null : { message: "Auth session missing!" },
      };
    },
    onAuthStateChange(cb: Listener) {
      listeners.add(cb);
      return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
    },
    async signInWithPassword({ email }: { email: string; password: string }) {
      const u = resolveDemoUser(email);
      writeCookie(DEMO_COOKIE, encodeSession(u));
      notify("SIGNED_IN");
      return { data: { user: toAuthUser(u), session: toSession(u) }, error: null };
    },
    async signUp({ email }: { email: string; password: string; options?: any }) {
      const u = resolveDemoUser(email);
      writeCookie(DEMO_COOKIE, encodeSession(u));
      notify("SIGNED_IN");
      return { data: { user: toAuthUser(u), session: toSession(u) }, error: null };
    },
    async resend() {
      return { data: {}, error: null };
    },
    async resetPasswordForEmail() {
      return { data: {}, error: null };
    },
    async updateUser() {
      const u = currentUser();
      return { data: { user: u ? toAuthUser(u) : null }, error: null };
    },
    async signOut() {
      clearCookie(DEMO_COOKIE);
      notify("SIGNED_OUT");
      return { error: null };
    },
  };
}

export function makeBrowserClient() {
  return { auth: buildAuth(), from: browserFrom } as any;
}
