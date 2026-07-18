import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse, after } from 'next/server'
import { BLOCKED_HOSTNAMES } from '@/lib/utils'
import type { Database } from '@/types/database'

// This route only calls SECURITY DEFINER RPCs (get_link_by_short_code,
// record_click_and_increment), so it never needs the caller's session. A
// module-level anon client skips the per-request cookies() await and cookie-jar
// copy the @supabase/ssr server client pays on the app's hottest path.
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

function isIOS(userAgent: string): boolean {
  // iPadOS 13+ reports as Macintosh, detect via touch support hint in UA
  return /iPhone|iPod/i.test(userAgent) ||
    (/iPad/i.test(userAgent)) ||
    (/Macintosh/i.test(userAgent) && /Mobile/i.test(userAgent))
}

function isAndroid(userAgent: string): boolean {
  return /Android/i.test(userAgent)
}

function isMobile(userAgent: string): boolean {
  return isIOS(userAgent) || isAndroid(userAgent)
}

const SAFE_DEEP_LINK_SCHEMES = new Set([
  'http:', 'https:',
  // App-specific schemes used by the deep link system
  'youtube:', 'vnd.youtube:', 'instagram:', 'twitter:', 'tiktok:',
  'spotify:', 'linkedin:', 'fb:', 'reddit:', 'whatsapp:', 'tg:',
  'discord:', 'slack:', 'pinterest:', 'snapchat:', 'twitch:', 'nflx:',
  'soundcloud:', 'comgooglemaps:', 'google.navigation:', 'maps:', 'geo:',
  'com.amazon.mobile.shopping:', 'ebay:', 'airbnb:', 'uber:', 'venmo:',
  'cashapp:', 'paypal:', 'medium:', 'github:', 'zoomus:',
])

function isSafeUrl(url: string): boolean {
  const lower = url.toLowerCase().trim()
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
    return false
  }
  const colonIndex = lower.indexOf(':')
  if (colonIndex === -1) return false
  const scheme = lower.slice(0, colonIndex + 1)
  if (!SAFE_DEEP_LINK_SCHEMES.has(scheme)) return false
  if (scheme === 'http:' || scheme === 'https:') {
    try {
      const parsed = new URL(url)
      if (BLOCKED_HOSTNAMES.test(parsed.hostname)) return false
    } catch {
      return false
    }
  }
  return true
}

function jsonEscapeForHtml(value: string): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
}

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const SHORT_DOMAIN = process.env.NEXT_PUBLIC_SHORT_DOMAIN || 'tws.bio'

