import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { geistMono } from "./mono-font";
import "./globals.css";

// DM Serif Display lives in ./fonts.ts and is applied only by the pages that
// use it. The <Toaster /> sits with the surfaces that toast (home, /login,
// the dashboard layout), so pages that never toast skip sonner.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

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
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${geistMono.variable}`}>
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}
