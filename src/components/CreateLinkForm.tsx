'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { ChevronRight } from 'lucide-react'
import { cn, formatDate, generateShortCode, isValidUrl, getShortUrl, normalizeUrl } from '@/lib/utils'
import { isSafeUrl } from '@/lib/redirectSafety'
import { isReservedShortCode } from '@/lib/shortCodes'
import { checkLinkEdit } from '@/lib/linkEdit'
import { destinationKind, type DestinationKind } from '@/lib/destinationKind'
import { toast } from 'sonner'
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
import { AttributionPreview } from '@/components/dashboard/AttributionPreview'
import { useAuth } from '@/hooks/useAuth'
import type { HomeLink } from '@/hooks/useLinks'
import type { Database } from '@/types/database'

// Loaded on the first QR click only, so the QR library stays out of the form's bundle.
const QRCodeDialog = dynamic(
  () => import('@/components/dashboard/QRCodeDialog').then((m) => m.QRCodeDialog),
  { ssr: false, loading: () => null },
)

type LinkUpdate = Database['public']['Tables']['links']['Update']

type FieldName =
  | 'url'
  | 'customCode'
  | 'campaignName'
  | 'expiresOn'
  | 'maxClicks'
  | 'iosDeepLink'
  | 'androidDeepLink'
  | 'fallbackUrl'
type FieldErrors = Partial<Record<FieldName, string>>

// Input id for each field, in on-screen order. The form is noValidate, so the
// browser no longer moves focus to a bad field; a failed submit does it instead.
const FIELD_INPUT_IDS: Record<FieldName, string> = {
  url: 'url',
  customCode: 'custom',
  campaignName: 'new-campaign',
  expiresOn: 'expires',
  maxClicks: 'max-clicks',
  iosDeepLink: 'ios',
  androidDeepLink: 'android',
  fallbackUrl: 'fallback',
}

// Fields inside the "Click limit and app links" disclosure.
const ADVANCED_FIELDS: FieldName[] = ['maxClicks', 'iosDeepLink', 'androidDeepLink', 'fallbackUrl']

// Sentinels for the campaign Select, which needs a non-empty value.
const NO_CAMPAIGN = 'none'
const NEW_CAMPAIGN = '__new__'

const DEEP_LINK_ERROR = 'Use a supported app scheme (such as instagram://) or an https:// link.'

const SHORT_DOMAIN = process.env.NEXT_PUBLIC_SHORT_DOMAIN || 'tws.bio'
const SHORT_HOST = SHORT_DOMAIN.toLowerCase().replace(/^www\./, '')

const COPIED_MS = 1600
const AVAILABILITY_DEBOUNCE_MS = 400
const DAY_MS = 86_400_000

// "Stops working on" is a day in India time, the zone the dashboard files
// days in. IST has no daylight saving, so a fixed offset is exact.
const IST_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** The instant a link set to stop on `day` (YYYY-MM-DD) stops: midnight IST after it. */
function endOfIstDay(day: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return Number.NaN
  return Date.parse(`${day}T00:00:00+05:30`) + DAY_MS
}

// What the destination field says under itself when no app link applies.
const KIND_PHRASE: Record<DestinationKind, string> = {
  Course: 'A page on your course site',
  App: 'A page on Hitpoint',
  Website: 'A page on your website',
  Video: 'A video page',
  Community: 'A community invite',
  Social: 'A social media page',
  'Broker partner': 'A broker partner page',
  Payment: 'A payment page',
  Doc: 'A document',
}

type CodeStatus = 'idle' | 'checking' | 'available' | 'taken' | 'error'

interface CreatedLink {
  /** Row id, for the link to this link's stats page. */
  id: string
  shortCode: string
  destination: string
  isDeepLink: boolean
  platform: string | null
  /** What was saved on the row. Null when unset or when saving it failed. */
  campaignId: string | null
  expiresOn: string | null
  maxClicks: number | null
}

