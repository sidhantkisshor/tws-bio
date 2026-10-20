import type { Metadata, Viewport } from "next";
import { jetbrainsMono, newsreader, satoshi } from "./fonts";
import { ThemeScript } from "@/components/theme/ThemeScript";
import "./globals.css";

// The <Toaster /> sits with the surfaces that toast (home, /login, the
// dashboard layout), so pages that never toast skip sonner. This layout reads
// no cookies or headers, so the public pages stay static.

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: "tws.bio - URL Shortener",
  description: "Shorten your URLs with tws.bio, by Trading with Sidhant",
  openGraph: {
    title: "tws.bio: Short links, big impact",
    description:
      "Create short links with analytics and mobile deep linking, by Trading with Sidhant.",
    siteName: "tws.bio",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "tws.bio: Short links, big impact",
    description:
      "Create short links with analytics and mobile deep linking, by Trading with Sidhant.",
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
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
