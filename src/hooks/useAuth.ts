'use client'

import { useEffect, useSyncExternalStore } from 'react'
import type { User } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  loading: boolean
}

// Module-level auth store shared by every useAuth() instance on the page:
// one supabase-js chunk load, one getUser() network round-trip, and one
// onAuthStateChange subscription per page load, instead of one of each per
// mounted hook (Navbar + CreateLinkForm + LinksList all mount it on home).
const INITIAL_STATE: AuthState = { user: null, loading: true }
// Settled state for a visitor with no session cookie. One shared object, so
// every mount re-emitting it after the first is a no-op for subscribers.
const ANON_STATE: AuthState = { user: null, loading: false }

let state: AuthState = INITIAL_STATE
let started = false
// getUser() has resolved: its confirmed value must not be overwritten by the
// cached-session replay that onAuthStateChange emits as INITIAL_SESSION.
let confirmed = false
const listeners = new Set<() => void>()

// @supabase/ssr keeps the browser session in a readable (non-httpOnly) cookie
// named sb-<project ref>-auth-token, split into .0, .1, ... once it outgrows a
// single cookie. The PKCE -code-verifier cookie is written before there is a
// session (mid Google sign-in), so it does not count. The ref is matched
// loosely on purpose: a false hit only costs the supabase-js download, a false
// miss would show a signed-in user the logged-out page.
const SESSION_COOKIE_NAME = /^sb-.+-auth-token(?:\.\d+)?$/

export function hasSupabaseSessionCookie(cookieString: string): boolean {
  return cookieString.split(';').some((pair) => {
    const eq = pair.indexOf('=')
    if (eq === -1) return false
    const name = pair.slice(0, eq).trim()
    const value = pair.slice(eq + 1).trim()
    return value !== '' && SESSION_COOKIE_NAME.test(name)
  })
}

function emit(next: AuthState) {
  state = next
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    // The anonymous result only holds for the page that measured it. Password
    // login is a soft navigation, so once the last hook unmounts, drop back
    // to loading: the next page renders its loading state (CreateLinkForm on
    // /dashboard/create keeps its server-resolved user) while start() checks
    // the cookie again, never a stale logged-out state.
    if (listeners.size === 0 && state === ANON_STATE) state = INITIAL_STATE
  }
}

function getSnapshot(): AuthState {
  return state
}

function getServerSnapshot(): AuthState {
  return INITIAL_STATE
}

async function start() {
  if (started) return

  // No session cookie means getUser() could only answer "no session", so
  // anonymous visitors skip the supabase-js download entirely. Not latched:
  // started stays false, so a later mount checks the cookie again.
  if (!hasSupabaseSessionCookie(document.cookie)) {
    if (state !== ANON_STATE) emit(ANON_STATE)
    return
  }

  started = true

  try {
    // Dynamic import keeps supabase-js out of the static home/auth bundles;
    // it loads as an async chunk after hydration.
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()

    // Subscribed for the lifetime of the page. Sign-out goes through
    // /auth/signout (a full navigation), which resets this module store.
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' && confirmed) return
      emit({ user: session?.user ?? null, loading: false })
    })

    // Optimistic seed: getSession() reads the locally cached session with no
    // network round-trip, so the UI settles without a skeleton in the common
    // case. UI-only: security-sensitive paths (RPC submits, server routes)
    // must keep relying on a getUser()-confirmed value.
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!confirmed) emit({ user: session?.user ?? null, loading: false })

    // Confirmed resolution: a single auth-server round-trip shared by all
    // mounted hook instances.
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()
    // "Auth session missing" is expected when the cookie held no usable
    // session; only log when a cached session failed to confirm.
    if (error && session) console.error('Auth error:', error.message)
    confirmed = true
    emit({ user, loading: false })
  } catch (err) {
    console.error('Failed to get user:', err)
    confirmed = true
    emit({ user: null, loading: false })
  }
}

export function useAuth() {
  const { user, loading } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  )

  useEffect(() => {
    void start()
  }, [])

  return { user, loading }
}
