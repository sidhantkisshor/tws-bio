import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const requestUrl = new URL(request.url)
  const origin = process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin
  const supabase = await createClient()

  await supabase.auth.signOut()

  return NextResponse.redirect(`${origin}/`, {
    status: 303,
  })
}