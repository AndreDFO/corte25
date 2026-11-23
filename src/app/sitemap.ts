import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

// Páginas públicas que o Google deve mostrar.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/criadores`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE}/entrar`, changeFrequency: "monthly", priority: 0.3 },
  ];
}
