import type { MetadataRoute } from "next";
import { BRAND } from "@/config/brand";

// Every indexable page. The workspace (/app) and the owner tool (/deploy) stay out.
export const ROUTES = [
  "",
  "/ai-review",
  "/dca-bots",
  "/copy-trading",
  "/features",
  "/pricing",
  "/token",
  "/contracts",
  "/about",
  "/contact",
  "/faq",
  "/help",
  "/connect-guide",
  "/changelog",
  "/privacy",
  "/terms",
  "/risk",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ROUTES.map((r) => ({ url: `${BRAND.url}${r}`, lastModified: now, changeFrequency: r === "" ? "daily" : "weekly", priority: r === "" ? 1 : 0.6 }));
}
