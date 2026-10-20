'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { cn, generateShortCode, isValidUrl, getShortUrl, normalizeUrl } from '@/lib/utils'
import { isSafeUrl } from '@/lib/redirectSafety'
import { isReservedShortCode } from '@/lib/shortCodes'
import { toast } from 'sonner'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
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

type FieldName = 'url' | 'customCode' | 'campaignName' | 'iosDeepLink' | 'androidDeepLink' | 'fallbackUrl'
type FieldErrors = Partial<Record<FieldName, string>>

// Input id for each field, in on-screen order. The form is noValidate, so the
// browser no longer moves focus to a bad field; a failed submit does it instead.
const FIELD_INPUT_IDS: Record<FieldName, string> = {
  url: 'url',
  customCode: 'custom',
  campaignName: 'new-campaign',
  iosDeepLink: 'ios',
  androidDeepLink: 'android',
  fallbackUrl: 'fallback',
}

// Sentinels for the campaign Select, which needs a non-empty value.
const NO_CAMPAIGN = 'none'
const NEW_CAMPAIGN = '__new__'

const DEEP_LINK_ERROR = 'Use a supported app scheme (such as instagram://) or an https:// link.'

// The owner works in India and the dashboard files days in IST, so the ticket
// clock reads IST too. en-GB with a 24-hour cycle gives HH:MM:SS.
const TICKET_TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

interface CreatedLink {
  /** Row id, for the ticket's link to this link's stats page. */
  id: string
  shortCode: string
  /** HH:MM:SS in India time (IST), captured client-side at creation time. */
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
  /**
   * Show the card's own heading (default true). A page that already has an h1
   * for the form, such as /dashboard/create, passes false so the title is not
   * said twice.
   */
  showHeader?: boolean
}

