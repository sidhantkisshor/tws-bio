import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse, after } from 'next/server'
import { CLICK_RPC_TIMEOUT_MS, clientIp, shouldRecordClick } from '@/lib/clickContext'
import { toAndroidLaunchUri } from '@/lib/deeplinks'
import { readUtm } from '@/lib/forwardParams'
import { brandPageHtml, deadLinkResponse, notFoundResponse, unavailableResponse } from '@/lib/linkPages'
import { getBrowser, getDevice, getOS, isAndroid, isIOS } from '@/lib/userAgent'
import {
  destinationDomain,
  referrerDomain,
  sendClickToServerContainer,
} from '@/lib/sgtm'
import {
  htmlEscape,
  isSafeUrl,
  jsonEscapeForHtml,
  pointsAtShortCode,
  resolveDestination,
  supportsIntentRedirect,
} from '@/lib/redirectSafety'
import { hasShortCodeShape } from '@/lib/shortCodes'
import { attributionSource } from '@/lib/shortLinkAttribution'
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

function isMobile(userAgent: string): boolean {
  return isIOS(userAgent) || isAndroid(userAgent)
}

const SHORT_DOMAIN = process.env.NEXT_PUBLIC_SHORT_DOMAIN || 'tws.bio'

// Every redirect waits on this lookup. A healthy one takes a few milliseconds
// (the function runs next to the database), so the bound only trips when the
// database is in trouble, and the visitor then gets the 503 page instead of a
// blank tab until the platform kills the function.
const LOOKUP_TIMEOUT_MS = 2500

