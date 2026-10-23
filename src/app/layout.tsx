import type { Metadata, Viewport } from "next";
import { jetbrainsMono, newsreader, satoshi } from "./fonts";
import { ThemeScript } from "@/components/theme/ThemeScript";
import { familyJsonLdGraph } from "@/lib/family";
import "./globals.css";

// The <Toaster /> sits with the surfaces that toast (home, /login, the
// dashboard layout), so pages that never toast skip sonner. This layout reads
// no cookies or headers, so the public pages stay static.

// One graph for the whole site, shared with the other Trading With Sidhant
// sites through the parent Organization and founder @ids. "\\u003c" is escaped so
// the JSON cannot close its own script tag.
const jsonLd = JSON.stringify(
  familyJsonLdGraph({ url: "https://tws.bio", name: "tws.bio" }),
).replace(/</g, "\\u003c");

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://tws.bio"),
  // Each page sets its own title ("Links", "Sign in"); the template adds the
  // site name. A page with no title gets plain "tws.bio".
  title: { default: "tws.bio", template: "%s - tws.bio" },
  description: "The private link tool of Trading with Sidhant.",
  openGraph: {
    title: "tws.bio: members only",
    description: "The private link tool of Trading with Sidhant.",
    siteName: "tws.bio",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "tws.bio: members only",
    description: "The private link tool of Trading with Sidhant.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F3F0EA" },
    { media: "(prefers-color-scheme: dark)", color: "#131819" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // ThemeScript writes data-theme and color-scheme before React hydrates,
    // so those two attributes differ from the server HTML on purpose.
    <html
      lang="en-IN"
      suppressHydrationWarning
      className={`${satoshi.variable} ${newsreader.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="font-sans antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd }}
        />
        {children}
      </body>
    </html>
  );
}
