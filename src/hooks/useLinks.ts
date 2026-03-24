'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

type Link = Database['public']['Tables']['links']['Row']

const ANON_LINKS_KEY = 'anon_links'
const MAX_ANON_LINKS = 50

function getAnonLinkIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(ANON_LINKS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function saveAnonLinkId(id: string) {
  if (typeof window === 'undefined') return
  try {
    const ids = getAnonLinkIds()
    const updated = [id, ...ids.filter((i) => i !== id)].slice(0, MAX_ANON_LINKS)
    localStorage.setItem(ANON_LINKS_KEY, JSON.stringify(updated))
  } catch {
    // localStorage unavailable
  }
}

export function useLinks(userId: string | null | undefined) {
  const [links, setLinks] = useState<Link[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchLinks() {
      setLoading(true)
      const supabase = createClient()

      if (userId) {
        const { data } = await supabase
          .from('links')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10)
        setLinks(data || [])
      } else {
        // Fetch anonymous links from localStorage IDs
        const anonIds = getAnonLinkIds()
        if (anonIds.length > 0) {
          const { data } = await supabase
            .from('links')
            .select('*')
            .in('id', anonIds)
            .order('created_at', { ascending: false })
            .limit(10)
          setLinks(data || [])
        } else {
          setLinks([])
        }
      }

      setLoading(false)
    }

    fetchLinks()
  }, [userId])

  const addLink = useCallback((link: Link) => {
    setLinks((prev) => [link, ...prev])
  }, [])

  return { links, loading, addLink }
}
