'use client';

import { useState } from 'react';
import QRCode from 'react-qr-code';
import { getShortUrl } from '../lib/utils';
import type { User } from '@supabase/supabase-js';

type Link = {
  id?: string;
  short_code: string;
  original_url: string;
  created_at: string;
};

type LinksListProps = {
  user: User | null;
  links: Link[];
  loading: boolean;
};

export function LinksList({ user, links, loading }: LinksListProps) {
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const handleCopy = (shortCode: string) => {
    const shortUrl = getShortUrl(shortCode);
    navigator.clipboard.writeText(shortUrl);
    setCopiedLink(shortCode);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (links.length === 0) {
    return null; // Don't render anything if there are no links to show
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        {user ? 'Recent Links' : 'Your Links'}
      </h2>
      <div className="space-y-5">
        {links.map((link) => {
          const shortUrl = getShortUrl(link.short_code);
          const displayUrl = shortUrl.replace(/^https?:\/\//, '');

          return (
            <div key={link.short_code} className="bg-gray-50 p-4 rounded-lg border border-gray-200 transition-shadow hover:shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex-1 overflow-hidden">
                  <a href={shortUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-lg text-blue-600 hover:underline break-all">
                    {displayUrl}
                  </a>
                  <p className="text-sm text-gray-500 truncate mt-1" title={link.original_url}>
                    {link.original_url}
                  </p>
                </div>
                <div className="flex items-center gap-4 ml-4">
                  <button
                    onClick={() => handleCopy(link.short_code)}
                    className={`w-24 text-sm font-semibold px-4 py-2 rounded-lg transition ${
                      copiedLink === link.short_code
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {copiedLink === link.short_code ? 'Copied!' : 'Copy'}
                  </button>
                  <div className="w-16 h-16 p-1 bg-white border rounded-md shadow-sm">
                    <QRCode value={shortUrl} size={60} level="L" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
} 