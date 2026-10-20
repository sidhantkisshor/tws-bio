import type { Metadata, Viewport } from "next";
import { jetbrainsMono, newsreader, satoshi } from "./fonts";
import { ThemeScript } from "@/components/theme/ThemeScript";
import "./globals.css";

// The <Toaster /> sits with the surfaces that toast (home, /login, the
// dashboard layout), so pages that never toast skip sonner. This layout reads
// no cookies or headers, so the public pages stay static.

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  // Each page sets its own title ("Links", "Sign in"); the template adds the
  // site name. A page with no title gets plain "tws.bio".
  title: { default: "tws.bio", template: "%s - tws.bio" },
  description: "The private link tool of Trading with Sidhant.",
  openGraph: {
    title: "tws.bio: the link desk for Trading with Sidhant",
    description: "The private link tool of Trading with Sidhant.",
    siteName: "tws.bio",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "tws.bio: the link desk for Trading with Sidhant",
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
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
