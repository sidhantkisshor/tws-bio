import { NextRequest, NextResponse } from 'next/server'
import { resourceDropDestination } from '@/lib/resourceDrop'

// `tws.bio/r/{slug}` short links for TWS Resource Drops. See src/lib/resourceDrop.ts
// for why this is a fixed pattern rather than a row in `links`. No database
// call: the redirect cannot fail because of this project's data.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const destination = resourceDropDestination(slug.toLowerCase(), request.nextUrl.searchParams)

  if (!destination) {
    return new NextResponse('This link does not exist.', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }

  return NextResponse.redirect(destination, {
    status: 302,
    headers: { 'Cache-Control': 'no-store' },
  })
}
