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

/**
 * Branded dark shell shared by the deep-link interstitial and the dead-link
 * pages. The CSP (default-src 'none') blocks every external asset, so
 * everything is inline: system font stacks, pure-CSS spinner, no images or
 * webfonts. `headHtml` and the other slots take fixed markup only.
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
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#0a0a0a">
${opts.headHtml ?? ''}<title>${opts.title}</title>
<style>
*{box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:20px;min-height:100vh;margin:0;padding:24px;background:#0a0a0a;color:#FAFAFA}
.card{text-align:center;padding:32px 28px;background:#111111;border:1px solid #1f1f1f;border-radius:10px;max-width:400px;width:100%}
.eyebrow{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace;font-size:11px;font-weight:400;text-transform:uppercase;letter-spacing:0.14em;color:#999999;margin:0 0 8px}
h1{font-size:22px;font-weight:600;margin:0 0 10px}
p{color:#999999;font-size:14px;line-height:1.5;margin:0}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;margin-top:20px;padding:0 24px;background:#00802B;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:500;font-size:14px;transition:background-color 150ms}
.btn:hover{background:#006E25}
.btn:focus-visible{outline:2px solid #00B03B;outline-offset:2px}
.wordmark{border-left:2px solid #00B03B;padding-left:8px;line-height:1.2;font-family:inherit;font-weight:600;letter-spacing:0;color:#999999}
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
  '.alt{margin:8px 0 0;font-size:13px}.alt a{display:inline-flex;align-items:center;min-height:44px;color:#999999;text-underline-offset:3px}.alt a:hover{color:#FAFAFA}.alt a:focus-visible{outline:2px solid #00B03B;outline-offset:2px;border-radius:4px}'

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
