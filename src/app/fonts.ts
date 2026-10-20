import localFont from 'next/font/local'
import { JetBrains_Mono, Newsreader } from 'next/font/google'

// The three Day Book faces, loaded once by the root layout. Each one sets a
// CSS variable on <html>; globals.css maps them onto font-sans, font-serif
// (and font-heading) and font-mono. The redirect and status pages in
// src/lib/linkPages.ts keep their own system stack: they sit on the click
// path and stay webfont-free.

/** Interface, body, labels and table text. The TWS brand face (Fontshare). */
export const satoshi = localFont({
  src: [
    { path: './_fonts/Satoshi-Regular.woff2', weight: '400', style: 'normal' },
    { path: './_fonts/Satoshi-Medium.woff2', weight: '500', style: 'normal' },
    { path: './_fonts/Satoshi-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-satoshi',
  display: 'swap',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
})

/**
 * Page titles, section titles and KPI figures. The variable file, with the
 * optical-size axis: next/font does not accept fixed weights together with
 * `axes`, and the variable file covers both 400 and 500.
 */
export const newsreader = Newsreader({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--font-newsreader',
  display: 'swap',
})

/** Short codes, UTM keys and URLs. Never numbers. */
export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains',
  display: 'swap',
})

/**
 * Compatibility shim. DM Serif Display is gone; three files still put
 * `dmSerif.variable` on a wrapper and read `var(--font-dm-serif)`. That
 * variable now points at Newsreader (globals.css), so this object adds no
 * class and loads no font. Remove it once nothing imports it.
 */
export const dmSerif = { variable: '', className: '' } as const