/** Values a copied link starts the form with (Duplicate). The short code always starts empty. */
export interface CreateLinkInitialValues {
  url?: string
  linkType?: 'url' | 'deep_link'
  iosDeepLink?: string
  androidDeepLink?: string
  fallbackUrl?: string
  campaignId?: string | null
  /** YYYY-MM-DD, the IST day the link stops working on. */
  expiresOn?: string
  maxClicks?: number | null
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
   * Show the form's own heading (default true). A page that already has an h1
   * for the form, such as /dashboard/create, passes false so the title is not
   * said twice.
   */
  showHeader?: boolean
  /** Start values, for a copy of an existing link. */
  initialValues?: CreateLinkInitialValues
  /** The owner's campaigns, when the page already loaded them. Otherwise they load on first open. */
  initialCampaigns?: { id: string; name: string }[]
  /** Short code of the link the start values were copied from. */
  copiedFrom?: string
  /** Where Cancel goes. Without it the form shows Clear instead. */
  cancelHref?: string
}

const helpText = 'text-[13px] leading-normal'

export function CreateLinkForm({
  initialUser = null,
  onCreated,
  showHeader = true,
  initialValues,
  initialCampaigns,
  copiedFrom,
  cancelHref,
}: CreateLinkFormProps) {
  const { user: authUser, loading: authLoading } = useAuth()
  const user = initialUser && authLoading ? initialUser : authUser
  const init = initialValues ?? {}
  const startsDeep = init.linkType === 'deep_link'
  const [url, setUrl] = useState(init.url ?? '')
  const [customCode, setCustomCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [showAdvanced, setShowAdvanced] = useState(startsDeep || init.maxClicks != null)
  const [linkType, setLinkType] = useState<'url' | 'deep_link'>(startsDeep ? 'deep_link' : 'url')
  const [iosDeepLink, setIosDeepLink] = useState(startsDeep ? (init.iosDeepLink ?? '') : '')
  const [androidDeepLink, setAndroidDeepLink] = useState(startsDeep ? (init.androidDeepLink ?? '') : '')
  const [fallbackUrl, setFallbackUrl] = useState(startsDeep ? (init.fallbackUrl ?? '') : '')
  const [detectedPlatform, setDetectedPlatform] = useState<string | null>(null)
  const [autoDetected, setAutoDetected] = useState(false)
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>(initialCampaigns ?? [])
  const [selectedCampaignId, setSelectedCampaignId] = useState(
    init.campaignId && initialCampaigns?.some((c) => c.id === init.campaignId) ? init.campaignId : NO_CAMPAIGN,
  )
  const [newCampaignName, setNewCampaignName] = useState('')
  const [expiresOn, setExpiresOn] = useState(init.expiresOn ?? '')
  const [maxClicks, setMaxClicks] = useState(init.maxClicks != null ? String(init.maxClicks) : '')
  const [codeStatus, setCodeStatus] = useState<CodeStatus>('idle')
  const [showCopiedFrom, setShowCopiedFrom] = useState(Boolean(copiedFrom))
  const [createdLink, setCreatedLink] = useState<CreatedLink | null>(null)
  const [copied, setCopied] = useState(false)
  const [qrMounted, setQrMounted] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  // Today in IST, the earliest day the date field offers. Read once.
  const [today] = useState(() => IST_DATE.format(new Date()))
  const latestUrlRef = useRef(init.url ?? '')
  const campaignsLoadedRef = useRef(Boolean(initialCampaigns))
  const latestCodeRef = useRef('')
  const codeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (codeTimerRef.current) clearTimeout(codeTimerRef.current)
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
    },
    [],
  )

  const clearFieldError = (field: FieldName) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  // "Copied" stays on the button for 1.6s, then the label goes back to Copy.
  const flashCopied = () => {
    setCopied(true)
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
    copiedTimerRef.current = setTimeout(() => setCopied(false), COPIED_MS)
  }

  const copyShortUrl = async (code: string) => {
    try {
      await navigator.clipboard.writeText(getShortUrl(code))
      flashCopied()
    } catch {
      toast.error('Could not copy. Select the link and copy it by hand.')
    }
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

  // A live answer under the short link field. It never blocks the submit:
  // the create RPC's unique check is the final word. Two reads, because the
  // public lookup only sees active links and an inactive code is still taken;
  // the owner's own links (inactive ones too) are readable under RLS.
  const checkAvailability = (code: string) => {
    latestCodeRef.current = code
    if (codeTimerRef.current) clearTimeout(codeTimerRef.current)
    if (!code || isReservedShortCode(code)) {
      setCodeStatus('idle')
      return
    }
    setCodeStatus('checking')
    codeTimerRef.current = setTimeout(() => {
      void (async () => {
        try {
          const { createClient } = await import('@/lib/supabase/client')
          const supabase = createClient()
          const [own, active] = await Promise.all([
            supabase.from('links').select('id').eq('short_code', code).limit(1),
            supabase.rpc('get_link_by_short_code', { p_short_code: code }),
          ])
          if (latestCodeRef.current !== code) return
          if (own.error || active.error) {
            setCodeStatus('error')
            return
          }
          const activeRows: unknown = active.data
          const taken =
            (own.data?.length ?? 0) > 0 || (Array.isArray(activeRows) ? activeRows.length > 0 : Boolean(activeRows))
          setCodeStatus(taken ? 'taken' : 'available')
        } catch {
          if (latestCodeRef.current === code) setCodeStatus('error')
        }
      })()
    }, AVAILABILITY_DEBOUNCE_MS)
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

  const resetForm = () => {
    setCreatedLink(null)
    setUrl('')
    latestUrlRef.current = ''
    setCustomCode('')
    latestCodeRef.current = ''
    if (codeTimerRef.current) clearTimeout(codeTimerRef.current)
    setCodeStatus('idle')
    setLinkType('url')
    setIosDeepLink('')
    setAndroidDeepLink('')
    setFallbackUrl('')
    setDetectedPlatform(null)
    setAutoDetected(false)
    setShowAdvanced(false)
    setSelectedCampaignId(NO_CAMPAIGN)
    setNewCampaignName('')
    setExpiresOn('')
    setMaxClicks('')
    setFieldErrors({})
    setShowCopiedFrom(false)
    setCopied(false)
    setQrOpen(false)
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
    // The end date and the click limit are written after the create, so they
    // are checked here first. A new link has no clicks yet, and the limit
    // check is the Edit Link one.
    let expiresAt: string | null = null
    if (expiresOn) {
      const end = endOfIstDay(expiresOn)
      if (Number.isNaN(end)) errors.expiresOn = 'Enter a full date, or clear it.'
      else if (end <= Date.now()) errors.expiresOn = 'Pick today or a later day, or clear the date.'
      else expiresAt = new Date(end).toISOString()
    }
    let clickLimit: number | null = null
    if (maxClicks.trim()) {
      const limit = checkLinkEdit(
        {
          originalUrl: destination,
          iosDeepLink: '',
          androidDeepLink: '',
          fallbackUrl: '',
          expiresAt: '',
          maxClicks,
        },
        { isDeepLink: false, totalClicks: 0, storedExpiresAt: null, storedMaxClicks: null, now: new Date() },
      )
      if (limit.errors.maxClicks) errors.maxClicks = limit.errors.maxClicks
      else clickLimit = limit.update.max_clicks
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
      if (ADVANCED_FIELDS.some((field) => errors[field])) setShowAdvanced(true)
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

      const isDeepLink = linkType === 'deep_link'
      let data: HomeLink | null
      if (isDeepLink) {
        const { data: row, error: rpcError } = await supabase.rpc('create_deep_link', {
          p_short_code: shortCode,
          p_original_url: destination,
          p_user_id: user?.id,
          p_ios_deep_link: iosLink || undefined,
          p_android_deep_link: androidLink || undefined,
          p_fallback_url: fallback || undefined,
        })
        if (rpcError) throw new Error(rpcError.message)
        data = row
      } else {
        const { data: row, error: rpcError } = await supabase.rpc('create_link', {
          p_short_code: shortCode,
          p_original_url: destination,
          p_user_id: user?.id,
        })
        if (rpcError) throw new Error(rpcError.message)
        data = row
      }

      if (!data) {
        toast.error('Failed to create link. Please try again.')
        setLoading(false)
        return
      }

      // The create RPCs do not take a campaign, an end date or a click limit,
      // so the new row gets them in one update straight after.
      const patch: LinkUpdate = {}
      if (campaignId) patch.campaign_id = campaignId
      if (expiresAt) patch.expires_at = expiresAt
      if (clickLimit != null) patch.max_clicks = clickLimit
      let patchFailed = false
      if (Object.keys(patch).length > 0) {
        const { error: patchError } = await supabase.from('links').update(patch).eq('id', data.id)
        if (patchError) patchFailed = true
      }

      let wasCopied = false
      try {
        await navigator.clipboard.writeText(getShortUrl(data.short_code))
        wasCopied = true
      } catch {
        // The preview keeps its own Copy button.
      }

      const kind = isDeepLink ? 'Deep link' : 'Link'
      if (patchFailed) {
        const unsaved = [
          campaignId && 'campaign',
          expiresAt && 'end date',
          clickLimit != null && 'click limit',
        ].filter((part): part is string => Boolean(part))
        if (unsaved.length === 1 && unsaved[0] === 'campaign') {
          toast.warning(`${kind} created, but could not assign it to the campaign.`)
        } else {
          const list =
            unsaved.length > 1 ? `${unsaved.slice(0, -1).join(', ')} and ${unsaved[unsaved.length - 1]}` : unsaved[0]
          toast.warning(`${kind} created, but its ${list} could not be saved. Set ${unsaved.length > 1 ? 'them' : 'it'} in Edit.`)
        }
      } else if (wasCopied) {
        toast.success(`${kind} created and copied to clipboard.`)
      } else {
        toast.success(`${kind} created. Copy it from the preview.`)
      }

      setCreatedLink({
        id: data.id,
        shortCode: data.short_code,
        destination: data.original_url,
        isDeepLink,
        platform: isDeepLink ? detectedPlatform : null,
        campaignId: patchFailed ? null : (campaignId ?? null),
        expiresOn: patchFailed || !expiresAt ? null : expiresOn,
        maxClicks: patchFailed ? null : clickLimit,
      })
      if (wasCopied) flashCopied()
      onCreated?.(data)
      setLoading(false)
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

      // Only clear loading on failure. On success the created view replaces
      // the form, so the double-submit window is closed either way.
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
      <div className="rule-open flex flex-col gap-4 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="type-h2 text-ink">Sign in to create links</h2>
          <p className="mt-1 text-sm text-text-2">
            For the Trading with Sidhant team. Sidhant creates each account.
          </p>
        </div>
        <Link href="/login" className={cn(buttonVariants(), 'shrink-0')}>
          Sign in
        </Link>
      </div>
    )
  }

  const campaignOptions = [
    { value: NO_CAMPAIGN, label: 'No campaign' },
    ...campaigns.map((c) => ({ value: c.id, label: c.name })),
    { value: NEW_CAMPAIGN, label: '+ New campaign...' },
  ]

  // Under the destination: what kind of page it is and what a phone does
  // with it, in words. A hint only; the submit checks stay the same.
  const candidate = normalizeUrl(url)
  let destinationHint = 'The full address of the page people should land on.'
  if (candidate && !isValidUrl(candidate)) {
    let ownHost = false
    try {
      ownHost = new URL(candidate).hostname.toLowerCase().replace(/^www\./, '') === SHORT_HOST
    } catch {
      // Not a URL yet.
    }
    destinationHint = ownHost
      ? `That is another ${SHORT_DOMAIN} short link. Use the page it opens, so the two links cannot loop.`
      : 'Enter a full web address, like https://twsgurukulx.com.'
  } else if (candidate) {
    if (linkType === 'deep_link') {
      destinationHint = detectedPlatform
        ? `${detectedPlatform} link. Phones open it in the ${detectedPlatform} app.`
        : 'Phones open the app links set under Click limit and app links.'
    } else {
      const kind = destinationKind(candidate)
      destinationHint = `${kind ? KIND_PHRASE[kind] : 'A web page'}. No app link is needed.`
    }
  }

  // Under the short link: the live answer, in words.
  const code = customCode
  const codeReserved = Boolean(code) && isReservedShortCode(code)
  let codeHint: { text: string; tone: 'muted' | 'pos' | 'neg' }
  if (!code) {
    codeHint = { text: 'Leave it empty for a random 6-character code. Lowercase letters, numbers and hyphens.', tone: 'muted' }
  } else if (codeReserved) {
    codeHint = { text: `${SHORT_DOMAIN}/${code} is a page of this app, so it cannot be a short link. Choose another.`, tone: 'neg' }
  } else if (codeStatus === 'checking') {
    codeHint = { text: 'Checking...', tone: 'muted' }
  } else if (codeStatus === 'available') {
    codeHint = { text: 'Available. Lowercase letters, numbers and hyphens.', tone: 'pos' }
  } else if (codeStatus === 'taken') {
    codeHint = { text: `${SHORT_DOMAIN}/${code} is already taken. Choose another.`, tone: 'neg' }
  } else if (codeStatus === 'error') {
    codeHint = { text: 'Could not check this code now. It is checked again when you save.', tone: 'muted' }
  } else {
    codeHint = { text: 'Lowercase letters, numbers and hyphens.', tone: 'muted' }
  }

  const isDirty =
    Boolean(url || customCode || expiresOn || maxClicks || iosDeepLink || androidDeepLink || fallbackUrl) ||
    selectedCampaignId !== NO_CAMPAIGN

  const campaignName = (id: string | null) => (id ? (campaigns.find((c) => c.id === id)?.name ?? 'Saved') : null)

  const previewCode = createdLink ? createdLink.shortCode : code

  const preview = (
    <aside
      aria-label={createdLink ? 'Your new link' : 'Preview'}
      className={cn(
        'min-w-0 self-start rounded-panel border border-rule bg-surface p-[18px] sm:p-6 @4xl:sticky @4xl:top-6',
        // Once the link exists, Copy and QR are what the owner wants next, so
        // on one column the panel moves above the summary.
        createdLink && 'order-first @4xl:order-none',
      )}
    >
      <p className="type-label">{createdLink ? 'Your new link' : 'Preview'}</p>
      <div className="rule-total mt-2.5 mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-3 pb-4">
        <p className="min-w-0 font-mono text-[18px] leading-[1.3] text-text-2 [overflow-wrap:anywhere] sm:text-[22px]">
          {SHORT_DOMAIN}/
          {previewCode ? (
            <strong className="font-medium text-ink">{previewCode}</strong>
          ) : (
            <span className="font-sans text-[15px] text-text-3">random code</span>
          )}
        </p>
        {createdLink && (
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void copyShortUrl(createdLink.shortCode)}
              aria-label={copied ? 'Copied' : `Copy ${SHORT_DOMAIN}/${createdLink.shortCode}`}
              className="min-w-[4.5rem]"
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setQrMounted(true)
                setQrOpen(true)
              }}
              aria-label={`QR code for ${SHORT_DOMAIN}/${createdLink.shortCode}`}
            >
              QR
            </Button>
          </div>
        )}
      </div>
      {createdLink ? (
        <AttributionPreview shortCode={createdLink.shortCode} destination={createdLink.destination} />
      ) : code ? (
        <AttributionPreview shortCode={code} destination={candidate} />
      ) : (
        <p className="text-sm leading-relaxed text-text-2">
          With no short link typed, a random 6-character code is picked when you save. Type one to see
          the tags GA4 receives for each platform.
        </p>
      )}
      {createdLink && (
        <div className="mt-6 flex">
          <Button type="button" size="lg" onClick={resetForm} className="flex-1 sm:flex-none">
            Create another
          </Button>
        </div>
      )}
    </aside>
  )

  return (
    <div className="@container min-w-0">
      {showHeader && <h2 className="type-h2 mb-4 text-ink">New link</h2>}
      <div className="rule-open grid gap-8 pt-5 @4xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] @4xl:gap-14 @4xl:pt-7">
        {createdLink ? (
          <div className="grid max-w-[560px] min-w-0 content-start gap-5">
            <p role="status" className="text-[15px] leading-relaxed text-ink">
              <span className="font-mono text-[14px]">
                {SHORT_DOMAIN}/{createdLink.shortCode}
              </span>{' '}
              works now.
            </p>
            <dl className="rule-sub">
              {(
                [
                  [
                    'Destination',
                    <span key="d" className="font-mono text-[13px] [overflow-wrap:anywhere]">
                      {createdLink.destination}
                    </span>,
                  ],
                  [
                    'On phones',
                    createdLink.isDeepLink
                      ? createdLink.platform
                        ? `Opens the ${createdLink.platform} app`
                        : 'Opens the app links you set'
                      : 'Opens the web page',
                  ],
                  ['Campaign', campaignName(createdLink.campaignId) ?? 'None'],
                  [
                    'Stops working on',
                    createdLink.expiresOn
                      ? `${formatDate(`${createdLink.expiresOn}T12:00:00+05:30`)}, end of day`
                      : 'No end date',
                  ],
                  [
                    'Click limit',
                    createdLink.maxClicks != null ? createdLink.maxClicks.toLocaleString('en-US') : 'No limit',
                  ],
                ] as const
              ).map(([term, value]) => (
                <div
                  key={term}
                  className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] gap-3 border-b border-rule py-2.5 text-sm"
                >
                  <dt className="text-text-3">{term}</dt>
                  <dd className="m-0 min-w-0 text-ink tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex gap-3">
              <Link
                href={`/dashboard/links/${createdLink.id}`}
                className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'flex-1 sm:flex-none')}
              >
                View in dashboard
              </Link>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            noValidate
            aria-label={showHeader ? undefined : 'New link'}
            className="grid max-w-[560px] min-w-0 content-start gap-[22px]"
          >
            {showCopiedFrom && copiedFrom && (
              <p className="text-sm text-text-2">
                Copied from{' '}
                <span className="font-mono text-[13px] text-ink">
                  {SHORT_DOMAIN}/{copiedFrom}
                </span>
                . Give the copy its own short link.
              </p>
            )}

            {/* Always mounted, so screen readers announce it when detection
                switches the link to a deep link. */}
            <div role="status" className="sr-only">
              {detectedPlatform ? `${detectedPlatform} app links filled in.` : ''}
            </div>

            {/* Destination */}
            <div className="grid min-w-0 gap-2">
              <Label htmlFor="url">Destination</Label>
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
                placeholder="https://twsgurukulx.com/..."
                aria-invalid={!!fieldErrors.url}
                aria-describedby={fieldErrors.url ? 'url-error' : 'url-hint'}
                required
              />
              {fieldErrors.url ? (
                <p id="url-error" role="alert" className={cn(helpText, 'text-neg')}>
                  {fieldErrors.url}
                </p>
              ) : (
                <p id="url-hint" className={cn(helpText, 'text-text-2')}>
                  {destinationHint}
                </p>
              )}
            </div>

            {/* Short link */}
            <div className="grid min-w-0 gap-2">
              <Label htmlFor="custom">
                Short link <span className="font-normal text-text-3">optional</span>
              </Label>
              <div
                className={cn(
                  'flex h-11 min-w-0 items-stretch overflow-hidden rounded-ctl border border-edge bg-surface transition-[border-color] duration-150 focus-within:border-focus has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus sm:h-9',
                  (fieldErrors.customCode || codeReserved) && 'border-neg',
                )}
              >
                <span
                  aria-hidden="true"
                  className="flex shrink-0 items-center pl-3 font-mono text-base text-text-2 sm:text-sm"
                >
                  {SHORT_DOMAIN}/
                </span>
                <Input
                  id="custom"
                  type="text"
                  value={customCode}
                  onChange={(e) => {
                    const next = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                    setCustomCode(next)
                    clearFieldError('customCode')
                    checkAvailability(next)
                  }}
                  className="h-full rounded-none border-0 pl-px font-mono focus-visible:outline-none sm:h-full"
                  pattern="[a-z0-9-]+"
                  maxLength={50}
                  autoComplete="off"
                  spellCheck={false}
                  aria-label={`Short link, after ${SHORT_DOMAIN}/`}
                  aria-invalid={!!fieldErrors.customCode || codeReserved}
                  aria-describedby={fieldErrors.customCode ? 'custom-code-error' : 'custom-code-hint'}
                />
              </div>
              {fieldErrors.customCode ? (
                <p id="custom-code-error" role="alert" className={cn(helpText, 'text-neg')}>
                  {fieldErrors.customCode}
                </p>
              ) : (
                <p
                  id="custom-code-hint"
                  aria-live="polite"
                  className={cn(
                    helpText,
                    codeHint.tone === 'pos' ? 'text-pos' : codeHint.tone === 'neg' ? 'text-neg' : 'text-text-2',
                  )}
                >
                  {codeHint.text}
                </p>
              )}
            </div>

            {/* Campaign and end date */}
            <div className="grid min-w-0 gap-[22px] sm:grid-cols-2 sm:gap-4">
              <div className="grid min-w-0 content-start gap-2">
                <Label htmlFor="campaign">
                  Campaign <span className="font-normal text-text-3">optional</span>
                </Label>
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
                  <SelectTrigger id="campaign" className="w-full min-w-0">
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
                      aria-invalid={!!fieldErrors.campaignName}
                      aria-describedby={fieldErrors.campaignName ? 'campaign-name-error' : undefined}
                    />
                    {fieldErrors.campaignName && (
                      <p id="campaign-name-error" role="alert" className={cn(helpText, 'text-neg')}>
                        {fieldErrors.campaignName}
                      </p>
                    )}
                  </>
                )}
              </div>
              <div className="grid min-w-0 content-start gap-2">
                <Label htmlFor="expires">
                  Stops working on <span className="font-normal text-text-3">optional</span>
                </Label>
                <Input
                  id="expires"
                  type="date"
                  value={expiresOn}
                  min={today}
                  onChange={(e) => {
                    setExpiresOn(e.target.value)
                    clearFieldError('expiresOn')
                  }}
                  className="tabular-nums"
                  aria-invalid={!!fieldErrors.expiresOn}
                  aria-describedby={fieldErrors.expiresOn ? 'expires-error' : 'expires-hint'}
                />
                {fieldErrors.expiresOn ? (
                  <p id="expires-error" role="alert" className={cn(helpText, 'text-neg')}>
                    {fieldErrors.expiresOn}
                  </p>
                ) : (
                  <p id="expires-hint" className={cn(helpText, 'text-text-2')}>
                    {expiresOn ? 'It stops at the end of that day, India time.' : 'Empty: it never stops.'}
                  </p>
                )}
              </div>
            </div>

            {/* Click limit and app links */}
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                aria-expanded={showAdvanced}
                aria-controls="advanced-options"
                className="focus-ring flex min-h-11 w-full items-center gap-1.5 border-y border-rule py-1.5 text-left text-sm font-medium text-accent-text transition-colors duration-150 hover:text-ink sm:min-h-9"
              >
                <ChevronRight
                  className={cn('size-4 transition-transform duration-150', showAdvanced && 'rotate-90')}
                  strokeWidth={1.75}
                  aria-hidden
                />
                Click limit and app links
              </button>

              {showAdvanced && (
                <div id="advanced-options" className="grid gap-[22px] border-b border-rule pt-5 pb-6">
                  <div className="grid min-w-0 gap-2">
                    <Label htmlFor="max-clicks">
                      Click limit <span className="font-normal text-text-3">optional</span>
                    </Label>
                    <Input
                      id="max-clicks"
                      type="text"
                      inputMode="numeric"
                      value={maxClicks}
                      onChange={(e) => {
                        setMaxClicks(e.target.value.replace(/[^\d]/g, ''))
                        clearFieldError('maxClicks')
                      }}
                      placeholder="No limit"
                      className="tabular-nums sm:max-w-48"
                      aria-invalid={!!fieldErrors.maxClicks}
                      aria-describedby={fieldErrors.maxClicks ? 'max-clicks-error' : 'max-clicks-hint'}
                    />
                    {fieldErrors.maxClicks ? (
                      <p id="max-clicks-error" role="alert" className={cn(helpText, 'text-neg')}>
                        {fieldErrors.maxClicks}
                      </p>
                    ) : (
                      <p id="max-clicks-hint" className={cn(helpText, 'text-text-2')}>
                        The link stops after this many clicks. Approximate: clicks at the same moment can pass it
                        by a few.
                      </p>
                    )}
                  </div>

                  <div className="grid min-w-0 gap-2">
                    <Label id="link-type-label">On phones</Label>
                    <RadioGroup
                      aria-labelledby="link-type-label"
                      value={linkType}
                      onValueChange={(val) => setLinkType(val as 'url' | 'deep_link')}
                      className="flex flex-col gap-0 sm:flex-row sm:gap-6"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="url" id="type-url" />
                        <Label htmlFor="type-url" className="min-h-11 flex-1 cursor-pointer font-normal sm:min-h-9 sm:flex-none">
                          Open the web page
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="deep_link" id="type-deep" />
                        <Label htmlFor="type-deep" className="min-h-11 flex-1 cursor-pointer font-normal sm:min-h-9 sm:flex-none">
                          Open the app
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {linkType === 'deep_link' && (
                    <>
                      <div className="grid min-w-0 gap-2">
                        <Label htmlFor="ios">
                          iPhone app link{' '}
                          {autoDetected && <span className="font-normal text-text-3">filled in</span>}
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
                          className="font-mono"
                          spellCheck={false}
                          aria-invalid={!!fieldErrors.iosDeepLink}
                          aria-describedby={fieldErrors.iosDeepLink ? 'ios-error' : undefined}
                        />
                        {fieldErrors.iosDeepLink && (
                          <p id="ios-error" role="alert" className={cn(helpText, 'text-neg')}>
                            {fieldErrors.iosDeepLink}
                          </p>
                        )}
                      </div>
                      <div className="grid min-w-0 gap-2">
                        <Label htmlFor="android">
                          Android app link{' '}
                          {autoDetected && <span className="font-normal text-text-3">filled in</span>}
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
                          className="font-mono"
                          spellCheck={false}
                          aria-invalid={!!fieldErrors.androidDeepLink}
                          aria-describedby={fieldErrors.androidDeepLink ? 'android-error' : undefined}
                        />
                        {fieldErrors.androidDeepLink && (
                          <p id="android-error" role="alert" className={cn(helpText, 'text-neg')}>
                            {fieldErrors.androidDeepLink}
                          </p>
                        )}
                      </div>
                      <div className="grid min-w-0 gap-2">
                        <Label htmlFor="fallback">
                          Fallback page{' '}
                          {autoDetected && <span className="font-normal text-text-3">filled in</span>}
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
                          placeholder="https://..."
                          aria-invalid={!!fieldErrors.fallbackUrl}
                          aria-describedby={fieldErrors.fallbackUrl ? 'fallback-error' : 'fallback-hint'}
                        />
                        {fieldErrors.fallbackUrl && (
                          <p id="fallback-error" role="alert" className={cn(helpText, 'text-neg')}>
                            {fieldErrors.fallbackUrl}
                          </p>
                        )}
                        <p id="fallback-hint" className={cn(helpText, 'text-text-2')}>
                          Where to send people if the app is not installed.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-1">
              <Button type="submit" size="lg" disabled={loading} className="flex-1 sm:flex-none">
                {loading ? 'Creating...' : 'Create link'}
              </Button>
              {cancelHref ? (
                <Link
                  href={cancelHref}
                  className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'flex-1 sm:flex-none')}
                >
                  Cancel
                </Link>
              ) : (
                isDirty && (
                  <Button type="button" variant="outline" size="lg" onClick={resetForm} className="flex-1 sm:flex-none">
                    Clear
                  </Button>
                )
              )}
            </div>
          </form>
        )}

        {preview}
      </div>

      {qrMounted && createdLink && (
        <QRCodeDialog shortCode={createdLink.shortCode} open={qrOpen} onOpenChange={setQrOpen} />
      )}
    </div>
  )
}
