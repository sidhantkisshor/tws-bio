import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from './lib/supabase/middleware'
import { rateLimit } from './lib/rate-limit'

// Rate limiters for different endpoints
const linkCreateLimiter = rateLimit({ interval: 60000, limit: 20 }) // 20 creates per minute
const redirectLimiter = rateLimit({ interval: 60000, limit: 200 }) // 200 redirects per minute
const apiLimiter = rateLimit({ interval: 60000, limit: 100 }) // 100 API calls per minute

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Apply rate limiting for link creation
  if (path === '/api/links' && request.method === 'POST') {
    if (!linkCreateLimiter.check(request)) {
      return NextResponse.json(
        { error: 'Too many link creation attempts. Please try again later.' },
        { status: 429 }
      )
    }
  }
  
  // Rate limit redirects (short codes)
  if (path.match(/^\/[a-zA-Z0-9-]+$/) && path !== '/') {
    if (!redirectLimiter.check(request)) {
      return new NextResponse('Too many requests. Please try again later.', { 
        status: 429,
        headers: { 'Content-Type': 'text/plain' }
      })
    }
  }

  // Rate limit API routes
  if (path.startsWith('/api/')) {
    if (!apiLimiter.check(request)) {
      return NextResponse.json(
        { error: 'API rate limit exceeded. Please try again later.' },
        { status: 429 }
      )
    }
  }

  // Continue with Supabase session update
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes that don't need auth
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}