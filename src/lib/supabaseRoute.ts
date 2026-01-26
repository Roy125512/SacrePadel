import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Supabase client para Route Handlers (src/app/api/**).
 * Aquí sí es válido set/remove cookies cuando Supabase refresca tokens.
 */
export async function createRouteClient() {
  const cookieStore: any = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local"
    );
  }

  return createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get?.(name)?.value;
      },
      set(name: string, value: string, options: any) {
        cookieStore.set?.({ name, value, ...options });
      },
      remove(name: string) {
        cookieStore.delete?.(name);
      },
    },
  });
}
