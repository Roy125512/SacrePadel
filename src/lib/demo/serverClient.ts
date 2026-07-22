// Fake Supabase clients for server contexts (Server Components, Route Handlers,
// the admin client). Auth reads/writes the `demo_session` cookie via an adapter;
// `.from(...)` talks to the shared in-memory store.

import { getStore, makeFrom } from "./store";
import { DEMO_COOKIE, decodeSession, toAuthUser, toSession } from "./session";

export type CookieAdapter = {
  get(name: string): string | undefined;
  set?(name: string, value: string, options?: any): void;
  remove?(name: string): void;
};

export function makeServerClient(cookies: CookieAdapter) {
  const store = getStore();
  return {
    from: makeFrom(store),
    auth: {
      async getUser(token?: string) {
        const raw = token ?? cookies.get(DEMO_COOKIE);
        const u = decodeSession(raw);
        return {
          data: { user: u ? toAuthUser(u) : null },
          error: u ? null : { message: "Auth session missing!" },
        };
      },
      async getSession() {
        const u = decodeSession(cookies.get(DEMO_COOKIE));
        return { data: { session: u ? toSession(u) : null }, error: null };
      },
      async exchangeCodeForSession() {
        return { data: {}, error: null };
      },
      async verifyOtp() {
        return { data: {}, error: null };
      },
      async signOut() {
        try {
          cookies.remove?.(DEMO_COOKIE);
        } catch {}
        return { error: null };
      },
    },
  } as any;
}

export function makeAdminClient() {
  const store = getStore();
  return {
    from: makeFrom(store),
    auth: {
      // The admin client validates a Bearer token (see sync-profile route).
      async getUser(token?: string) {
        const u = decodeSession(token);
        return {
          data: { user: u ? toAuthUser(u) : null },
          error: u ? null : { message: "invalid token" },
        };
      },
    },
  } as any;
}
