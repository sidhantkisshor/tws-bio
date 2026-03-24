import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      // Exchange failed - redirect to login with error indication
      return NextResponse.redirect(`${origin}/login?error=auth_failed`)
    }
  } else {
    // No code provided - redirect to login
    return NextResponse.redirect(`${origin}/login`)
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}
