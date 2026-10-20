import { DM_Serif_Display } from 'next/font/google'

// The serif italic accent only appears on the home hero, /resources and the
// auth shell. Because it is defined here and not in the root layout, next/font
// preloads it only on the routes that import it, not on every dashboard page.
// Put dmSerif.variable on a wrapper around the accent: the globals.css theme
// entry for --font-dm-serif only refers to itself, so the wrapper class is
// what supplies the real value.
export const dmSerif = DM_Serif_Display({
  weight: '400',
  subsets: ['latin'],
  style: 'italic',
  variable: '--font-dm-serif',
})
