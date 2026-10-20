import { Geist_Mono } from 'next/font/google'

// Short codes and mono labels. Weight 400 only: the latin 400 file is about
// 10 KB, and a second weight would pull in the 23 KB variable file. Mono text
// therefore never asks for font-medium, font-semibold or font-bold. Kept apart
// from fonts.ts so DM Serif stays scoped to the routes that use it. The
// redirect and status pages in src/lib/linkPages.ts keep their own system
// stack: they sit on the click path and stay webfont-free.
export const geistMono = Geist_Mono({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-geist-mono',
})
