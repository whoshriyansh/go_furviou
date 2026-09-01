import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/privacy", "/terms", "/contact", "/login", "/register"];
  return pages.map((path) => ({
    url: `${SITE.url}${path}`,
    lastModified: new Date("2026-09-01"),
  }));
}
