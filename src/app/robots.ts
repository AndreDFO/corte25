import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

// Google pode ler as páginas públicas; áreas de conta, admin e vídeos ficam de fora.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/conta", "/contatos", "/meus-videos", "/tarefa/", "/nova-senha", "/api/"],
    },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
