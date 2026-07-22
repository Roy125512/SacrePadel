// Shared demo session helpers — used by both the browser and server fakes.
// A "session" is just a small JSON blob stored in the `demo_session` cookie
// (URL-encoded so it is cookie-safe and readable from JS on the client).

export type DemoRole = "owner" | "reception" | "customer";

export type DemoUser = {
  id: string;
  email: string;
  role: DemoRole;
  full_name: string | null;
  phone_e164: string | null;
  birth_date?: string | null;
  notes?: string | null;
  sex?: string | null;
  division?: string | null;
};

export const DEMO_COOKIE = "demo_session";

// Pre-seeded demo accounts. Any password (>= 8 chars, enforced by the login
// form) works. These two ids must match the rows seeded into the `profiles`
// table in store.ts so server-side role checks line up.
export const DEMO_USERS: DemoUser[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    email: "recepcion@demo.com",
    role: "owner",
    full_name: "Recepción Sacré",
    phone_e164: "+524521150001",
    birth_date: "1990-01-01",
    notes: null,
    sex: "M",
    division: null,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    email: "cliente@demo.com",
    role: "customer",
    full_name: "Cliente Demo",
    phone_e164: "+524521150002",
    birth_date: "1995-05-05",
    notes: null,
    sex: "F",
    division: "5ta",
  },
];

// Map a typed email to a demo user. Known demo accounts keep their role;
// any other email is treated as a regular customer.
export function resolveDemoUser(emailRaw: string): DemoUser {
  const email = (emailRaw || "").trim().toLowerCase();
  const found = DEMO_USERS.find((u) => u.email === email);
  if (found) return found;
  const id = "demo-" + (email.replace(/[^a-z0-9]/g, "-") || "guest");
  return {
    id,
    email,
    role: "customer",
    full_name: null,
    phone_e164: null,
    birth_date: null,
    notes: null,
    sex: null,
    division: null,
  };
}

export function encodeSession(user: DemoUser): string {
  return encodeURIComponent(JSON.stringify({ user }));
}

export function decodeSession(raw: string | undefined | null): DemoUser | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(decodeURIComponent(raw));
    return (obj && obj.user) || null;
  } catch {
    return null;
  }
}

// Shape that mimics a Supabase auth user / session closely enough for the app.
export function toAuthUser(u: DemoUser) {
  return {
    id: u.id,
    email: u.email,
    user_metadata: { full_name: u.full_name, name: u.full_name },
    app_metadata: { role: u.role },
    aud: "authenticated",
    role: "authenticated",
  };
}

export function toSession(u: DemoUser) {
  const token = encodeSession(u); // decodable by the admin fake's getUser(token)
  return {
    access_token: token,
    refresh_token: "demo-refresh",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: 9999999999,
    user: toAuthUser(u),
  };
}
