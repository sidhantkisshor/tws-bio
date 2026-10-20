'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Database } from '@/types/database'

// Only the columns the home links list actually renders: keeps the query
// payload small and the ghost columns (custom_meta, tags, qr_code_url,
// password_hash) out of the wire format.
export type HomeLink = Pick<
  Database['public']['Tables']['links']['Row'],
  'id' | 'short_code' | 'original_url' | 'link_type' | 'total_clicks' | 'created_at'
>

const HOME_LINK_COLUMNS =
  'id, short_code, original_url, link_type, total_clicks, created_at'

// Ids of links created anonymously before migration 019. Nothing writes this
// key any more (anonymous creation is gone); it is only read so those older
// links still show up for the browser that made them.
const ANON_LINKS_KEY = 'anon_links'

export function getAnonLinkIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(ANON_LINKS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function useLinks(
  userId: string | null | undefined,
  authLoading = false
) {
  const [links, setLinks] = useState<HomeLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  // Bumped by retry() to run the fetch again with the same inputs.
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    // Wait for auth to resolve before fetching: firing with userId=undefined
    // while a session is still being read would issue a throwaway request
    // that is superseded moments later.
    if (authLoading) return

    let ignore = false

    async function fetchLinks() {
      setLoading(true)
      setError(false)

      try {
        // Dynamic imports keep supabase-js out of the static home-page bundle,
        // and each sits in the branch that needs it: a visitor with no session
        // and no saved anonymous ids never downloads it.
        if (userId) {
          const { createClient } = await import('@/lib/supabase/client')
          const { data, error: queryError } = await createClient()
            .from('links')
            .select(HOME_LINK_COLUMNS)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(10)
          if (queryError) throw queryError
          if (!ignore) setLinks(data ?? [])
          return
        }

        const anonIds = getAnonLinkIds()
        if (anonIds.length === 0) {
          if (!ignore) setLinks([])
          return
        }

        // Direct table reads are owner-only under RLS, so this goes through
        // the get_links_by_ids definer RPC: possession of a link's UUID is
        // proof of creation.
        const { createClient } = await import('@/lib/supabase/client')
        const { data, error: rpcError } = await createClient().rpc('get_links_by_ids', {
          p_ids: anonIds,
        })
        if (rpcError) throw rpcError
        if (!ignore) setLinks((data ?? []).slice(0, 10))
      } catch (err) {
        // Without this, a failed load looks exactly like having no links.
        console.error('Failed to load links:', err)
        if (!ignore) setError(true)
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    void fetchLinks()

    return () => {
      ignore = true
    }
  }, [userId, authLoading, attempt])

  const addLink = useCallback((link: HomeLink) => {
    setLinks((prev) => [link, ...prev])
  }, [])

  const retry = useCallback(() => {
    setAttempt((n) => n + 1)
  }, [])

  return { links, loading, error, addLink, retry }
}
