import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { searchParams, origin } = url;

  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = (searchParams.get("type") || "").toLowerCase(); // recovery | signup | magiclink...
  let next = searchParams.get("next");

  // Si viene redirect_to, úsalo (solo si es mismo origin)
  if (!next) {
    const redirectTo = searchParams.get("redirect_to");
    if (redirectTo) {
      try {
        const u = new URL(redirectTo);
        if (u.origin === origin) next = `${u.pathname}${u.search}${u.hash}`;
      } catch {
        // ignore
      }
    }
  }

  // Defaults por tipo
  if (!next) {
    if (type === "recovery") next = "/reset-password";
    else if (type === "signup") next = "/perfil";
    else next = "/reservar";
  }

  // Prepara respuesta final (aquí vamos a pegar cookies)
  const response = NextResponse.redirect(`${origin}${next}`);

  // Crea el cliente solo si hay algo que intercambiar/verificar
  if (code || (token_hash && type)) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.headers.get("cookie")
              ? request.headers
                  .get("cookie")!
                  .split(";")
                  .map((c) => c.trim())
                  .filter(Boolean)
                  .map((c) => {
                    const idx = c.indexOf("=");
                    return {
                      name: decodeURIComponent(c.slice(0, idx)),
                      value: decodeURIComponent(c.slice(idx + 1)),
                    };
                  })
              : [];
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    // 1) Caso recovery/signup con token_hash
    if (token_hash && type) {
      await supabase.auth.verifyOtp({
        type: type as any, // "recovery", "signup", etc.
        token_hash,
      });
    }
    // 2) Caso PKCE con code
    else if (code) {
      await supabase.auth.exchangeCodeForSession(code);
    }
  }

  return response;
}
