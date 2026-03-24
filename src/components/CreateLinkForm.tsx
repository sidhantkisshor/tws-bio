'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { generateShortCode, isValidUrl, getShortUrl } from '@/lib/utils'
import { detectDeepLinks } from '@/lib/deeplinks'
import type { User } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type Link = Database['public']['Tables']['links']['Row']

interface CreateLinkFormProps {
  user: User | null
  onLinkCreated: (link: Link) => void
}

export function CreateLinkForm({ user, onLinkCreated }: CreateLinkFormProps) {
  const [url, setUrl] = useState('')
  const [customCode, setCustomCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [linkType, setLinkType] = useState<'url' | 'deep_link'>('url')
  const [iosDeepLink, setIosDeepLink] = useState('')
  const [androidDeepLink, setAndroidDeepLink] = useState('')
  const [fallbackUrl, setFallbackUrl] = useState('')
  const [detectedPlatform, setDetectedPlatform] = useState<string | null>(null)
  const [autoDetected, setAutoDetected] = useState(false)

  const resetForm = () => {
    setUrl('')
    setCustomCode('')
    setIosDeepLink('')
    setAndroidDeepLink('')
    setFallbackUrl('')
    setLinkType('url')
    setShowAdvanced(false)
    setDetectedPlatform(null)
    setAutoDetected(false)
  }

  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl)
    
    // Try to detect deep links
    if (newUrl && isValidUrl(newUrl)) {
      const deepLinkConfig = detectDeepLinks(newUrl)
      
      if (deepLinkConfig) {
        setDetectedPlatform(deepLinkConfig.platform)
        setAutoDetected(true)
        
        // Auto-populate deep link fields if they're empty or were auto-detected before
        if (!iosDeepLink || autoDetected) {
          setIosDeepLink(deepLinkConfig.ios || '')
        }
        if (!androidDeepLink || autoDetected) {
          setAndroidDeepLink(deepLinkConfig.android || '')
        }
        if (!fallbackUrl || autoDetected) {
          setFallbackUrl(deepLinkConfig.fallback)
        }
        
        // Automatically switch to deep link mode
        setLinkType('deep_link')
        setShowAdvanced(true)
      } else {
        // Reset if no platform detected and fields were auto-populated
        if (autoDetected) {
          setIosDeepLink('')
          setAndroidDeepLink('')
          setFallbackUrl('')
          setLinkType('url')
          setDetectedPlatform(null)
          setAutoDetected(false)
        }
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!isValidUrl(url)) {
      setError('Please enter a valid URL')
      return
    }

    setLoading(true)
    const supabase = createClient()

    try {
      const shortCode = customCode || generateShortCode()
      
      if (linkType === 'deep_link') {
        const { data, error: rpcError } = await supabase.rpc('create_deep_link', {
          p_short_code: shortCode,
          p_original_url: url,
          p_user_id: user?.id,
          p_ios_deep_link: iosDeepLink || undefined,
          p_android_deep_link: androidDeepLink || undefined,
          p_fallback_url: fallbackUrl || undefined,
        })

        if (rpcError) {
          throw new Error(rpcError.message)
        }

        if (data) {
          const shortUrl = getShortUrl(data.short_code)
          try { await navigator.clipboard.writeText(shortUrl) } catch { /* clipboard unavailable */ }
          setSuccess('Deep link created and copied to clipboard!')
          onLinkCreated(data)
          // Persist anonymous link ID for retrieval after page reload
          if (!user && data) {
            try {
              const stored = JSON.parse(localStorage.getItem('anon_links') || '[]') as string[]
              stored.unshift(data.id)
              localStorage.setItem('anon_links', JSON.stringify(stored.slice(0, 50)))
            } catch { /* localStorage unavailable */ }
          }
          resetForm()
          setTimeout(() => setSuccess(''), 3000)
        }
      } else {
        // Use RPC for regular links
        const { data, error: rpcError } = await supabase.rpc('create_link', {
          p_short_code: shortCode,
          p_original_url: url,
          p_user_id: user?.id,
        })

        if (rpcError) {
          throw new Error(rpcError.message)
        }

        if (data) {
          const shortUrl = getShortUrl(data.short_code)
          try { await navigator.clipboard.writeText(shortUrl) } catch { /* clipboard unavailable */ }
          setSuccess('Link created and copied to clipboard!')
          onLinkCreated(data)
          // Persist anonymous link ID for retrieval after page reload
          if (!user && data) {
            try {
              const stored = JSON.parse(localStorage.getItem('anon_links') || '[]') as string[]
              stored.unshift(data.id)
              localStorage.setItem('anon_links', JSON.stringify(stored.slice(0, 50)))
            } catch { /* localStorage unavailable */ }
          }
          resetForm()
          setTimeout(() => setSuccess(''), 3000)
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create link')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Shorten Your URL</h2>
          <p className="text-gray-600">Create a short, memorable link in seconds</p>
        </div>

        {!user && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <a href="/login" className="font-semibold underline">Sign in</a> to save and manage your links
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        {detectedPlatform && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-purple-800">
                <strong>{detectedPlatform}</strong> deep links detected and configured automatically!
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAdvanced(true)}
              className="text-purple-600 hover:text-purple-800 text-sm font-medium"
            >
              View settings
            </button>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
              Long URL
            </label>
            <input
              id="url"
              type="url"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://example.com/very-long-url"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label htmlFor="custom" className="block text-sm font-medium text-gray-700 mb-2">
              Custom short code (optional)
            </label>
            <div className="flex rounded-lg overflow-hidden border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
              <span className="bg-gray-50 px-4 py-3 text-gray-600 border-r border-gray-300">
                {process.env.NEXT_PUBLIC_SHORT_DOMAIN || 'tws.bio'}/
              </span>
              <input
                id="custom"
                type="text"
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="custom-link"
                className="flex-1 px-4 py-3 focus:outline-none"
                pattern="[a-z0-9-]+"
              />
            </div>
          </div>

          {/* Advanced Options */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
            >
              <svg 
                className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Advanced Options (Deep Linking)
            </button>
          </div>

          {showAdvanced && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Link Type
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="url"
                      checked={linkType === 'url'}
                      onChange={(e) => setLinkType(e.target.value as 'url')}
                      className="mr-2"
                    />
                    <span className="text-sm">Regular URL</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="deep_link"
                      checked={linkType === 'deep_link'}
                      onChange={(e) => setLinkType(e.target.value as 'deep_link')}
                      className="mr-2"
                    />
                    <span className="text-sm">Deep Link (Mobile App)</span>
                  </label>
                </div>
              </div>

              {linkType === 'deep_link' && (
                <>
                  <div>
                    <label htmlFor="ios" className="block text-sm font-medium text-gray-700 mb-2">
                      iOS Deep Link {autoDetected && <span className="text-purple-600">(Auto-detected)</span>}
                    </label>
                    <input
                      id="ios"
                      type="text"
                      value={iosDeepLink}
                      onChange={(e) => {
                        setIosDeepLink(e.target.value)
                        setAutoDetected(false)
                      }}
                      placeholder="myapp://screen/path"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label htmlFor="android" className="block text-sm font-medium text-gray-700 mb-2">
                      Android Deep Link {autoDetected && <span className="text-purple-600">(Auto-detected)</span>}
                    </label>
                    <input
                      id="android"
                      type="text"
                      value={androidDeepLink}
                      onChange={(e) => {
                        setAndroidDeepLink(e.target.value)
                        setAutoDetected(false)
                      }}
                      placeholder="myapp://screen/path"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label htmlFor="fallback" className="block text-sm font-medium text-gray-700 mb-2">
                      Fallback URL {autoDetected && <span className="text-purple-600">(Auto-detected)</span>}
                    </label>
                    <input
                      id="fallback"
                      type="url"
                      value={fallbackUrl}
                      onChange={(e) => {
                        setFallbackUrl(e.target.value)
                        setAutoDetected(false)
                      }}
                      placeholder="https://app-store-link.com"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Where to redirect if the app is not installed
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading ? 'Creating...' : linkType === 'deep_link' ? 'Create Deep Link' : 'Shorten URL'}
        </button>
      </form>
    </div>
  )
}