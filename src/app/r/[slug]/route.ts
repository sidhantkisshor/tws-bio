import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse, after } from 'next/server'
import { MAX_TRACKED_SLUG, resourceDropDestination } from '@/lib/resourceDrop'
import { isLikelyBot } from '@/lib/sgtm'
import { getBrowser, getDevice, getOS } from '@/lib/userAgent'
import type { Database } from '@/types/database'

// Same module-level anon client as /[shortCode]: this route only calls
// SECURITY DEFINER RPCs, so it never needs the caller's session.
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

// `tws.bio/r/{slug}` short links for TWS Resource Drops. See src/lib/resourceDrop.ts
// for why this is a fixed pattern rather than a link created up front.
//
// The redirect never waits on the database. The click is recorded afterwards
// against a `links` row with short_code 'r/{slug}', which
// `resource_drop_link_id` (migration 021) finds or creates on first click, so
// every video shows up in the dashboard with its own click history.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: rawSlug } = await params
  const slug = rawSlug.toLowerCase()
  const destination = resourceDropDestination(slug, request.nextUrl.searchParams)

  if (!destination) {
    return new NextResponse('This link does not exist.', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }

  const userAgent = request.headers.get('user-agent') || ''
  const referer = request.headers.get('referer') || undefined
  const realIp = request.headers.get('x-real-ip')
  const forwardedFor = request.headers.get('x-forwarded-for')
  const ip = realIp?.trim() || (forwardedFor ? forwardedFor.split(',')[0].trim() : undefined)
  const country = request.headers.get('x-vercel-ip-country') || undefined
  // Record the campaign the visitor actually lands with, defaults included.
  const landed = new URL(destination).searchParams

  // Crawlers (YouTube's own link preview among them) would otherwise create
  // rows and inflate every video's count.
  if (!isLikelyBot(userAgent) && slug.length <= MAX_TRACKED_SLUG) {
    after(async () => {
      try {
        const { data: linkId, error } = await supabase.rpc('resource_drop_link_id', { p_slug: slug })
        if (error) { console.error('resource_drop_link_id failed:', error); return }
        if (!linkId) return

        const { error: clickError } = await supabase.rpc('record_click_and_increment', {
          p_link_id: linkId,
          p_ip_address: ip,
          p_user_agent: userAgent || undefined,
          p_referrer_url: referer,
          p_browser_name: getBrowser(userAgent),
          p_os_name: getOS(userAgent),
          p_device_type: getDevice(userAgent),
          p_utm_source: landed.get('utm_source') || undefined,
          p_utm_medium: landed.get('utm_medium') || undefined,
          p_utm_campaign: landed.get('utm_campaign') || undefined,
          p_utm_term: landed.get('utm_term') || undefined,
          p_utm_content: landed.get('utm_content') || undefined,
          p_country: country,
        })
        if (clickError) console.error('Error tracking resource drop click:', clickError)
      } catch (err) {
        console.error('Error tracking resource drop click:', err)
      }
    })
  }

  return NextResponse.redirect(destination, {
    status: 302,
    headers: { 'Cache-Control': 'no-store' },
  })
}
