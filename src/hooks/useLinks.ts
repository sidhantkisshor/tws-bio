'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../lib/supabase/client';
import type { User } from '@supabase/supabase-js';

type Link = {
  id?: string;
  short_code: string;
  original_url: string;
  created_at: string;
};

export function useLinks(user: User | null) {
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const loadLinks = useCallback(async () => {
    setLoading(true);
    if (user) {
      const { data, error } = await supabase
        .from('links')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) {
        console.error('Error loading links:', error);
        setLinks([]);
      } else {
        setLinks(data || []);
      }
      localStorage.removeItem('anonymousLinks');
    } else {
      const localLinks = JSON.parse(localStorage.getItem('anonymousLinks') || '[]');
      setLinks(localLinks);
    }
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    loadLinks();
  }, [user, loadLinks]);

  const addLink = (link: Link) => {
    setLinks(currentLinks => [link, ...currentLinks]);
    if (!user) {
      const currentLinks = JSON.parse(localStorage.getItem('anonymousLinks') || '[]');
      const updatedLinks = [link, ...currentLinks];
      localStorage.setItem('anonymousLinks', JSON.stringify(updatedLinks));
    }
  };

  return { links, loading, reloadLinks: loadLinks, addLink };
} 