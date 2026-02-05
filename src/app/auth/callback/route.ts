import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = url.origin;
  const searchParams = url.searchParams;

  const code = searchParams.get("code");
  const type = (searchParams.get("type") || "").toLowerCase();
  let next = searchParams.get("next");

  // Si Supabase manda redirect_to, respétalo (solo si es del mismo origen)
  if (!next) {
    const redirectTo = searchParams.get("redirect_to");
    if (redirectTo) {
      try {
        const u = new URL(redirectTo);
        if (u.origin === origin) next = `${u.pathname}${u.search}${u.hash}`;
      } catch {}
    }
  }

  // Defaults por tipo
  if (!next) {
    if (type === "recovery") next = "/reset-password";
    else if (type === "signup") next = "/perfil";
    else next = "/reservar";
  }

  // Creamos response desde el inicio (para poder setear cookies)
  const response = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          response.cookies.set({ name, value: "", ...options, maxAge: 0 });
        },
      },
    }
  );

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  return response;
}
