import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin

  // OAuth denial/provider failures arrive without a code (usually with
  // `error`/`error_description`). Never echo provider text into the URL; the
  // login page recognizes this fixed key only.
  if (!code || requestUrl.searchParams.has('error')) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    // Exchange failed - redirect to login with error indication
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}
