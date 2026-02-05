import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const type = (searchParams.get("type") || "").toLowerCase(); // recovery | signup | magiclink...
  let next = searchParams.get("next");

  // Si Supabase manda redirect_to, respétalo (solo si es del mismo origen)
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

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
