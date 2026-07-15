import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const requestUrl = new URL(request.url)
  const origin = process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin
  const supabase = await createClient()

  try {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('[signout] auth.signOut:', error)
    }
  } catch (err) {
    console.error('[signout] auth.signOut threw:', err)
  }

  return NextResponse.redirect(`${origin}/`, {
    status: 303,
  })
}