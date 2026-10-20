import { NextResponse } from 'next/server'
import { htmlEscape } from './redirectSafety'

// Branded pages the short-link routes serve in place of a redirect. They live
// outside the route modules so `/[shortCode]` and `/r/[slug]` share one look
// and one set of security headers, and so they can be unit-tested (the routes
// create their Supabase clients at import time).

const SHORT_DOMAIN = process.env.NEXT_PUBLIC_SHORT_DOMAIN || 'tws.bio'

// The dead-link pages are fixed copy with no script, so their CSP leaves out
// script-src entirely. The deep-link interstitial runs an inline script and
// sets its own CSP.
const DEAD_LINK_HEADERS = {
  'Content-Type': 'text/html',
  'Cache-Control': 'private, no-store',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
}

// How long the lookup-failure page waits before it reloads itself.
const RETRY_PAGE_SECONDS = 15

// Day Book colors for the status pages, light and dark. They follow the
// system setting only: these pages run no script, so the app's stored theme
// choice cannot reach them. Values are the app's tokens (src/app/globals.css).
const SHELL_COLORS = `:root{--page:#F3F0EA;--surface:#FBFAF7;--ink:#1E2528;--rule-strong:#2C3539;--text-2:#454D51;--text-3:#5E6569;--rule:#D9D2C5;--accent-fill:#9A5626;--accent-fill-hover:#87491D;--on-accent:#FFFFFF;--accent-text:#8F4F22;--focus:#9A5626}
@media (prefers-color-scheme:dark){:root{--page:#131819;--surface:#1A2023;--ink:#EEE8DC;--rule-strong:#B4AEA3;--text-2:#B4AEA3;--text-3:#9A958C;--rule:#2F383C;--accent-fill:#D98A45;--accent-fill-hover:#E89A55;--on-accent:#131819;--accent-text:#E89A55;--focus:#E89A55}}`

// System stacks only: the CSP (default-src 'none') blocks webfonts, and these
// pages sit on the click path, so nothing is fetched.
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif"
const SERIF = "'Iowan Old Style','Palatino Linotype',Palatino,'Book Antiqua',Georgia,'Times New Roman',serif"

/**
 * Day Book shell shared by the deep-link interstitial and the dead-link
 * pages: warm paper, slate ink, a 2px ink rule opening the message, a serif
 * heading and one amber action. Light or dark follows prefers-color-scheme.
 * The CSP (default-src 'none') blocks every external asset, so everything is
 * inline: system font stacks, pure-CSS spinner, no images or webfonts.
 * `headHtml` and the other slots take fixed markup only.
 */
