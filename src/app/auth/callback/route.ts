import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const { searchParams, origin } = url;

  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = (searchParams.get("type") || "").toLowerCase();
  const next =
    searchParams.get("next") || (type === "recovery" ? "/reset-password" : "/");

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

  // ✅ 1) Prioriza PKCE code
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        `${origin}/forgot-password?error=${encodeURIComponent(error.message)}`
      );
    }
    return response;
  }

  // ✅ 2) Si no hay code, usa token_hash (OTP link)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash,
    });
    if (error) {
      return NextResponse.redirect(
        `${origin}/forgot-password?error=${encodeURIComponent(error.message)}`
      );
    }
    return response;
  }

  // Si no llegó nada útil, manda a forgot-password
  return NextResponse.redirect(`${origin}/forgot-password?error=missing_params`);
}
