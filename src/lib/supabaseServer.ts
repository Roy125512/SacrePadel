import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Supabase client para Server Components (App Router).
 * - En Server Components, escribir cookies puede lanzar error: por eso try/catch.
 * - Usamos get/set/remove para evitar diferencias entre versiones (getAll/setAll).
 */
export async function createClient() {
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
        try {
          // Next 15/16 soporta set({ ... }) y a veces set(name,value,opts)
          cookieStore.set?.({ name, value, ...options });
        } catch {
          // En Server Components puede estar bloqueado
        }
      },
      remove(name: string) {
        try {
          cookieStore.delete?.(name);
        } catch {
          // En Server Components puede estar bloqueado
        }
      },
    },
  });
}
