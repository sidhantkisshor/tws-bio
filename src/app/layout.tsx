import type { Metadata, Viewport } from "next";
import { Inter, DM_Serif_Display } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const dmSerif = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  style: "italic",
  variable: "--font-dm-serif",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: "tws.bio - URL Shortener",
  description: "Shorten your URLs with tws.bio — by Trading with Sidhant",
  openGraph: {
    title: "tws.bio — Short links, big impact",
    description:
      "Create short links with analytics and mobile deep linking — by Trading with Sidhant.",
    siteName: "tws.bio",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "tws.bio — Short links, big impact",
    description:
      "Create short links with analytics and mobile deep linking — by Trading with Sidhant.",
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
    <html lang="en" className={`dark ${inter.variable} ${dmSerif.variable}`}>
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
