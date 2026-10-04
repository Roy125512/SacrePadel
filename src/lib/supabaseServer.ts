import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { DEMO } from "@/lib/demo/flag";
import { makeServerClient } from "@/lib/demo/serverClient";

/**
 * Supabase client para Server Components y Route Handlers (App Router).
 * En Server Components no se pueden escribir cookies (Next lanza error):
 * por eso el try/catch — ahí el refresco de sesión lo hace src/proxy.ts.
 */
export async function createClient() {
  const cookieStore = await cookies();

  if (DEMO) {
    return makeServerClient({
      get: (name: string) => cookieStore.get(name)?.value,
      set: (name: string, value: string, options?: Record<string, unknown>) => {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {}
      },
      remove: (name: string) => {
        try {
          cookieStore.delete(name);
        } catch {}
      },
    });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local");
  }

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // En Server Components está bloqueado escribir cookies.
        }
      },
    },
  });
}