// A destination or web fallback that is this same short link would send the
// visitor straight back here, recording a click on every hop until the browser
// gives up.
function selfLoopResponse(homeUrl: string): NextResponse {
  return deadLinkResponse(410, '410: LINK POINTS TO ITSELF', 'This link points back to itself, so it cannot be opened.', homeUrl)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shortCode: string }> }
) {
  const { shortCode } = await params
  const homeUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin

  // Every code the app has generated or accepted has this shape (the create
  // RPCs enforce it since migration 007), so any other path (/favicon.ico,
  // /robots.txt, scanner probes) is not a link the app made and is answered
  // without a database round trip.
  if (!hasShortCodeShape(shortCode)) return notFoundResponse(homeUrl)

  const userAgent = request.headers.get('user-agent') || ''
  const referer = request.headers.get('referer') || null
  const acceptLanguage = request.headers.get('accept-language')
  // Snapshot the inbound URL now. It becomes the `page_location` of the server
  // tagging hit, query string included, so GA4 reads campaign attribution
  // straight off the link the visitor actually clicked.
  const clickUrl = request.nextUrl.href

  // Campaign fields for the click row, read with the forwarder's key-case
  // folding, so `?UTM_SOURCE=x` is stored as the source the destination gets.
  const utm = readUtm(request.nextUrl.searchParams)

  // The utm_source a bare click is stamped with: the site the link was clicked
  // on, the short domain when there is no referrer, or null to stamp nothing on
  // a click from one of the business's own sites. Read once, so the redirect
  // and the deep-link fallback name the same source.
  const defaultSource = attributionSource(referer, SHORT_DOMAIN)

  const ip = clientIp(request.headers)

  // Client country from Vercel's edge geo header (ISO-3166 alpha-2), when present.
  // No external geo-IP service required; absent in local dev (stays null).
  const country = request.headers.get('x-vercel-ip-country') || undefined

  // Get the link. The RPC enforces is_active server-side and returns the single
  // active row (or none). PostgREST may hand back a single object or an array
  // depending on the function shape, so normalize defensively. A timeout, a
  // dropped connection and a PostgREST error all come back as `error`, never
  // as a throw.
  const { data: linkResult, error } = await supabase
    .rpc('get_link_by_short_code', { p_short_code: shortCode })
    .abortSignal(AbortSignal.timeout(LOOKUP_TIMEOUT_MS))

  // A failed lookup says nothing about the link, so it must not read as "not
  // found": visitors would give up on a working link. It is logged because an
  // outage would otherwise look like a run of ordinary typos.
  if (error) {
    console.error('Link lookup failed:', { shortCode, code: error.code, message: error.message })
    return unavailableResponse()
  }

  const link = Array.isArray(linkResult) ? linkResult[0] : linkResult
  if (!link) return notFoundResponse(homeUrl)

  // Check if the link has expired
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return deadLinkResponse(410, '410: LINK EXPIRED', 'This link has passed its expiry date and no longer redirects.', homeUrl)
  }

  // Check if the link has exceeded max clicks
  if (link.max_clicks && (link.total_clicks ?? 0) >= link.max_clicks) {
    return deadLinkResponse(410, '410: CLICK LIMIT REACHED', 'This link has reached its maximum number of clicks.', homeUrl)
  }

  // Track analytics asynchronously via after(). Called only on the three paths
  // that send the visitor on, once their response is built: a refused, dead or
  // unavailable link is not a click. Nor is a HEAD request, a bot or a link
  // preview (see shouldRecordClick). Two independent sinks, fired together
  // rather than in sequence so one slow hop cannot double the time this
  // invocation stays alive:
  //   1. Supabase, which powers the per-link dashboard.
  //   2. The GTM server container, which puts the click in the same GA4
  //      property as the rest of the business, so a short-link click sits
  //      beside the sessions and conversions it produced.
  // Neither may take the redirect down with it, so each settles on its own.
  const trackClick = () => {
    if (!shouldRecordClick(request.method, userAgent)) return

    after(async () => {
      const deviceType = getDevice(userAgent)
      const browserName = getBrowser(userAgent)
      const osName = getOS(userAgent)

      const recordClick = supabase
        .rpc('record_click_and_increment', {
          p_link_id: link.id,
          p_ip_address: ip ?? undefined,
          p_user_agent: userAgent || undefined,
          p_referrer_url: referer ?? undefined,
          p_browser_name: browserName,
          p_os_name: osName,
          p_device_type: deviceType,
          p_utm_source: utm.utm_source,
          p_utm_medium: utm.utm_medium,
          p_utm_campaign: utm.utm_campaign,
          p_utm_term: utm.utm_term,
          p_utm_content: utm.utm_content,
          p_country: country,
        })
        .abortSignal(AbortSignal.timeout(CLICK_RPC_TIMEOUT_MS))
        .then(({ error: rpcError }) => {
          if (rpcError) console.error('Error tracking analytics:', rpcError)
        })

      const sendToServerContainer = sendClickToServerContainer({
        pageLocation: clickUrl,
        referrer: referer,
        userAgent,
        ip,
        // Only the primary tag. The full Accept-Language header is a fingerprinting
        // surface and GA4 stores one language per event anyway.
        language: acceptLanguage?.split(',')[0]?.trim() || null,
        params: {
          short_code: link.short_code,
          link_type: link.link_type ?? 'url',
          destination_domain: destinationDomain(link.original_url),
          referrer_domain: referrerDomain(referer),
          device_category: deviceType,
          browser: browserName,
          operating_system: osName,
          country,
          campaign_id: link.campaign_id ?? undefined,
        },
      })

      const [click, tagging] = await Promise.allSettled([recordClick, sendToServerContainer])

      // allSettled swallows rejections, so anything that threw has to be read back
      // out and logged. A transport-level Supabase failure surfaces here rather
      // than in the .then() above, which only sees a returned error.
      if (click.status === 'rejected') {
        console.error('Error tracking analytics:', click.reason)
      }

      // A misconfigured tag server would otherwise go unnoticed for weeks: the
      // redirect keeps working and the dashboard keeps filling from Supabase,
      // while GA4 quietly receives nothing. `skipped` is not logged, because that
      // is the intended state whenever the endpoint is unset (local dev, previews).
      if (tagging.status === 'rejected') {
        console.error('Server-side tagging threw:', tagging.reason)
      } else if (tagging.value === 'failed') {
        console.error(`Server-side tagging failed for ${link.short_code}`)
      }
    })
  }

  // Handle deep linking
  if (link.link_type === 'deep_link' && isMobile(userAgent)) {
    const deepLink = isIOS(userAgent)
      ? link.ios_deep_link
      : isAndroid(userAgent)
      ? link.android_deep_link
      : null

    const rawFallbackUrl = link.fallback_url && isSafeUrl(link.fallback_url)
      ? link.fallback_url
      : isSafeUrl(link.original_url)
        ? link.original_url
        : null

    if (deepLink && isSafeUrl(deepLink) && rawFallbackUrl) {
      // Both the intent redirect and the interstitial send a visitor without
      // the app to this fallback, so a fallback that is this link would loop.
      if (pointsAtShortCode(rawFallbackUrl, link.short_code, SHORT_DOMAIN)) {
        return selfLoopResponse(homeUrl)
      }

      // The web fallback is a normal page load, so it must carry the tracking
      // params. The deep link itself is left alone: app schemes are not URLs in
      // the sense URLSearchParams expects.
      const fallbackUrl = resolveDestination(rawFallbackUrl, request.nextUrl.searchParams, link.short_code, defaultSource)

      if (isAndroid(userAgent) && supportsIntentRedirect(userAgent)) {
        // Chromium (Chrome and in-app WebViews like Instagram's) blocks
        // gesture-less JS navigation to app schemes, so an interstitial can
        // never launch the app on Android. A server redirect keeps the
        // original tap's user gesture, and the intent's embedded
        // S.browser_fallback_url covers the app-not-installed case.
        const intentRedirect = NextResponse.redirect(toAndroidLaunchUri(deepLink, fallbackUrl), {
          headers: { 'Cache-Control': 'no-store' },
        })
        trackClick()
        return intentRedirect
      }

      const safeDeepLink = jsonEscapeForHtml(deepLink)
      const safeFallbackUrl = jsonEscapeForHtml(fallbackUrl)
      // These land in an href="..." attribute, so they need HTML escaping, not
      // URI escaping. encodeURI() would re-encode the percent signs already in
      // a valid URL, so a stored `?next=https%3A%2F%2F...` reached the
      // destination as the literal string `https%3A%2F%2F...` and any checkout
      // hand-off behind it died. Only the "tap to continue" anchor was
      // affected, never the scripted redirect, which made it near invisible.
      const fallbackUrlAttr = htmlEscape(fallbackUrl)
      const deepLinkAttr = htmlEscape(deepLink)

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
@keyframes spin{to{transform:rotate(360deg)}}
.btn-link{display:inline-block;margin-top:12px;color:#999999;font-size:13px;text-decoration:underline}
.btn-link:hover{color:#FAFAFA}`,
        cardHtml: `<p class="eyebrow">Redirecting</p>
<div class="spin" aria-hidden="true"></div>
<p class="spin-static">One moment&hellip;</p>
<h1>Opening app...</h1>
<p>If the app doesn't open automatically, tap below:</p>
<a href="${deepLinkAttr}" class="btn">Open in app</a>
<a href="${fallbackUrlAttr}" id="fallback" class="btn-link">Continue to website</a>`,
        footerScript: `<script>
// Attempt to open the deep link
window.location.href = ${safeDeepLink};

// Fall back to the web URL after a delay. A sustained hide means the app took
// over: cancel the timer so returning users aren't dragged to the fallback.
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

      const interstitial = new NextResponse(html, {
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
      trackClick()
      return interstitial
    }
  }

  if (!isSafeUrl(link.original_url)) {
    return deadLinkResponse(403, '403: FLAGGED AS UNSAFE', 'This destination has been flagged as unsafe and cannot be opened.', homeUrl)
  }
  if (pointsAtShortCode(link.original_url, link.short_code, SHORT_DOMAIN)) {
    return selfLoopResponse(homeUrl)
  }

  // Regular redirect. Explicit no-store: click analytics depend on every click
  // reaching the server, so no browser or CDN may ever cache this 307.
  const redirectResponse = NextResponse.redirect(
    resolveDestination(link.original_url, request.nextUrl.searchParams, link.short_code, defaultSource),
    { headers: { 'Cache-Control': 'no-store' } },
  )
  trackClick()
  return redirectResponse
}
