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

// CSP. El patrón oficial de Next.js con nonce + 'strict-dynamic'
// (https://nextjs.org/docs/app/guides/content-security-policy) requiere que
// el HTML se genere en cada request, porque el nonce va embebido tanto en
// el header como en los <script> del propio HTML y ambos deben coincidir.
// Este sitio sirve páginas estáticas cacheadas (ISR/full route cache) para
// el marketing (/inicio, etc.) — ese HTML se genera una sola vez y se
// reutiliza en cada visita, mientras el nonce del header cambiaría en cada
// request. Un nonce que nunca coincide con 'strict-dynamic' bloquea TODO el
// JS del sitio en esas páginas (se probó y rompía la hidratación/animaciones
// en producción). Por eso usamos 'self' 'unsafe-inline' en vez de nonce:
// sigue bloqueando la carga de <script src> de dominios externos/atacantes
// (el vector más común), aunque no protege contra un <script> inline
// inyectado. Ese riesgo se cubre en la capa de entrada: no hay
// dangerouslySetInnerHTML en el código, así que React escapa todo output
// por default. style-src necesita el mismo 'unsafe-inline' porque toda la
// UI usa style={{...}} (se renderiza como atributo style="" en el HTML,
// que CSP style-src regula) — quitarlo rompería el diseño completo.
function buildCsp() {
  const isDev = process.env.NODE_ENV !== "production";
  const scriptSrc = isDev
    ? `'self' 'unsafe-inline' 'unsafe-eval'` // 'unsafe-eval' solo en dev: lo necesita Fast Refresh/HMR
    : `'self' 'unsafe-inline'`;

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
  const csp = buildCsp();

  const requestHeaders = new Headers(req.headers);
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