export function CreateLinkForm({ initialUser = null, onCreated, showHeader = true }: CreateLinkFormProps) {
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
    const loaded = data || []
    // Keep a campaign this form created while the list was still loading.
    setCampaigns((prev) => [...prev.filter((c) => !loaded.some((l) => l.id === c.id)), ...loaded])
  }

  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl)
    clearFieldError('url')
    // Track the latest input synchronously so stale async detections can bail out
    latestUrlRef.current = newUrl
    // Detect on the completed form, so a pasted `youtube.com/watch?v=...` gets
    // its deep links before blur (or submit) adds the scheme to the field.
    const candidate = normalizeUrl(newUrl)

    if (candidate && isValidUrl(candidate)) {
      // Dynamically import the deep-link map so it stays out of the initial bundle
      void (async () => {
        const { detectDeepLinks } = await import('@/lib/deeplinks')
        // A newer input superseded this one during the await; drop the stale result
        if (latestUrlRef.current !== newUrl) return
        const deepLinkConfig = detectDeepLinks(candidate)

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
        // Deep-link chunk failed to load (offline/network). Detection is a
        // best-effort enhancement, so silently skip rather than reject.
      })
    } else if (autoDetected) {
      // URL cleared or invalidated: clear any previously auto-detected state
      setIosDeepLink('')
      setAndroidDeepLink('')
      setFallbackUrl('')
      setLinkType('url')
      setDetectedPlatform(null)
      setAutoDetected(false)
    }
  }

  // Success: swap the form for the execution ticket. The row is computed
  // client-side at creation time (FILLED · HH:MM:SS IST · → destination-host).
  const showTicket = (link: HomeLink, copied: boolean) => {
    setCreatedLink({
      id: link.id,
      shortCode: link.short_code,
      filledAt: TICKET_TIME.format(new Date()),
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

    // Every check runs here, before any request: the form is noValidate. Enter
    // submits without a blur, so a pasted bare host is completed here as well.
    const destination = normalizeUrl(url)
    const fallback = normalizeUrl(fallbackUrl)
    const iosLink = iosDeepLink.trim()
    const androidLink = androidDeepLink.trim()
    if (destination !== url) setUrl(destination)
    if (fallback !== fallbackUrl) setFallbackUrl(fallback)

    const errors: FieldErrors = {}
    if (!isValidUrl(destination)) errors.url = 'Please enter a valid URL'
    // A code that names an app route is saved but never redirects, because
    // the route matches before [shortCode] does.
    if (customCode && isReservedShortCode(customCode)) {
      errors.customCode = `Short code "${customCode}" is reserved. Please choose another.`
    }
    if (selectedCampaignId === NEW_CAMPAIGN && !newCampaignName.trim()) {
      errors.campaignName = 'Please enter a campaign name'
    }
    // The redirect quietly skips a deep link or fallback it will not follow,
    // so refuse those now, while the owner can still fix them. These fields
    // are only sent, and only shown, for a deep link.
    if (linkType === 'deep_link') {
      if (iosLink && !isSafeUrl(iosLink)) errors.iosDeepLink = DEEP_LINK_ERROR
      if (androidLink && !isSafeUrl(androidLink)) errors.androidDeepLink = DEEP_LINK_ERROR
      if (fallback && !isValidUrl(fallback)) errors.fallbackUrl = 'Please enter a valid fallback URL'
    }

    const firstInvalid = (Object.keys(FIELD_INPUT_IDS) as FieldName[]).find((field) => errors[field])
    if (firstInvalid) {
      setFieldErrors(errors)
      if (errors.iosDeepLink || errors.androidDeepLink || errors.fallbackUrl) setShowAdvanced(true)
      toast.error(errors[firstInvalid])
      // Wait a frame so the error, and the advanced panel if it was closed, is rendered.
      requestAnimationFrame(() => document.getElementById(FIELD_INPUT_IDS[firstInvalid])?.focus())
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
      if (user && selectedCampaignId === NEW_CAMPAIGN) {
        const { data: newCampaign, error: campaignError } = await supabase
          .from('campaigns')
          .insert({ name: newCampaignName.trim(), user_id: user.id })
          .select('id, name')
          .single()
        if (campaignError) throw new Error(campaignError.message)
        campaignId = newCampaign.id
        // The campaign exists now, whatever happens to the link. Select it in
        // place of "+ New campaign" so a retry after a failed create reuses it
        // instead of inserting a duplicate.
        setCampaigns((prev) => [newCampaign, ...prev.filter((c) => c.id !== newCampaign.id)])
        setSelectedCampaignId(newCampaign.id)
        setNewCampaignName('')
      } else if (selectedCampaignId !== NO_CAMPAIGN && selectedCampaignId !== NEW_CAMPAIGN) {
        campaignId = selectedCampaignId
      }

      if (linkType === 'deep_link') {
        const { data, error: rpcError } = await supabase.rpc('create_deep_link', {
          p_short_code: shortCode,
          p_original_url: destination,
          p_user_id: user?.id,
          p_ios_deep_link: iosLink || undefined,
          p_android_deep_link: androidLink || undefined,
          p_fallback_url: fallback || undefined,
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
            toast.success('Deep link created and copied to clipboard.')
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
          p_original_url: destination,
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
            toast.success('Link created and copied to clipboard.')
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
      } else if (/short[ _]code/i.test(message)) {
        // `short_code` also catches a check-constraint error that names the column.
        setFieldErrors((prev) => ({ ...prev, customCode: message }))
      } else if (/url must start with/i.test(message)) {
        setFieldErrors((prev) => ({ ...prev, url: message }))
      }

      // Only clear loading on failure. On success the ticket replaces the
      // form, so the double-submit window is closed either way.
      setLoading(false)
    }
  }

  // Link creation requires authentication. The sign-in gate is the optimistic
  // default while client auth state resolves (anonymous is the common case on
  // the marketing page: no skeleton, no title flicker); the form appears once
  // a session is present. Routes that already resolved auth server-side (e.g.
  // the dashboard create route) pass initialUser to render the form directly.
  // Signups are disabled on the project, so the gate offers only Sign in.
  if (!user) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h2 className="font-heading text-xl leading-snug font-medium text-foreground">
                Sign in to shorten URLs
              </h2>
              <p className="text-sm text-muted-foreground">
                Short links, deep links and campaigns, saved to your dashboard with click analytics. Accounts are invite-only.
              </p>
            </div>
            <Link href="/login" className={cn(buttonVariants({ size: 'lg' }), 'shrink-0 px-6')}>
              Sign in
            </Link>
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
                FILLED · {createdLink.filledAt} IST · → {createdLink.destHost}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 mt-6">
              <Button type="button" size="lg" onClick={resetForm}>
                Create another
              </Button>
              <a
                href={`/dashboard/links/${createdLink.id}`}
                className={buttonVariants({ variant: 'outline', size: 'lg' })}
              >
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
    { value: NEW_CAMPAIGN, label: '+ New campaign...' },
  ]

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="bg-card border-border">
        {showHeader && (
          <CardHeader>
            {/* A real h2, the same pattern as the sign-in gate and AuthShell. */}
            <h2
              data-slot="card-title"
              className="font-heading text-xl leading-snug font-medium text-foreground"
            >
              Shorten a URL
            </h2>
          </CardHeader>
        )}
        <CardContent>
          <form
            onSubmit={handleSubmit}
            noValidate
            aria-label={showHeader ? undefined : 'Shorten a URL'}
          >
            {/* Always mounted, so screen readers announce the banner when
                detection switches the link to a deep link. */}
            <div role="status">
              {detectedPlatform && (
                <div className="mb-5 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/10 px-4 py-3">
                  <svg className="size-5 shrink-0 text-primary-text" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-primary-text">
                    <strong>{detectedPlatform}</strong> deep links detected and filled in.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {/* URL input row */}
              <div>
                <Label htmlFor="url" className="mb-2">Long URL</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="url"
                    type="url"
                    value={url}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    onBlur={() => {
                      // Complete a pasted bare host (`example.com`) once focus leaves.
                      const normalized = normalizeUrl(url)
                      if (normalized !== url) handleUrlChange(normalized)
                    }}
                    placeholder="https://example.com/very-long-url"
                    className="sm:flex-1"
                    aria-invalid={!!fieldErrors.url}
                    aria-describedby={fieldErrors.url ? 'url-error' : undefined}
                    required
                  />
                  <Button type="submit" disabled={loading} className="w-full px-6 sm:w-auto">
                    {loading ? 'Creating...' : linkType === 'deep_link' ? 'Create deep link' : 'Shorten'}
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
                  <span className="inline-flex items-center rounded-l-lg border border-r-0 border-input bg-muted px-3 font-mono text-sm text-muted-foreground">
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
                    className="rounded-l-none font-mono"
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
                  onValueChange={(v) => {
                    setSelectedCampaignId(v || NO_CAMPAIGN)
                    clearFieldError('campaignName')
                  }}
                  onOpenChange={(open) => {
                    if (open) void loadCampaigns()
                  }}
                >
                  <SelectTrigger
                    id="campaign"
                    className="w-full"
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
                {selectedCampaignId === NEW_CAMPAIGN && (
                  <>
                    <Input
                      id="new-campaign"
                      type="text"
                      value={newCampaignName}
                      onChange={(e) => {
                        setNewCampaignName(e.target.value)
                        clearFieldError('campaignName')
                      }}
                      placeholder="Campaign name"
                      aria-label="New campaign name"
                      className="mt-2"
                      aria-invalid={!!fieldErrors.campaignName}
                      aria-describedby={fieldErrors.campaignName ? 'campaign-name-error' : undefined}
                    />
                    {fieldErrors.campaignName && (
                      <p id="campaign-name-error" role="alert" className="mt-1.5 text-xs text-destructive">
                        {fieldErrors.campaignName}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Advanced options toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  aria-expanded={showAdvanced}
                  aria-controls="advanced-options"
                  className="flex min-h-11 items-center gap-1 rounded-sm text-sm font-medium text-primary-text hover:text-primary-text/80 focus-ring sm:min-h-0"
                >
                  <svg
                    className={`w-4 h-4 ${showAdvanced ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Advanced options (deep linking)
                </button>
              </div>

              {showAdvanced && (
                <div id="advanced-options" className="space-y-4 rounded-lg border border-border p-4">
                  <div>
                    <Label id="link-type-label" className="mb-3">Link type</Label>
                    <RadioGroup
                      aria-labelledby="link-type-label"
                      value={linkType}
                      onValueChange={(val) => setLinkType(val as 'url' | 'deep_link')}
                      className="flex flex-col gap-0 sm:flex-row sm:gap-6"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="url" id="type-url" className="border-muted-foreground/70" />
                        <Label htmlFor="type-url" className="min-h-11 flex-1 font-normal cursor-pointer sm:min-h-0 sm:flex-none">Regular URL</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="deep_link" id="type-deep" className="border-muted-foreground/70" />
                        <Label htmlFor="type-deep" className="min-h-11 flex-1 font-normal cursor-pointer sm:min-h-0 sm:flex-none">Deep link (mobile app)</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {linkType === 'deep_link' && (
                    <>
                      <div>
                        <Label htmlFor="ios" className="mb-2">
                          iOS deep link {autoDetected && <span className="text-primary-text">(auto-detected)</span>}
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
                          placeholder="instagram://user?username=name"
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
                          Android deep link {autoDetected && <span className="text-primary-text">(auto-detected)</span>}
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
                          placeholder="instagram://user?username=name"
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
                          Fallback URL {autoDetected && <span className="text-primary-text">(auto-detected)</span>}
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
                          onBlur={() => {
                            const normalized = normalizeUrl(fallbackUrl)
                            if (normalized !== fallbackUrl) setFallbackUrl(normalized)
                          }}
                          placeholder="https://app-store-link.com"
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
