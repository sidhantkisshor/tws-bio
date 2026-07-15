'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn, generateShortCode, isValidUrl, getShortUrl } from '@/lib/utils'
import { toast } from 'sonner'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button, buttonVariants } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useAuth } from '@/hooks/useAuth'

type FieldName = 'url' | 'customCode' | 'iosDeepLink' | 'androidDeepLink' | 'fallbackUrl'
type FieldErrors = Partial<Record<FieldName, string>>

interface CreateLinkFormProps {
  /**
   * Server-resolved user, passed by routes (e.g. the dashboard create page)
   * that already redirect unauthenticated visitors before rendering this
   * form. Lets the form skip its own client-side auth loading skeleton and
   * sign-in gate on first paint; once useAuth resolves client-side, its
   * result takes over as the source of truth.
   */
  initialUser?: { id: string } | null
}

export function CreateLinkForm({ initialUser = null }: CreateLinkFormProps) {
  const router = useRouter()
  const { user: authUser, loading: authLoading } = useAuth()
  const user = initialUser && authLoading ? initialUser : authUser
  const showAuthSkeleton = !initialUser && authLoading
  const [url, setUrl] = useState('')
  const [customCode, setCustomCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
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

  const clearFieldError = (field: FieldName) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  useEffect(() => {
    if (!user) return
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
  }, [user])

  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl)
    clearFieldError('url')
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
      })().catch(() => {
        // Deep-link chunk failed to load (offline/network) — detection is a
        // best-effort enhancement, so silently skip rather than reject.
      })
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

    // Guard against double submits: a second Enter press or click while the
    // first request is still in flight must be a no-op, not a duplicate RPC.
    if (loading) return

    if (!isValidUrl(url)) {
      setFieldErrors((prev) => ({ ...prev, url: 'Please enter a valid URL' }))
      toast.error('Please enter a valid URL')
      return
    }

    setFieldErrors({})
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
          const shortUrl = getShortUrl(data.short_code)
          try { await navigator.clipboard.writeText(shortUrl) } catch { /* clipboard unavailable */ }
          if (campaignFailed) {
            toast.warning('Deep link created, but could not assign it to the campaign.')
          } else {
            toast.success('Deep link created and copied to clipboard!')
          }
          // Keep the form disabled through the redirect delay so a fast
          // second submit can't fire before navigation actually happens.
          setTimeout(() => router.push('/dashboard'), 1500)
        } else {
          toast.error('Failed to create link. Please try again.')
          setLoading(false)
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
          const shortUrl = getShortUrl(data.short_code)
          try { await navigator.clipboard.writeText(shortUrl) } catch { /* clipboard unavailable */ }
          if (campaignFailed) {
            toast.warning('Link created, but could not assign it to the campaign.')
          } else {
            toast.success('Link created and copied to clipboard!')
          }
          // Keep the form disabled through the redirect delay so a fast
          // second submit can't fire before navigation actually happens.
          setTimeout(() => router.push('/dashboard'), 1500)
        } else {
          toast.error('Failed to create link. Please try again.')
          setLoading(false)
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create link'
      toast.error(message)

      // Surface backend rejections inline on the offending field, in
      // addition to the toast.
      if (/fallback url/i.test(message)) {
        setFieldErrors((prev) => ({ ...prev, fallbackUrl: message }))
        setShowAdvanced(true)
      } else if (/ios deep link/i.test(message)) {
        setFieldErrors((prev) => ({ ...prev, iosDeepLink: message }))
        setShowAdvanced(true)
      } else if (/android deep link/i.test(message)) {
        setFieldErrors((prev) => ({ ...prev, androidDeepLink: message }))
        setShowAdvanced(true)
      } else if (/short code/i.test(message)) {
        setFieldErrors((prev) => ({ ...prev, customCode: message }))
      } else if (/url must start with/i.test(message)) {
        setFieldErrors((prev) => ({ ...prev, url: message }))
      }

      // Only clear loading on failure — on success the form should stay
      // disabled through the pending redirect (see setTimeout above).
      setLoading(false)
    }
  }

  // Link creation requires authentication. While client auth state resolves,
  // show a neutral placeholder; once resolved, gate anonymous visitors behind
  // sign-in. Callers that already resolved auth server-side (e.g. the
  // dashboard create route) pass initialUser to skip this skeleton entirely.
  if (showAuthSkeleton) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-xl text-foreground">Shorten Your URL</CardTitle>
            <CardDescription>Create a short, memorable link in seconds</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-10 w-full bg-muted animate-pulse rounded-lg" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-xl text-foreground">Sign in to shorten URLs</CardTitle>
            <CardDescription>
              Create an account or sign in to create short links, deep links, and campaigns — all saved to your dashboard with analytics.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <a href="/login" className={cn(buttonVariants(), 'h-10 px-6')}>
              Sign in
            </a>
            <a href="/signup" className={cn(buttonVariants({ variant: 'outline' }), 'h-10 px-6')}>
              Create account
            </a>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-xl text-foreground">Shorten Your URL</CardTitle>
          <CardDescription>Create a short, memorable link in seconds</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {detectedPlatform && (
              <div className="rounded-lg border border-primary/20 bg-primary/10 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-primary-text">
                    <strong>{detectedPlatform}</strong> deep links detected and configured automatically!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(true)}
                  className="text-primary-text hover:text-primary-text/80 text-sm font-medium"
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
                    aria-invalid={!!fieldErrors.url}
                    aria-describedby={fieldErrors.url ? 'url-error' : undefined}
                    required
                  />
                  <Button type="submit" disabled={loading} className="h-10 px-6">
                    {loading ? 'Creating...' : linkType === 'deep_link' ? 'Create Deep Link' : 'Shorten'}
                  </Button>
                </div>
                {fieldErrors.url && (
                  <p id="url-error" role="alert" className="mt-1.5 text-xs text-destructive">
                    {fieldErrors.url}
                  </p>
                )}
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
                    onChange={(e) => {
                      setCustomCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                      clearFieldError('customCode')
                    }}
                    placeholder="custom-link"
                    className="rounded-l-none bg-muted h-10"
                    pattern="[a-z0-9-]+"
                    aria-invalid={!!fieldErrors.customCode}
                    aria-describedby={fieldErrors.customCode ? 'custom-code-error' : undefined}
                  />
                </div>
                {fieldErrors.customCode && (
                  <p id="custom-code-error" role="alert" className="mt-1.5 text-xs text-destructive">
                    {fieldErrors.customCode}
                  </p>
                )}
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
                  className="text-sm text-primary-text hover:text-primary-text/80 font-medium flex items-center gap-1"
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
                          iOS Deep Link {autoDetected && <span className="text-primary-text">(Auto-detected)</span>}
                        </Label>
                        <Input
                          id="ios"
                          type="text"
                          value={iosDeepLink}
                          onChange={(e) => {
                            setIosDeepLink(e.target.value)
                            setAutoDetected(false)
                            clearFieldError('iosDeepLink')
                          }}
                          placeholder="myapp://screen/path"
                          className="bg-muted h-10"
                          aria-invalid={!!fieldErrors.iosDeepLink}
                          aria-describedby={fieldErrors.iosDeepLink ? 'ios-error' : undefined}
                        />
                        {fieldErrors.iosDeepLink && (
                          <p id="ios-error" role="alert" className="mt-1.5 text-xs text-destructive">
                            {fieldErrors.iosDeepLink}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="android" className="mb-2">
                          Android Deep Link {autoDetected && <span className="text-primary-text">(Auto-detected)</span>}
                        </Label>
                        <Input
                          id="android"
                          type="text"
                          value={androidDeepLink}
                          onChange={(e) => {
                            setAndroidDeepLink(e.target.value)
                            setAutoDetected(false)
                            clearFieldError('androidDeepLink')
                          }}
                          placeholder="myapp://screen/path"
                          className="bg-muted h-10"
                          aria-invalid={!!fieldErrors.androidDeepLink}
                          aria-describedby={fieldErrors.androidDeepLink ? 'android-error' : undefined}
                        />
                        {fieldErrors.androidDeepLink && (
                          <p id="android-error" role="alert" className="mt-1.5 text-xs text-destructive">
                            {fieldErrors.androidDeepLink}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="fallback" className="mb-2">
                          Fallback URL {autoDetected && <span className="text-primary-text">(Auto-detected)</span>}
                        </Label>
                        <Input
                          id="fallback"
                          type="url"
                          value={fallbackUrl}
                          onChange={(e) => {
                            setFallbackUrl(e.target.value)
                            setAutoDetected(false)
                            clearFieldError('fallbackUrl')
                          }}
                          placeholder="https://app-store-link.com"
                          className="bg-muted h-10"
                          aria-invalid={!!fieldErrors.fallbackUrl}
                          aria-describedby={fieldErrors.fallbackUrl ? 'fallback-error' : 'fallback-hint'}
                        />
                        {fieldErrors.fallbackUrl && (
                          <p id="fallback-error" role="alert" className="mt-1.5 text-xs text-destructive">
                            {fieldErrors.fallbackUrl}
                          </p>
                        )}
                        <p id="fallback-hint" className="text-xs text-muted-foreground mt-1">Where to redirect if the app is not installed</p>
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
