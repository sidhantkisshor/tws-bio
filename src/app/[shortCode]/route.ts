import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse, after } from 'next/server'
import { BLOCKED_HOSTNAMES } from '@/lib/utils'

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shortCode: string }> }
) {
  const { shortCode } = await params
  const supabase = await createClient()

  const userAgent = request.headers.get('user-agent') || ''
  const referer = request.headers.get('referer') || null

  // Use x-forwarded-for header set by the reverse proxy (Vercel/load balancer).
  // Only trust the last value (appended by the proxy closest to us).
  const forwardedFor = request.headers.get('x-forwarded-for')
  const ip = forwardedFor ? forwardedFor.split(',').pop()!.trim() : null

  // Get the link
  const { data: link, error } = await supabase
    .from('links')
    .select('id, short_code, original_url, link_type, is_active, expires_at, max_clicks, total_clicks, ios_deep_link, android_deep_link, fallback_url')
    .eq('short_code', shortCode)
    .eq('is_active', true)
    .single()

  if (error || !link) {
    return new NextResponse('Link not found', { status: 404 })
  }

  // Check if the link has expired
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return new NextResponse('This link has expired', { status: 410 })
  }

  // Check if the link has exceeded max clicks
  if (link.max_clicks && (link.total_clicks ?? 0) >= link.max_clicks) {
    return new NextResponse('This link has reached its click limit', { status: 410 })
  }

  // Track analytics asynchronously via after()
  // NOTE: Full IP is stored for analytics. Consider hashing or truncating
  // for PII compliance in production (e.g., zero last octet for IPv4).
  after(async () => {
    try {
      await Promise.all([
        supabase.rpc('increment_link_clicks', { link_id: link.id }),
        supabase.rpc('record_click', {
          p_link_id: link.id,
          p_ip_address: ip ?? undefined,
          p_user_agent: userAgent || undefined,
          p_referrer_url: referer ?? undefined,
          p_browser_name: getBrowser(userAgent),
          p_os_name: getOS(userAgent),
          p_device_type: getDevice(userAgent),
        })
      ])
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

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Redirecting...</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: #f5f5f5;
            }
            .container {
              text-align: center;
              padding: 20px;
              background: white;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              max-width: 400px;
            }
            h1 { color: #333; font-size: 24px; margin-bottom: 10px; }
            p { color: #666; margin: 10px 0; }
            a {
              display: inline-block;
              margin-top: 20px;
              padding: 12px 24px;
              background: #007AFF;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 500;
            }
            a:hover { background: #0051D5; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Opening app...</h1>
            <p>If the app doesn't open automatically, click below:</p>
            <a href="${fallbackUrlAttr}" id="fallback">Continue to website</a>
          </div>
          <script>
            // Attempt to open the deep link
            window.location.href = ${safeDeepLink};

            // Fallback to web URL after a delay
            setTimeout(function() {
              window.location.href = ${safeFallbackUrl};
            }, 2500);
          </script>
        </body>
        </html>
      `

      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'",
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
        },
      })
    }
  }

  // Regular redirect
  if (!isSafeUrl(link.original_url)) {
    return new NextResponse('This link has been flagged as unsafe and cannot be accessed.', { status: 403 })
  }
  return NextResponse.redirect(link.original_url)
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
