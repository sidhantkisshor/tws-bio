import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'

function isIOS(userAgent: string): boolean {
  return /iPhone|iPad|iPod/i.test(userAgent)
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

const BLOCKED_HOSTNAMES = /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|0\.0\.0\.0|\[::1\]|\[::0\])$/i

function isSafeUrl(url: string): boolean {
  const lower = url.toLowerCase().trim()
  // Explicitly reject dangerous schemes
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
    return false
  }
  const colonIndex = lower.indexOf(':')
  if (colonIndex === -1) return false
  const scheme = lower.slice(0, colonIndex + 1)
  if (!SAFE_DEEP_LINK_SCHEMES.has(scheme)) return false
  // For web schemes, also block private networks (SSRF prevention)
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shortCode: string }> }
) {
  const { shortCode } = await params
  const supabase = await createClient()
  const headersList = await headers()
  
  // Get user agent for device detection and analytics
  const userAgent = headersList.get('user-agent') || ''
  const referer = headersList.get('referer') || null
  
  // Get IP address for analytics (in production, this would come from X-Forwarded-For)
  const forwardedFor = headersList.get('x-forwarded-for')
  const ip = forwardedFor ? forwardedFor.split(',')[0] : null

  // Get the link
  const { data: link, error } = await supabase
    .from('links')
    .select('*')
    .eq('short_code', shortCode)
    .eq('is_active', true)
    .single()

  if (error || !link) {
    return NextResponse.redirect(new URL('/404', request.url))
  }

  // Track analytics asynchronously
  Promise.all([
    // Increment click count
    supabase.rpc('increment_link_clicks', { link_id: link.id }),

    // Record detailed analytics
    supabase.from('clicks').insert({
      link_id: link.id,
      ip_address: ip,
      user_agent: userAgent,
      referrer_url: referer,
      browser_name: getBrowser(userAgent),
      os_name: getOS(userAgent),
      device_type: getDevice(userAgent) as 'desktop' | 'mobile' | 'tablet',
    })
  ]).catch(err => {
    console.error('Error tracking analytics:', err)
  })

  // Handle deep linking
  if (link.link_type === 'deep_link' && isMobile(userAgent)) {
    // Determine which deep link to use
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
      // Create HTML page that attempts to open the app

      // Use JSON.stringify to safely embed values in JavaScript context
      const safeDeepLink = JSON.stringify(deepLink).replace(/\//g, '\\/')
      const safeFallbackUrl = JSON.stringify(fallbackUrl).replace(/\//g, '\\/')
      // Escape double quotes for HTML attribute context
      const fallbackUrlAttr = fallbackUrl.replace(/"/g, '&quot;')

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

  // Regular redirect for web links or when no deep link is available
  return NextResponse.redirect(isSafeUrl(link.original_url) ? link.original_url : new URL('/', request.url).toString())
}

// Helper functions for analytics
function getBrowser(userAgent: string): string {
  if (userAgent.includes('Chrome')) return 'Chrome'
  if (userAgent.includes('Firefox')) return 'Firefox'
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari'
  if (userAgent.includes('Edge')) return 'Edge'
  if (userAgent.includes('Opera')) return 'Opera'
  return 'Other'
}

function getOS(userAgent: string): string {
  if (userAgent.includes('Windows')) return 'Windows'
  if (userAgent.includes('Mac')) return 'macOS'
  if (userAgent.includes('Linux')) return 'Linux'
  if (isIOS(userAgent)) return 'iOS'
  if (isAndroid(userAgent)) return 'Android'
  return 'Other'
}

function getDevice(userAgent: string): 'desktop' | 'mobile' | 'tablet' {
  if (userAgent.includes('Mobile')) return 'mobile'
  if (userAgent.includes('Tablet')) return 'tablet'
  return 'desktop'
}