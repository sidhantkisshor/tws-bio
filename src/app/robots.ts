import type { MetadataRoute } from "next";

// Crawlers may read the public pages but not the signed-in or auth paths.
// There is no sitemap: tws.bio is a private short-link service and its short
// links are not meant to be listed.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/login", "/signup", "/auth", "/api"],
    },
  };
}
