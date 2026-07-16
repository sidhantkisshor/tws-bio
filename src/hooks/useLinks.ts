'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Database } from '@/types/database'

// Only the columns the home links list actually renders — keeps the query
// payload small and the ghost columns (custom_meta, tags, qr_code_url,
// password_hash) out of the wire format.
export type HomeLink = Pick<
  Database['public']['Tables']['links']['Row'],
  'id' | 'short_code' | 'original_url' | 'link_type' | 'total_clicks' | 'created_at'
>

const HOME_LINK_COLUMNS =
  'id, short_code, original_url, link_type, total_clicks, created_at'

const ANON_LINKS_KEY = 'anon_links'
const MAX_ANON_LINKS = 50

export function getAnonLinkIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(ANON_LINKS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

// Pure merge: prepend id, dedupe (id moves to front), cap at max (newest kept).
export function mergeAnonLinkId(
  existing: string[],
  id: string,
  max: number
): string[] {
  return [id, ...existing.filter((i) => i !== id)].slice(0, max)
}

export function saveAnonLinkId(id: string) {
  if (typeof window === 'undefined') return
  try {
    // Re-read the latest value immediately before writing so a concurrent
    // write from another tab is merged rather than clobbered.
    const ids = getAnonLinkIds()
    const updated = mergeAnonLinkId(ids, id, MAX_ANON_LINKS)
    localStorage.setItem(ANON_LINKS_KEY, JSON.stringify(updated))
  } catch {
    // localStorage unavailable
  }
}

export function useLinks(
  userId: string | null | undefined,
  authLoading = false
) {
  const [links, setLinks] = useState<HomeLink[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Wait for auth to resolve before fetching: firing with userId=undefined
    // while a session is still being read would issue a throwaway request
    // that is superseded moments later.
    if (authLoading) return

    let ignore = false

    async function fetchLinks() {
      setLoading(true)
      // Dynamic import keeps supabase-js out of the static home-page bundle.
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      if (userId) {
        const { data } = await supabase
          .from('links')
          .select(HOME_LINK_COLUMNS)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10)
        if (!ignore) setLinks(data || [])
      } else {
        // Fetch anonymous links from localStorage IDs. Direct table reads are
        // owner-only under RLS, so this goes through the get_links_by_ids
        // definer RPC — possession of a link's UUID is proof of creation.
        const anonIds = getAnonLinkIds()
        if (anonIds.length > 0) {
          const { data } = await supabase.rpc('get_links_by_ids', {
            p_ids: anonIds,
          })
          if (!ignore) setLinks((data || []).slice(0, 10))
        } else {
          if (!ignore) setLinks([])
        }
      }

      if (!ignore) setLoading(false)
    }

    fetchLinks()

    return () => {
      ignore = true
    }
  }, [userId, authLoading])

  const addLink = useCallback((link: HomeLink) => {
    setLinks((prev) => [link, ...prev])
  }, [])

  return { links, loading, addLink }
}
