'use client'

import { useState, useRef } from 'react'
import { cn, generateShortCode, isValidUrl, getShortUrl } from '@/lib/utils'
import { toast } from 'sonner'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button, buttonVariants } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TickerChip } from '@/components/TickerChip'
import { useAuth } from '@/hooks/useAuth'
import type { HomeLink } from '@/hooks/useLinks'

type FieldName = 'url' | 'customCode' | 'iosDeepLink' | 'androidDeepLink' | 'fallbackUrl'
type FieldErrors = Partial<Record<FieldName, string>>

// Sentinel for "no campaign selected" — the Select needs a non-empty value.
const NO_CAMPAIGN = 'none'

interface CreatedLink {
  shortCode: string
  /** HH:MM:SS UTC, captured client-side at creation time. */
  filledAt: string
  destHost: string
  copied: boolean
}

// Destination host for the execution ticket row: bare hostname, www. stripped,
// truncated so the mono label can't wrap on mobile.
function formatDestHost(rawUrl: string): string {
  let host: string
  try {
    host = new URL(rawUrl).hostname.replace(/^www\./, '')
  } catch {
    host = rawUrl
  }
  return host.length > 30 ? `${host.slice(0, 29)}…` : host
}

interface CreateLinkFormProps {
  /**
   * Server-resolved user, passed by routes (e.g. the dashboard create page)
   * that already redirect unauthenticated visitors before rendering this
   * form. Lets the form render immediately instead of showing the sign-in
   * gate while client auth resolves; once useAuth resolves client-side, its
   * result takes over as the source of truth.
   */
  initialUser?: { id: string } | null
  /** Called with the created row so a parent list can prepend it. */
  onCreated?: (link: HomeLink) => void
}

export function CreateLinkForm({ initialUser = null, onCreated }: CreateLinkFormProps) {
  const { user: authUser, loading: authLoading } = useAuth()
  const user = initialUser && authLoading ? initialUser : authUser
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
  const [selectedCampaignId, setSelectedCampaignId] = useState(NO_CAMPAIGN)
  const [newCampaignName, setNewCampaignName] = useState('')
  const [createdLink, setCreatedLink] = useState<CreatedLink | null>(null)
  const latestUrlRef = useRef('')
  const campaignsLoadedRef = useRef(false)

  const clearFieldError = (field: FieldName) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  // Deferred until the selector is first opened, so users who never touch the
  // optional campaign field don't pay the query on mount.
  const loadCampaigns = async () => {
    if (campaignsLoadedRef.current) return
    campaignsLoadedRef.current = true
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { data, error } = await supabase
      .from('campaigns')
      .select('id, name')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('Failed to load campaigns:', error)
      campaignsLoadedRef.current = false // allow a retry on the next open
      return
    }
    setCampaigns(data || [])
  }

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

  // Success: swap the form for the execution ticket. The row is computed
  // client-side at creation time (FILLED · HH:MM:SS UTC · → destination-host).
  const showTicket = (link: HomeLink, copied: boolean) => {
    setCreatedLink({
      shortCode: link.short_code,
      filledAt: new Date().toISOString().slice(11, 19),
      destHost: formatDestHost(link.original_url),
      copied,
    })
    onCreated?.(link)
    setLoading(false)
  }

  const resetForm = () => {
    setCreatedLink(null)
    setUrl('')
    latestUrlRef.current = ''
    setCustomCode('')
    setLinkType('url')
    setIosDeepLink('')
    setAndroidDeepLink('')
    setFallbackUrl('')
    setDetectedPlatform(null)
    setAutoDetected(false)
    setShowAdvanced(false)
    setSelectedCampaignId(NO_CAMPAIGN)
    setNewCampaignName('')
    setFieldErrors({})
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

    try {
      // Dynamic import keeps supabase-js out of the static home-page bundle
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
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
      } else if (selectedCampaignId !== NO_CAMPAIGN && selectedCampaignId !== '__new__') {
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
          let copied = false
          try {
            await navigator.clipboard.writeText(shortUrl)
            copied = true
          } catch {
            // The execution ticket remains visible with its own copy control.
          }
          if (campaignFailed) {
            toast.warning('Deep link created, but could not assign it to the campaign.')
          } else if (copied) {
            toast.success('Deep link created and copied to clipboard!')
          } else {
            toast.success('Deep link created. Copy it from the ticket below.')
          }
          showTicket(data, copied)
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
          let copied = false
          try {
            await navigator.clipboard.writeText(shortUrl)
            copied = true
          } catch {
            // The execution ticket remains visible with its own copy control.
          }
          if (campaignFailed) {
            toast.warning('Link created, but could not assign it to the campaign.')
          } else if (copied) {
            toast.success('Link created and copied to clipboard!')
          } else {
            toast.success('Link created. Copy it from the ticket below.')
          }
          showTicket(data, copied)
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

      // Only clear loading on failure — on success the ticket replaces the
      // form, so the double-submit window is closed either way.
      setLoading(false)
    }
  }

  // Link creation requires authentication. The sign-in gate is the optimistic
  // default while client auth state resolves (anonymous is the common case on
  // the marketing page — no skeleton, no title flicker); the form appears once
  // a session is present. Routes that already resolved auth server-side (e.g.
  // the dashboard create route) pass initialUser to render the form directly.
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

  // Execution ticket: the success state. The one-time green fill flash is the
  // creation signal (collapsed by the global reduced-motion backstop).
  if (createdLink) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="bg-card border-border">
          <CardContent>
            <div role="status" className="rounded-lg space-y-3">
              <TickerChip
                code={createdLink.shortCode}
                flashOnMount
                copiedOnMount={createdLink.copied}
              />
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                FILLED · {createdLink.filledAt} UTC · → {createdLink.destHost}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 mt-6">
              <Button type="button" onClick={resetForm} className="h-10 px-6">
                Create another
              </Button>
              <a href="/dashboard" className={cn(buttonVariants({ variant: 'outline' }), 'h-10 px-6')}>
                View in dashboard
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const campaignOptions = [
    { value: NO_CAMPAIGN, label: 'No campaign' },
    ...campaigns.map((c) => ({ value: c.id, label: c.name })),
    { value: '__new__', label: '+ New campaign...' },
  ]

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
                <Select
                  value={selectedCampaignId}
                  onValueChange={(v) => setSelectedCampaignId(v || NO_CAMPAIGN)}
                  onOpenChange={(open) => {
                    if (open) void loadCampaigns()
                  }}
                >
                  <SelectTrigger
                    id="campaign"
                    className="w-full data-[size=default]:h-10 bg-muted dark:bg-muted dark:hover:bg-muted"
                  >
                    <SelectValue options={campaignOptions} />
                  </SelectTrigger>
                  <SelectContent>
                    {campaignOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    className={`w-4 h-4 ${showAdvanced ? 'rotate-90' : ''}`}
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
                        <RadioGroupItem value="url" id="type-url" />
                        <Label htmlFor="type-url" className="font-normal cursor-pointer">Regular URL</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="deep_link" id="type-deep" />
                        <Label htmlFor="type-deep" className="font-normal cursor-pointer">Deep Link (Mobile App)</Label>
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
