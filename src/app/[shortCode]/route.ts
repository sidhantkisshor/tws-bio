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
    supabase.rpc('increment_click_count', { link_id: link.id }),
    
    // Record detailed analytics
    supabase.from('link_analytics').insert({
      link_id: link.id,
      ip_address: ip,
      user_agent: userAgent,
      referer: referer,
      browser: getBrowser(userAgent),
      os: getOS(userAgent),
      device: getDevice(userAgent),
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

    if (deepLink) {
      // Create HTML page that attempts to open the app
      const fallbackUrl = link.fallback_url || link.original_url
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
            <a href="${fallbackUrl}" id="fallback">Continue to website</a>
          </div>
          <script>
            // Attempt to open the deep link
            window.location.href = "${deepLink}";
            
            // Fallback to web URL after a delay
            setTimeout(function() {
              window.location.href = "${fallbackUrl}";
            }, 2500);
          </script>
        </body>
        </html>
      `
      
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html',
        },
      })
    }
  }

  // Regular redirect for web links or when no deep link is available
  return NextResponse.redirect(link.original_url)
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

function getDevice(userAgent: string): string {
  if (userAgent.includes('Mobile')) return 'Mobile'
  if (userAgent.includes('Tablet')) return 'Tablet'
  return 'Desktop'
}