import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { DEMO } from "@/lib/demo/flag";

// Origen real de Supabase (REST/Auth vía fetch desde el navegador — ver
// src/lib/supabaseBrowser.ts) para connect-src. Si el env var no trae una
// URL válida (no debería pasar), cae a un comodín *.supabase.co en vez de
// tumbar todas las llamadas al backend.
function supabaseOrigin(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin;
  } catch {
    return "https://*.supabase.co";
  }
}

// CSP estricta basada en nonce (patrón oficial de Next.js para App Router:
// https://nextjs.org/docs/app/guides/content-security-policy). El nonce va
// en el header de request Y de response — Next.js detecta el nonce en el
// CSP del response y lo aplica solo a los <script> inline que él mismo
// genera (RSC/hydration payload), así que no hay que tocar layout.tsx.
// style-src necesita 'unsafe-inline' porque toda la UI usa style={{...}}
// (se renderiza como atributo style="" en el HTML, que CSP style-src SÍ
// regula) — quitarlo rompería el diseño completo. Es un trade-off
// consciente: sigue bloqueando la inyección de <script>, que es el vector
// más peligroso (robo de sesión/credenciales), aunque no un <style> suelto.
function buildCsp(nonce: string) {
  const isDev = process.env.NODE_ENV !== "production";
  const scriptSrc = isDev
    ? `'self' 'nonce-${nonce}' 'unsafe-eval'` // 'unsafe-eval' solo en dev: lo necesita Fast Refresh/HMR
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;

  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self' ${supabaseOrigin()}`,
    // Único iframe del sitio: el mapa embebido en LocationSection.tsx.
    `frame-src https://maps.google.com https://www.google.com`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ");
}

export async function middleware(req: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  // El nonce se reenvía también como request header para que, si algún día
  // se agrega un <script>/<Script> propio, pueda leerse con
  // (await headers()).get("x-nonce") y pasarse como prop nonce.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const res = NextResponse.next({
    request: { headers: requestHeaders },
  });
  res.headers.set("Content-Security-Policy", csp);

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
