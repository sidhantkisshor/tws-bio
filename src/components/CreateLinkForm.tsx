'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { generateShortCode, isValidUrl, getShortUrl } from '@/lib/utils'
import { toast } from 'sonner'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useAuth } from '@/hooks/useAuth'
import { saveAnonLinkId } from '@/hooks/useLinks'

export function CreateLinkForm() {
  const router = useRouter()
  const { user } = useAuth()
  const [url, setUrl] = useState('')
  const [customCode, setCustomCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [linkType, setLinkType] = useState<'url' | 'deep_link'>('url')
  const [iosDeepLink, setIosDeepLink] = useState('')
  const [androidDeepLink, setAndroidDeepLink] = useState('')
  const [fallbackUrl, setFallbackUrl] = useState('')
  const [detectedPlatform, setDetectedPlatform] = useState<string | null>(null)
  const [autoDetected, setAutoDetected] = useState(false)
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState('')
  const [newCampaignName, setNewCampaignName] = useState('')
  const latestUrlRef = useRef('')

  useEffect(() => {
    async function loadCampaigns() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('campaigns')
        .select('id, name')
        .order('created_at', { ascending: false })
      if (error) console.error('Failed to load campaigns:', error)
      setCampaigns(data || [])
    }
    loadCampaigns()
  }, [])

  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl)
    // Track the latest input synchronously so stale async detections can bail out
    latestUrlRef.current = newUrl

    if (newUrl && isValidUrl(newUrl)) {
      // Dynamically import the deep-link map so it stays out of the initial bundle
      void (async () => {
        const { detectDeepLinks } = await import('@/lib/deeplinks')
        // A newer input superseded this one during the await; drop the stale result
        if (latestUrlRef.current !== newUrl) return
        const deepLinkConfig = detectDeepLinks(newUrl)

        if (deepLinkConfig) {
          setDetectedPlatform(deepLinkConfig.platform)
          setAutoDetected(true)
          if (!iosDeepLink || autoDetected) setIosDeepLink(deepLinkConfig.ios || '')
          if (!androidDeepLink || autoDetected) setAndroidDeepLink(deepLinkConfig.android || '')
          if (!fallbackUrl || autoDetected) setFallbackUrl(deepLinkConfig.fallback)
          setLinkType('deep_link')
          setShowAdvanced(true)
        } else if (autoDetected) {
          setIosDeepLink('')
          setAndroidDeepLink('')
          setFallbackUrl('')
          setLinkType('url')
          setDetectedPlatform(null)
          setAutoDetected(false)
        }
      })()
    } else if (autoDetected) {
      // URL cleared or invalidated — clear any previously auto-detected state
      setIosDeepLink('')
      setAndroidDeepLink('')
      setFallbackUrl('')
      setLinkType('url')
      setDetectedPlatform(null)
      setAutoDetected(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isValidUrl(url)) {
      toast.error('Please enter a valid URL')
      return
    }

    setLoading(true)
    const supabase = createClient()

    try {
      const { data: { user } } = await supabase.auth.getUser()

      const shortCode = customCode || generateShortCode()

      // Resolve campaign ID (create new campaign if needed, only for logged-in users)
      let campaignId: string | undefined = undefined
      if (user && selectedCampaignId === '__new__' && newCampaignName.trim()) {
        const { data: newCampaign, error: campaignError } = await supabase
          .from('campaigns')
          .insert({ name: newCampaignName.trim(), user_id: user.id })
          .select('id')
          .single()
        if (campaignError) throw new Error(campaignError.message)
        campaignId = newCampaign.id
      } else if (selectedCampaignId && selectedCampaignId !== '__new__') {
        campaignId = selectedCampaignId
      }

      if (linkType === 'deep_link') {
        const { data, error: rpcError } = await supabase.rpc('create_deep_link', {
          p_short_code: shortCode,
          p_original_url: url,
          p_user_id: user?.id,
          p_ios_deep_link: iosDeepLink || undefined,
          p_android_deep_link: androidDeepLink || undefined,
          p_fallback_url: fallbackUrl || undefined,
        })

        if (rpcError) throw new Error(rpcError.message)
        if (data) {
          let campaignFailed = false
          if (campaignId) {
            const { error: campaignErr } = await supabase.from('links').update({ campaign_id: campaignId }).eq('id', data.id)
            if (campaignErr) campaignFailed = true
          }
          if (!user) saveAnonLinkId(data.id)
          const shortUrl = getShortUrl(data.short_code)
          try { await navigator.clipboard.writeText(shortUrl) } catch { /* clipboard unavailable */ }
          if (campaignFailed) {
            toast.warning('Deep link created, but could not assign it to the campaign.')
          } else {
            toast.success('Deep link created and copied to clipboard!')
          }
          if (user) setTimeout(() => router.push('/dashboard'), 1500)
        }
      } else {
        const { data, error: rpcError } = await supabase.rpc('create_link', {
          p_short_code: shortCode,
          p_original_url: url,
          p_user_id: user?.id,
        })

        if (rpcError) throw new Error(rpcError.message)
        if (data) {
          let campaignFailed = false
          if (campaignId) {
            const { error: campaignErr } = await supabase.from('links').update({ campaign_id: campaignId }).eq('id', data.id)
            if (campaignErr) campaignFailed = true
          }
          if (!user) saveAnonLinkId(data.id)
          const shortUrl = getShortUrl(data.short_code)
          try { await navigator.clipboard.writeText(shortUrl) } catch { /* clipboard unavailable */ }
          if (campaignFailed) {
            toast.warning('Link created, but could not assign it to the campaign.')
          } else {
            toast.success('Link created and copied to clipboard!')
          }
          if (user) setTimeout(() => router.push('/dashboard'), 1500)
        }
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create link')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-xl text-foreground">Shorten Your URL</CardTitle>
          <CardDescription>Create a short, memorable link in seconds</CardDescription>
        </CardHeader>
        <CardContent>
          {!user && (
            <div className="mb-6 rounded-lg border border-primary/20 bg-primary/10 p-4">
              <p className="text-sm text-primary">
                <a href="/login" className="font-semibold underline underline-offset-4 hover:text-primary/80">Sign in</a>{' '}
                to save links to your dashboard and access analytics.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {detectedPlatform && (
              <div className="rounded-lg border border-primary/20 bg-primary/10 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-primary">
                    <strong>{detectedPlatform}</strong> deep links detected and configured automatically!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(true)}
                  className="text-primary hover:text-primary/80 text-sm font-medium"
                >
                  View settings
                </button>
              </div>
            )}

            <div className="space-y-4">
              {/* URL input row */}
              <div>
                <Label htmlFor="url" className="mb-2">Long URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="url"
                    type="url"
                    value={url}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    placeholder="https://example.com/very-long-url"
                    className="flex-1 bg-muted h-10"
                    required
                  />
                  <Button type="submit" disabled={loading} className="h-10 px-6">
                    {loading ? 'Creating...' : linkType === 'deep_link' ? 'Create Deep Link' : 'Shorten'}
                  </Button>
                </div>
              </div>

              {/* Custom code input */}
              <div>
                <Label htmlFor="custom" className="mb-2">Custom short code (optional)</Label>
                <div className="flex">
                  <span className="inline-flex items-center rounded-l-lg border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                    {process.env.NEXT_PUBLIC_SHORT_DOMAIN || 'tws.bio'}/
                  </span>
                  <Input
                    id="custom"
                    type="text"
                    value={customCode}
                    onChange={(e) => setCustomCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="custom-link"
                    className="rounded-l-none bg-muted h-10"
                    pattern="[a-z0-9-]+"
                  />
                </div>
              </div>

              {/* Campaign selector */}
              <div>
                <Label htmlFor="campaign" className="mb-2">Campaign (optional)</Label>
                <select
                  id="campaign"
                  value={selectedCampaignId}
                  onChange={(e) => setSelectedCampaignId(e.target.value)}
                  className="w-full h-10 rounded-lg border border-input bg-muted px-3 text-sm text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
                >
                  <option value="">No campaign</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                  <option value="__new__">+ New campaign...</option>
                </select>
                {selectedCampaignId === '__new__' && (
                  <Input
                    type="text"
                    value={newCampaignName}
                    onChange={(e) => setNewCampaignName(e.target.value)}
                    placeholder="Campaign name"
                    className="mt-2 bg-muted h-10"
                  />
                )}
              </div>

              {/* Advanced options toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1"
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
                <div className="space-y-4 p-4 bg-muted rounded-lg">
                  <div>
                    <Label className="mb-3">Link Type</Label>
                    <RadioGroup
                      value={linkType}
                      onValueChange={(val) => setLinkType(val as 'url' | 'deep_link')}
                      className="flex gap-6"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="url" />
                        <Label className="font-normal cursor-pointer">Regular URL</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="deep_link" />
                        <Label className="font-normal cursor-pointer">Deep Link (Mobile App)</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {linkType === 'deep_link' && (
                    <>
                      <div>
                        <Label htmlFor="ios" className="mb-2">
                          iOS Deep Link {autoDetected && <span className="text-primary">(Auto-detected)</span>}
                        </Label>
                        <Input
                          id="ios"
                          type="text"
                          value={iosDeepLink}
                          onChange={(e) => { setIosDeepLink(e.target.value); setAutoDetected(false) }}
                          placeholder="myapp://screen/path"
                          className="bg-muted h-10"
                        />
                      </div>
                      <div>
                        <Label htmlFor="android" className="mb-2">
                          Android Deep Link {autoDetected && <span className="text-primary">(Auto-detected)</span>}
                        </Label>
                        <Input
                          id="android"
                          type="text"
                          value={androidDeepLink}
                          onChange={(e) => { setAndroidDeepLink(e.target.value); setAutoDetected(false) }}
                          placeholder="myapp://screen/path"
                          className="bg-muted h-10"
                        />
                      </div>
                      <div>
                        <Label htmlFor="fallback" className="mb-2">
                          Fallback URL {autoDetected && <span className="text-primary">(Auto-detected)</span>}
                        </Label>
                        <Input
                          id="fallback"
                          type="url"
                          value={fallbackUrl}
                          onChange={(e) => { setFallbackUrl(e.target.value); setAutoDetected(false) }}
                          placeholder="https://app-store-link.com"
                          className="bg-muted h-10"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Where to redirect if the app is not installed</p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
