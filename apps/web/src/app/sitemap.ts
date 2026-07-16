import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://sabiscore.com");

// ponytail: static public-route list; generate per-fixture entries only if
// organic search of match pages ever becomes a goal.
const PUBLIC_ROUTES = ["/", "/intelligence", "/match", "/performance", "/docs"];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_ROUTES.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency: path === "/" ? "daily" : "hourly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
