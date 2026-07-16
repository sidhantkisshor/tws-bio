import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Allowlist: only routes that can use a refreshed Supabase session.
     * /[shortCode] redirects — the hottest path in the app — never need one,
     * so short-link clicks skip the Supabase auth round trip entirely.
     */
    '/',
    '/dashboard/:path*',
    '/login',
    '/signup',
    '/resources',
    '/auth/:path*',
  ],
}
