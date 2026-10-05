import type { MetadataRoute } from "next";

import { SITE } from "@/lib/site";

const SITE_URL = SITE.url;

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/inicio`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/reservar`, changeFrequency: "daily", priority: 0.9 },
  ];
}
