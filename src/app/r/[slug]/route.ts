import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse, after } from 'next/server'
import { CLICK_RPC_TIMEOUT_MS, clientIp, shouldRecordClick } from '@/lib/clickContext'
import { readUtm } from '@/lib/forwardParams'
import { notFoundResponse } from '@/lib/linkPages'
import { MAX_TRACKED_SLUG, resourceDropDestination } from '@/lib/resourceDrop'
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

  // A mistyped slug from a video description gets the same branded page as any
  // other dead short link, with a way back to the site.
  if (!destination) {
    return notFoundResponse(process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin)
  }

  const userAgent = request.headers.get('user-agent') || ''
  const referer = request.headers.get('referer') || undefined
  const ip = clientIp(request.headers)
  const country = request.headers.get('x-vercel-ip-country') || undefined
  // Record the campaign the visitor actually lands with, defaults included.
  const landed = readUtm(new URL(destination).searchParams)

  // Crawlers and link previews (YouTube's own among them) would otherwise
  // create rows and inflate every video's count, and so would HEAD requests,
  // which Next.js answers by running this handler.
  if (shouldRecordClick(request.method, userAgent) && slug.length <= MAX_TRACKED_SLUG) {
    after(async () => {
      // One bound for both calls, so a hung database cannot keep the function
      // alive past it, however the time splits between them.
      const signal = AbortSignal.timeout(CLICK_RPC_TIMEOUT_MS)
      try {
        const { data: linkId, error } = await supabase
          .rpc('resource_drop_link_id', { p_slug: slug })
          .abortSignal(signal)
        if (error) { console.error('resource_drop_link_id failed:', error); return }
        if (!linkId) return

        const { error: clickError } = await supabase
          .rpc('record_click_and_increment', {
            p_link_id: linkId,
            p_ip_address: ip ?? undefined,
            p_user_agent: userAgent || undefined,
            p_referrer_url: referer,
            p_browser_name: getBrowser(userAgent),
            p_os_name: getOS(userAgent),
            p_device_type: getDevice(userAgent),
            p_utm_source: landed.utm_source,
            p_utm_medium: landed.utm_medium,
            p_utm_campaign: landed.utm_campaign,
            p_utm_term: landed.utm_term,
            p_utm_content: landed.utm_content,
            p_country: country,
          })
          .abortSignal(signal)
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