export function brandPageHtml(opts: {
  title: string
  cardHtml: string
  headHtml?: string
  extraCss?: string
  footerScript?: string
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#F3F0EA">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#131819">
${opts.headHtml ?? ''}<title>${opts.title}</title>
<style>
${SHELL_COLORS}
*{box-sizing:border-box}
body{font-family:${SANS};display:flex;flex-direction:column;justify-content:center;align-items:center;gap:32px;min-height:100vh;margin:0;padding:40px 16px;background:var(--page);color:var(--ink);-webkit-font-smoothing:antialiased}
.card{max-width:440px;width:100%;border-top:2px solid var(--rule-strong);padding-top:16px}
.eyebrow{font-family:${SANS};font-size:11px;font-weight:700;line-height:1.3;text-transform:uppercase;letter-spacing:0.08em;font-variant-numeric:tabular-nums lining-nums;color:var(--text-3);margin:0 0 10px}
h1{font-family:${SERIF};font-size:30px;line-height:1.1;font-weight:500;letter-spacing:-0.015em;margin:0 0 12px;text-wrap:balance}
p{color:var(--text-2);font-size:15px;line-height:1.55;margin:0;text-wrap:pretty}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;margin-top:24px;padding:0 18px;background:var(--accent-fill);color:var(--on-accent);text-decoration:none;border-radius:3px;font-weight:500;font-size:15px;transition:background-color 150ms}
.btn:hover{background:var(--accent-fill-hover)}
.btn:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
.wordmark{max-width:440px;width:100%;margin:0;font-family:${SANS};font-size:14px;font-weight:700;letter-spacing:-0.01em;color:var(--text-3)}
body .btn-link{display:flex;width:fit-content;align-items:center;min-height:44px;margin-top:8px;font-size:14px;color:var(--text-2);text-underline-offset:3px}
body .btn-link:hover{color:var(--ink)}
body .btn-link:focus-visible{outline:2px solid var(--focus);outline-offset:2px;border-radius:3px}
body .spin{border-color:var(--rule);border-top-color:var(--rule-strong)}
@media (prefers-reduced-motion:reduce){*{transition-duration:0.01ms!important}}
${opts.extraCss ?? ''}
</style>
</head>
<body>
<div class="card">
${opts.cardHtml}
</div>
<p class="wordmark">${htmlEscape(SHORT_DOMAIN)}</p>
${opts.footerScript ?? ''}
</body>
</html>`
}

// Where a follower who hit a dead link is sent: the business site, not the
// invite-only link tool. The tool's own home stays one quiet link below.
const TRUSTED_HOME_URL = 'https://tradingwithsidhant.com'

const ALT_LINK_CSS =
  '.alt{margin:8px 0 0;font-size:14px}.alt a{display:inline-flex;align-items:center;min-height:44px;color:var(--accent-text);text-decoration-color:color-mix(in srgb,currentColor 40%,transparent);text-underline-offset:3px}.alt a:hover{text-decoration-color:currentColor}.alt a:focus-visible{outline:2px solid var(--focus);outline-offset:2px;border-radius:3px}'

/**
 * Split '404: LINK NOT FOUND' into the code (small mono label) and the reason
 * (the h1, in sentence case), so the page has a real heading. The <title> keeps
 * the full eyebrow string. A string with no ': ' stays a single h1.
 */
function statusHeading(eyebrow: string): string {
  const split = eyebrow.indexOf(': ')
  if (split === -1) return `<h1>${eyebrow}</h1>`
  const code = eyebrow.slice(0, split)
  const label = eyebrow.slice(split + 2)
  const sentence = label.charAt(0) + label.slice(1).toLowerCase()
  return `<p class="eyebrow">${code}</p>
<h1>${sentence}</h1>`
}

/**
 * A branded status page in place of a redirect. The home URL can fall back to
 * the request origin, so it is escaped before interpolation. The eyebrow and
 * message are fixed copy from the caller.
 */
export function deadLinkResponse(
  status: 403 | 404 | 410,
  eyebrow: string,
  message: string,
  homeUrl: string,
): NextResponse {
  const safeHomeUrl = htmlEscape(homeUrl)
  const safeDomain = htmlEscape(SHORT_DOMAIN)
  const html = brandPageHtml({
    title: eyebrow,
    // The status code is the small label; the sentence-case reason is the h1.
    cardHtml: `${statusHeading(eyebrow)}
<p>${message}</p>
<a class="btn" href="${TRUSTED_HOME_URL}">Go to Trading with Sidhant</a>
<p class="alt"><a href="${safeHomeUrl}">Open ${safeDomain}</a></p>`,
    extraCss: ALT_LINK_CSS,
  })
  return new NextResponse(html, { status, headers: DEAD_LINK_HEADERS })
}

/**
 * The one "no such link" page: an unknown or inactive code, a path that cannot
 * be a code at all, and a malformed Resource Drop slug all read the same.
 */
export function notFoundResponse(homeUrl: string): NextResponse {
  return deadLinkResponse(404, '404: LINK NOT FOUND', "This short link doesn't exist or is no longer active.", homeUrl)
}

/**
 * The link lookup itself failed (a timeout, a dropped connection, a PostgREST
 * error), which says nothing about the link. A "not found" page here would
 * tell visitors a working link is dead, so they would never retry.
 *
 * Retry-After tells crawlers and link previews when to come back. People get a
 * meta refresh instead of a script, since these pages run none, plus a button.
 * `href=""` reloads the current URL, query string included, without echoing
 * anything from the request into the page.
 */
export function unavailableResponse(): NextResponse {
  const eyebrow = '503: TEMPORARILY UNAVAILABLE'
  const html = brandPageHtml({
    title: eyebrow,
    headHtml: `<meta http-equiv="refresh" content="${RETRY_PAGE_SECONDS}">`,
    cardHtml: `${statusHeading(eyebrow)}
<p>This link is fine, but it couldn't be looked up just now. This page will try again in a moment.</p>
<a class="btn" href="">Try again</a>`,
  })
  return new NextResponse(html, {
    status: 503,
    headers: { ...DEAD_LINK_HEADERS, 'Retry-After': '30' },
  })
}
