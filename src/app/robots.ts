import type { MetadataRoute } from "next";

import { SITE } from "@/lib/site";

const SITE_URL = SITE.url;

// Páginas privadas (recepción, perfil, cuentas) y la API fuera de buscadores.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/auth/", "/reception", "/perfil", "/login", "/forgot-password", "/reset-password"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
