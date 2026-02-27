'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type Link = Database['public']['Tables']['links']['Row']

export function useLinks(user: User | null) {
  const [links, setLinks] = useState<Link[]>([])
  const [loading, setLoading] = useState(true)

  const loadLinks = useCallback(async () => {
    const supabase = createClient()
    setLoading(true)
    
    if (user) {
      const { data, error } = await supabase
        .from('links')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
      
      if (error) {
        console.error('Error loading links:', error)
        setLinks([])
      } else {
        setLinks(data || [])
      }
    } else {
      // For anonymous users, we'll only show links created in this session
      setLinks([])
    }
    
    setLoading(false)
  }, [user])

  useEffect(() => {
    loadLinks()
  }, [loadLinks])

  const addLink = (link: Link) => {
    setLinks(currentLinks => [link, ...currentLinks])
  }

  return { links, loading, reloadLinks: loadLinks, addLink }
}