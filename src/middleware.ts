import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { DEMO } from "@/lib/demo/flag";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  // Demo mode: no real Supabase to refresh against — just pass through.
  if (DEMO) {
    return res;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Actualiza el request y la response
        cookiesToSet.forEach(({ name, value, options }) => {
          req.cookies.set(name, value);
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  // Refresca sesión (importante para SSR/middleware)
  await supabase.auth.getUser();

  return res;
}

// Ajusta tu matcher como lo tenías (esto es un ejemplo común)
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
