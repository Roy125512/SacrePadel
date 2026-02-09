import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const { searchParams, origin } = url;

  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = (searchParams.get("type") || "").toLowerCase();

  // --- next robusto (decodifica si viene %2Fperfil) ---
  let next = searchParams.get("next") || "";
  if (next) {
    try {
      next = decodeURIComponent(next);
    } catch {}
  }

  // Defaults por tipo (esto es lo que te falta)
  if (!next) {
    if (type === "recovery") next = "/reset-password";
    else if (type === "signup") next = "/perfil";
    else next = "/reservar";
  }

  // Evita open-redirect: solo paths internos
  if (!next.startsWith("/")) {
    next = type === "signup" ? "/perfil" : "/";
  }

  const response = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // ✅ Prioriza code (PKCE)
  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
    return response;
  }

  // ✅ Si no hay code, usa token_hash (OTP)
  if (token_hash && type) {
    await supabase.auth.verifyOtp({
      type: type as any,
      token_hash,
    });
    return response;
  }

  // Si no llegó nada, manda a login
  return NextResponse.redirect(`${origin}/login?mode=login`);
}
