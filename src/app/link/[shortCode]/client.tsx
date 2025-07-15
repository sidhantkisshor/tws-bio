'use client'

import { useEffect, useState } from 'react'
import { FaApple, FaAndroid, FaGlobe } from 'react-icons/fa'

type Link = {
  original_url: string | null;
  ios_deep_link: string | null;
  android_deep_link: string | null;
  fallback_url: string | null;
  title: string | null;
  description: string | null;
}

export default function LinkInterstitialClient({ link }: { link: Link }) {
  const [os, setOs] = useState<'ios' | 'android' | 'other'>('other')

  useEffect(() => {
    const userAgent = window.navigator.userAgent
    if (/iPad|iPhone|iPod/.test(userAgent)) {
      setOs('ios')
    } else if (/Android/.test(userAgent)) {
      setOs('android')
    }
  }, [])

  useEffect(() => {
    // Attempt to redirect immediately
    const deepLink = os === 'ios' ? link.ios_deep_link : link.android_deep_link;
    if (deepLink) {
      window.location.href = deepLink;
    }
  }, [os, link]);

  const fallback = link.fallback_url || link.original_url || '/'
  const deepLink = os === 'ios' ? link.ios_deep_link : os === 'android' ? link.android_deep_link : null;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">{link.title || 'Redirecting...'}</h1>
          <p className="text-gray-600 mt-2">{link.description || 'Preparing your link.'}</p>
        </div>

        <div className="space-y-4">
          {deepLink && (
            <a
              href={deepLink}
              className="w-full flex items-center justify-center gap-3 bg-black text-white py-3 px-4 rounded-md hover:bg-gray-800 transition"
            >
              {os === 'ios' ? <FaApple size={20} /> : <FaAndroid size={20} />}
              <span>Open in App</span>
            </a>
          )}

          <a
            href={fallback}
            className="w-full flex items-center justify-center gap-3 bg-gray-200 text-gray-800 py-3 px-4 rounded-md hover:bg-gray-300 transition"
          >
            <FaGlobe size={20} />
            <span>Continue to Website</span>
          </a>
        </div>
        
        <p className="text-xs text-gray-400 mt-8">
          If you are not redirected automatically, please select an option above.
        </p>
      </div>
    </div>
  )
} 