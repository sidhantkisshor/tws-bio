'use client'

import { useEffect, useSyncExternalStore } from 'react'
import type { User } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  loading: boolean
}

// Module-level auth store shared by every useAuth() instance on the page:
// one supabase-js chunk load, one getUser() network round-trip, and one
// onAuthStateChange subscription per page load — instead of one of each per
// mounted hook (Navbar + CreateLinkForm + LinksList all mount it on home).
const INITIAL_STATE: AuthState = { user: null, loading: true }

let state: AuthState = INITIAL_STATE
let started = false
// getUser() has resolved — its confirmed value must not be overwritten by the
// cached-session replay that onAuthStateChange emits as INITIAL_SESSION.
let confirmed = false
const listeners = new Set<() => void>()

function emit(next: AuthState) {
  state = next
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
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
  started = true

  try {
    // Dynamic import keeps supabase-js out of the static home/auth bundles;
    // it loads as an async chunk after hydration.
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()

    // Subscribed for the lifetime of the page — sign-out goes through
    // /auth/signout (a full navigation), which resets this module store.
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' && confirmed) return
      emit({ user: session?.user ?? null, loading: false })
    })

    // Optimistic seed: getSession() reads the locally cached session with no
    // network round-trip, so the UI settles without a skeleton in the common
    // case. UI-only — security-sensitive paths (RPC submits, server routes)
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
    // "Auth session missing" is the expected steady state for anonymous
    // visitors — only log when a cached session failed to confirm.
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