// Branded dark shell shared by the deep-link interstitial and dead-link pages.
// The CSP (default-src 'none') blocks every external asset, so everything is
// inline: system font stacks, pure-CSS spinner, no images or webfonts.
function brandPageHtml(opts: {
  title: string
  cardHtml: string
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
<title>${opts.title}</title>
<style>
*{box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:20px;min-height:100vh;margin:0;padding:24px;background:#0a0a0a;color:#FAFAFA}
.card{text-align:center;padding:32px 28px;background:#111111;border:1px solid #1f1f1f;border-radius:10px;max-width:400px;width:100%}
.eyebrow{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.14em;color:#999999;margin:0 0 16px}
h1{font-size:22px;font-weight:600;margin:0 0 10px}
p{color:#999999;font-size:14px;line-height:1.5;margin:0}
.btn{display:inline-block;margin-top:20px;padding:12px 24px;background:#00802B;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:500;font-size:14px;transition:background-color 150ms}
.btn:hover{background:#00B03B}
.btn:focus-visible{outline:2px solid #00B03B;outline-offset:2px}
.wordmark{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace;font-size:12px;letter-spacing:0.08em;color:#999999}
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

// Dead-link pages: same branded shell and security posture as the interstitial
// (script-src omitted from the CSP — these pages ship no JS), same status codes
// as the old plain-text responses. The request-origin fallback is escaped
// before interpolation; all other copy is fixed.
function deadLinkResponse(
  status: 403 | 404 | 410,
  eyebrow: string,
  message: string,
  homeUrl: string,
): NextResponse {
  const safeHomeUrl = htmlEscape(homeUrl)
  const safeDomain = htmlEscape(SHORT_DOMAIN)
  const html = brandPageHtml({
    title: eyebrow,
    cardHtml: `<h1 class="eyebrow">${eyebrow}</h1>
<p>${message}</p>
<a class="btn" href="${safeHomeUrl}">Go to ${safeDomain}</a>`,
  })
  return new NextResponse(html, {
    status,
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'private, no-store',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'",
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    },
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shortCode: string }> }
) {
  const { shortCode } = await params
  const homeUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin

  const userAgent = request.headers.get('user-agent') || ''
  const referer = request.headers.get('referer') || null

  // Parse UTM parameters from the incoming request URL
  const utmSource = request.nextUrl.searchParams.get('utm_source') || undefined
  const utmMedium = request.nextUrl.searchParams.get('utm_medium') || undefined
  const utmCampaign = request.nextUrl.searchParams.get('utm_campaign') || undefined
  const utmTerm = request.nextUrl.searchParams.get('utm_term') || undefined
  const utmContent = request.nextUrl.searchParams.get('utm_content') || undefined

  // Derive the client IP from a platform-trusted header. On Vercel/edge the
  // trusted client IP is set as `x-real-ip`, or as the FIRST entry of
  // `x-forwarded-for`. A client-supplied XFF is otherwise untrusted (spoofable),
  // so we never take the last entry.
  const realIp = request.headers.get('x-real-ip')
  const forwardedFor = request.headers.get('x-forwarded-for')
  const ip = realIp?.trim() || (forwardedFor ? forwardedFor.split(',')[0].trim() : null)

  // Client country from Vercel's edge geo header (ISO-3166 alpha-2), when present.
  // No external geo-IP service required; absent in local dev (stays null).
  const country = request.headers.get('x-vercel-ip-country') || undefined

  // Get the link. The RPC enforces is_active server-side and returns the single
  // active row (or null). PostgREST may hand back a single object or an array
  // depending on the function shape, so normalize defensively.
  const { data: linkResult, error } = await supabase.rpc('get_link_by_short_code', {
    p_short_code: shortCode,
  })
  const link = Array.isArray(linkResult) ? linkResult[0] : linkResult

  if (error || !link) {
    return deadLinkResponse(404, '404 — LINK NOT FOUND', "This short link doesn't exist or is no longer active.", homeUrl)
  }

  // Check if the link has expired
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return deadLinkResponse(410, '410 — LINK EXPIRED', 'This link has passed its expiry date and no longer redirects.', homeUrl)
  }

  // Check if the link has exceeded max clicks
  if (link.max_clicks && (link.total_clicks ?? 0) >= link.max_clicks) {
    return deadLinkResponse(410, '410 — CLICK LIMIT REACHED', 'This link has reached its maximum number of clicks.', homeUrl)
  }

  // Track analytics asynchronously via after()
  after(async () => {
    try {
      // Atomic increment + click insert. The RPC masks the IP and derives the
      // referrer domain server-side (replaces increment_link_clicks + record_click).
      await supabase.rpc('record_click_and_increment', {
        p_link_id: link.id,
        p_ip_address: ip ?? undefined,
        p_user_agent: userAgent || undefined,
        p_referrer_url: referer ?? undefined,
        p_browser_name: getBrowser(userAgent),
        p_os_name: getOS(userAgent),
        p_device_type: getDevice(userAgent),
        p_utm_source: utmSource,
        p_utm_medium: utmMedium,
        p_utm_campaign: utmCampaign,
        p_utm_term: utmTerm,
        p_utm_content: utmContent,
        p_country: country,
      })
    } catch (err) {
      console.error('Error tracking analytics:', err)
    }
  })

  // Handle deep linking
  if (link.link_type === 'deep_link' && isMobile(userAgent)) {
    const deepLink = isIOS(userAgent)
      ? link.ios_deep_link
      : isAndroid(userAgent)
      ? link.android_deep_link
      : null

    const fallbackUrl = link.fallback_url && isSafeUrl(link.fallback_url)
      ? link.fallback_url
      : isSafeUrl(link.original_url)
        ? link.original_url
        : null

    if (deepLink && isSafeUrl(deepLink) && fallbackUrl) {
      const safeDeepLink = jsonEscapeForHtml(deepLink)
      const safeFallbackUrl = jsonEscapeForHtml(fallbackUrl)
      const fallbackUrlAttr = encodeURI(fallbackUrl)

      const html = brandPageHtml({
        title: 'Redirecting...',
        // Spinner only when motion is allowed; static text otherwise (and in
        // browsers without media-query support, which fail safe to the text).
        extraCss: `.spin{display:none}
.spin-static{margin:0 0 14px;font-size:13px}
@media (prefers-reduced-motion:no-preference){
.spin{display:inline-block;width:16px;height:16px;border:2px solid #1f1f1f;border-top-color:#00B03B;border-radius:50%;animation:spin .8s linear infinite;margin:0 0 14px}
.spin-static{display:none}
}
@keyframes spin{to{transform:rotate(360deg)}}`,
        cardHtml: `<p class="eyebrow">Redirecting</p>
<div class="spin" aria-hidden="true"></div>
<p class="spin-static">One moment&hellip;</p>
<h1>Opening app...</h1>
<p>If the app doesn't open automatically, click below:</p>
<a href="${fallbackUrlAttr}" id="fallback" class="btn">Continue to website</a>`,
        footerScript: `<script>
// Attempt to open the deep link
window.location.href = ${safeDeepLink};

// Fall back to the web URL after a delay. A sustained hide means the app took
// over — cancel the timer so returning users aren't dragged to the fallback.
// A brief hide-then-show blip (scheme prompt, failed hand-off) is not an app
// open, so the timer re-arms; without this, one spurious visibilitychange
// would strand no-app users on this page. The anchor stays tappable either way.
var hiddenAt = 0;
function goFallback() {
  window.location.href = ${safeFallbackUrl};
}
var fallbackTimer = setTimeout(goFallback, 2500);
document.addEventListener('visibilitychange', function () {
  if (document.hidden) {
    hiddenAt = Date.now();
    clearTimeout(fallbackTimer);
  } else if (hiddenAt && Date.now() - hiddenAt < 1500) {
    fallbackTimer = setTimeout(goFallback, 1500);
  }
});
window.addEventListener('pagehide', function () {
  // Real navigation (unlike an app hand-off, which never fires pagehide):
  // kill the timer and the blip marker so a bfcache restore of this page
  // doesn't re-arm and bounce the user straight back out.
  hiddenAt = 0;
  clearTimeout(fallbackTimer);
});
</script>`,
      })

      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'private, no-store',
          // Escaping is already sound; frame-ancestors/base-uri are defense-in-depth.
          // Future improvement: replace 'unsafe-inline' with a per-response nonce.
          'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'",
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
        },
      })
    }
  }

  // Regular redirect. Explicit no-store: click analytics depend on every click
  // reaching the server, so no browser or CDN may ever cache this 307.
  if (!isSafeUrl(link.original_url)) {
    return deadLinkResponse(403, '403 — FLAGGED AS UNSAFE', 'This destination has been flagged as unsafe and cannot be opened.', homeUrl)
  }
  return NextResponse.redirect(link.original_url, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

// Browser detection - order matters: check specific browsers before generic ones
function getBrowser(userAgent: string): string {
  if (userAgent.includes('Edg')) return 'Edge'
  if (userAgent.includes('OPR') || userAgent.includes('Opera')) return 'Opera'
  if (userAgent.includes('Chrome') || userAgent.includes('CriOS')) return 'Chrome'
  if (userAgent.includes('Firefox') || userAgent.includes('FxiOS')) return 'Firefox'
  if (userAgent.includes('Safari')) return 'Safari'
  return 'Other'
}

function getOS(userAgent: string): string {
  if (isIOS(userAgent)) return 'iOS'
  if (isAndroid(userAgent)) return 'Android'
  if (userAgent.includes('Windows')) return 'Windows'
  if (userAgent.includes('Mac')) return 'macOS'
  if (userAgent.includes('Linux')) return 'Linux'
  return 'Other'
}

function getDevice(userAgent: string): 'desktop' | 'mobile' | 'tablet' {
  // Check tablet patterns first (iPad, Android tablet)
  if (/iPad/i.test(userAgent)) return 'tablet'
  if (/Macintosh/i.test(userAgent) && /Mobile/i.test(userAgent)) return 'tablet'
  if (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent)) return 'tablet'
  if (/Tablet/i.test(userAgent)) return 'tablet'
  // Then mobile
  if (/Mobile|iPhone|iPod|Android.*Mobile/i.test(userAgent)) return 'mobile'
  return 'desktop'
}
