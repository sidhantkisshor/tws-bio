import { createClient } from '@/lib/supabase/server'
import { SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { parseUserAgent, extractUtmParams } from '@/lib/utils'
import { Database } from '@/types/database'

type Link = Database['public']['Tables']['links']['Row']

// --- Helper Functions ---

async function getValidLink(supabase: SupabaseClient<Database>, shortCode: string): Promise<Link> {
  const { data: link, error } = await supabase
    .from('links')
    .select('*')
    .eq('short_code', shortCode)
    .eq('is_active', true)
    .single()

  if (error || !link) {
    console.error('Error fetching link or link not found:', { shortCode, error })
    throw new Error('LinkNotFound')
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    console.log('Link expired:', shortCode)
    throw new Error('LinkExpired')
  }

  if (link.max_clicks && link.total_clicks >= link.max_clicks) {
    console.log('Max clicks reached:', shortCode)
    throw new Error('LinkMaxClicksReached')
  }

  return link
}

async function trackClick(
  supabase: SupabaseClient<Database>,
  waitUntil: (promise: Promise<any>) => void,
  link: Link,
  request: NextRequest
) {
  const headersList = await headers() // Await the promise here
  const userAgent = headersList.get('user-agent')
  const referer = headersList.get('referer')
  const { device_type, browser_name, os_name } = parseUserAgent(userAgent)
  const utmParams = extractUtmParams(request.url)

  const forwarded = headersList.get('x-forwarded-for')
  const realIp = headersList.get('x-real-ip')
  const ip = forwarded?.split(',')[0] || realIp || null

  const clickPromise = supabase.from('clicks').insert({
    link_id: link.id,
    user_agent: userAgent,
    device_type, browser_name, os_name, ip_address: ip,
    referrer_url: referer,
    referrer_domain: referer ? new URL(referer).hostname : null,
    ...utmParams,
    is_bot: device_type === 'bot',
  })

  const incrementPromise = supabase.rpc('increment_link_clicks', { link_id: link.id })

  waitUntil(Promise.all([clickPromise, incrementPromise]))
}

// --- Route Handler ---

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shortCode: string }> }
) {
  const { shortCode } = await params
  
  // Vercel Edge Runtime provides this context
  const context = (request as any).context as { waitUntil: (promise: Promise<any>) => void; };
  const waitUntil = context.waitUntil || ((p: Promise<any>) => p);

  const reservedPaths = ['api', '_next', 'favicon.ico', 'robots.txt', 'sitemap.xml', 'error', 'login', 'signup', 'dashboard', 'auth', 'logout', 'test', 'debug', 'link']
  if (reservedPaths.includes(shortCode) || !shortCode) {
    return NextResponse.next()
  }

  try {
    const supabase = await createClient()
    const link = await getValidLink(supabase, shortCode)
    
    waitUntil(trackClick(supabase, waitUntil, link, request));

    if (link.link_type === 'deep_link' && (link.ios_deep_link || link.android_deep_link)) {
      const interstitialUrl = new URL(`/link/${link.short_code}`, request.url)
      return NextResponse.redirect(interstitialUrl)
    }

    const targetUrl = new URL(link.original_url)
    return NextResponse.redirect(targetUrl)

  } catch (error: any) {
    console.error(`Redirect error for ${shortCode}:`, error.message)
    
    const errorCode = ['LinkNotFound', 'LinkExpired', 'LinkMaxClicksReached'].includes(error.message) ? 404 : 500
    return NextResponse.redirect(new URL(`/error?code=${errorCode}`, request.url))
  }
}