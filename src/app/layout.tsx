import type { Metadata } from "next";
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
  title: "tws.bio - URL Shortener",
  description: "Shorten your URLs with tws.bio — by Trading with Sidhant",
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
