'use client'

import { useState, useEffect, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { toDateTimeLocalValue } from '@/lib/datetime'
import {
  checkLinkEdit,
  type LinkEditErrors,
  type LinkEditField,
  type LinkEditFields,
} from '@/lib/linkEdit'
import { isResourceDropRow } from '@/lib/linkRows'
import type { Database } from '@/types/database'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { TickerChip } from '@/components/TickerChip'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Link = Database['public']['Tables']['links']['Row']
type LinkUpdate = Database['public']['Tables']['links']['Update']

// The Select needs a non-empty value for "no campaign" (same as CreateLinkForm).
const NO_CAMPAIGN = 'none'

// In the order the fields appear, so a failed save can focus the first field
// that needs fixing. In a scrolling dialog it may be out of view.
const FIELD_IDS: Record<LinkEditField, string> = {
  originalUrl: 'edit-original-url',
  iosDeepLink: 'edit-ios-deep-link',
  androidDeepLink: 'edit-android-deep-link',
  fallbackUrl: 'edit-fallback-url',
  expiresAt: 'edit-expires-at',
  maxClicks: 'edit-max-clicks',
}
const FIELD_ORDER = Object.keys(FIELD_IDS) as LinkEditField[]

type CampaignState =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; list: { id: string; name: string }[]; savedId: string | null }

function fieldsFromLink(link: Link): LinkEditFields {
  return {
    originalUrl: link.original_url,
    iosDeepLink: link.ios_deep_link || '',
    androidDeepLink: link.android_deep_link || '',
    fallbackUrl: link.fallback_url || '',
    expiresAt: toDateTimeLocalValue(link.expires_at),
    maxClicks: link.max_clicks != null ? String(link.max_clicks) : '',
  }
}

function errorId(field: LinkEditField) {
  return `${FIELD_IDS[field]}-error`
}

function FieldError({ field, message }: { field: LinkEditField; message?: string }) {
  if (!message) return null
  return (
    <p id={errorId(field)} role="alert" className="text-xs text-destructive">
      {message}
    </p>
  )
}

export function EditLinkDialog({
  link,
  open,
  onOpenChange,
}: {
  link: Link
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [fields, setFields] = useState(() => fieldsFromLink(link))
  const [errors, setErrors] = useState<LinkEditErrors>({})
  const [campaigns, setCampaigns] = useState<CampaignState>({ status: 'loading' })
  const [campaignId, setCampaignId] = useState(NO_CAMPAIGN)
  // LinkActions never opens this for a Resource Drop row: the /r route ignores
  // everything here. Refuse anyway, so no other entry point can save one.
  const managed = isResourceDropRow(link.short_code)
  const isDeepLink = link.link_type === 'deep_link'

  // Re-seed fields from the current link whenever the dialog opens, since the
  // dialog stays mounted and the initial useState values can go stale. Keyed
  // on the edited columns, not the row object: a refresh that changes none of
  // them must not wipe what the owner is typing.
  useEffect(() => {
    if (!open) return
    setFields(fieldsFromLink(link))
    setErrors({})
    // fieldsFromLink reads only the six columns listed, so the closure that
    // runs always has their current values. Listing `link` itself would
    // re-seed on every refresh, which is what the keying above prevents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    link.original_url,
    link.ios_deep_link,
    link.android_deep_link,
    link.fallback_url,
    link.expires_at,
    link.max_clicks,
  ])

  // Loaded on each open, so a campaign made since shows up. The row passed in
  // may not carry campaign_id (the links page selects only what it shows), so
  // it is read here too. Seeding the Select from the prop would show "No
  // campaign" and clear the real one on save.
  useEffect(() => {
    if (!open || managed) return
    let cancelled = false
    setCampaigns({ status: 'loading' })
    const supabase = createClient()
    Promise.all([
      supabase.from('campaigns').select('id, name').order('created_at', { ascending: false }),
      supabase.from('links').select('campaign_id').eq('id', link.id).maybeSingle(),
    ])
      .then(([list, row]) => {
        if (cancelled) return
        if (list.error || row.error || !row.data) {
          setCampaigns({ status: 'failed' })
          return
        }
        setCampaigns({ status: 'ready', list: list.data ?? [], savedId: row.data.campaign_id })
        setCampaignId(row.data.campaign_id ?? NO_CAMPAIGN)
      })
      .catch(() => {
        if (!cancelled) setCampaigns({ status: 'failed' })
      })
    return () => {
      cancelled = true
    }
  }, [open, managed, link.id])

  function setField(field: LinkEditField, value: string) {
    setFields((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  async function handleSave() {
    if (saving || managed) return

    const check = checkLinkEdit(fields, {
      isDeepLink,
      totalClicks: link.total_clicks,
      storedExpiresAt: link.expires_at,
      storedMaxClicks: link.max_clicks,
      now: new Date(),
    })
    const nextErrors = { ...check.errors }
    // A date-time input that is only part filled reports an empty value, which
    // would read as "no expiry". The browser flags it as badInput.
    const expiryInput = document.getElementById(FIELD_IDS.expiresAt) as HTMLInputElement | null
    if (expiryInput?.validity.badInput) {
      nextErrors.expiresAt = 'Enter a full date and time, or clear it.'
    }

    // Show what will be saved (https:// added, spaces trimmed), valid or not.
    setFields(check.fields)
    setErrors(nextErrors)
    const firstInvalid = FIELD_ORDER.find((field) => nextErrors[field])
    if (firstInvalid) {
      document.getElementById(FIELD_IDS[firstInvalid])?.focus()
      return
    }

    const update: LinkUpdate = { ...check.update }
    // Written only once the saved campaign is known, and only if it changed,
    // so a slow or failed load can never clear it.
    if (campaigns.status === 'ready') {
      const nextCampaignId = campaignId === NO_CAMPAIGN ? null : campaignId
      if (nextCampaignId !== campaigns.savedId) update.campaign_id = nextCampaignId
    }

    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('links')
        .update(update)
        .eq('id', link.id)

      if (error) {
        toast.error(error.message)
        return
      }

      toast.success('Link updated')
      onOpenChange(false)
      router.refresh()
    } catch {
      toast.error('Failed to update link')
    } finally {
      setSaving(false)
    }
  }

  if (managed) return null

  const campaignOptions =
    campaigns.status === 'ready'
      ? [
          { value: NO_CAMPAIGN, label: 'No campaign' },
          ...campaigns.list.map((c) => ({ value: c.id, label: c.name })),
          // The saved campaign can be missing from the list when another
          // account owns it. Name it rather than show its id.
          ...(campaigns.savedId && !campaigns.list.some((c) => c.id === campaigns.savedId)
            ? [{ value: campaigns.savedId, label: 'Current campaign' }]
            : []),
        ]
      : []

  // checkLinkEdit writes an untouched stored expiry or limit back as it is, so
  // a link that is already off for that reason stays off after the save. Say
  // so beside the field, with the redirect's own tests, so fixing only the
  // destination does not look like it turned the link back on.
  const expiredUntouched =
    link.expires_at !== null &&
    new Date(link.expires_at).getTime() < Date.now() &&
    fields.expiresAt === toDateTimeLocalValue(link.expires_at)
  const limitReachedUntouched =
    !!link.max_clicks &&
    (link.total_clicks ?? 0) >= link.max_clicks &&
    fields.maxClicks === String(link.max_clicks)

  const inputProps = (field: LinkEditField, describedBy?: string) => ({
    id: FIELD_IDS[field],
    value: fields[field],
    onChange: (e: ChangeEvent<HTMLInputElement>) => setField(field, e.target.value),
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby':
      [errors[field] ? errorId(field) : null, describedBy].filter(Boolean).join(' ') || undefined,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Link</DialogTitle>
          {/* The code is shown, not offered as a field: a read-only input was
              the first thing in the dialog, so it took the focus ring and
              looked like the field to edit. Focus now starts on Original URL. */}
          <DialogDescription className="sr-only">
            Update the settings for this short link.
          </DialogDescription>
          <TickerChip code={link.short_code} copyable={false} className="self-start" />
        </DialogHeader>

        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            void handleSave()
          }}
          className="flex min-h-0 flex-col gap-4"
        >
          {/* The fields scroll and the footer does not: a deep link's fields
              are taller than a phone screen, and Save must stay in reach.
              The bleed (-mx-4 px-4) keeps focus rings from clipping. */}
          <div className="-mx-4 grid min-h-0 content-start gap-4 overflow-y-auto px-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor={FIELD_IDS.originalUrl}>Original URL</Label>
              <Input
                {...inputProps('originalUrl')}
                type="url"
                placeholder="https://example.com"
              />
              <FieldError field="originalUrl" message={errors.originalUrl} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-campaign">Campaign</Label>
              <Select
                value={campaignId}
                onValueChange={(v) => setCampaignId(v || NO_CAMPAIGN)}
                disabled={campaigns.status !== 'ready'}
              >
                <SelectTrigger
                  id="edit-campaign"
                  className="w-full"
                  aria-describedby={campaigns.status === 'failed' ? 'edit-campaign-hint' : undefined}
                >
                  <SelectValue>
                    {(value: string | null) =>
                      campaigns.status === 'loading'
                        ? 'Loading campaigns...'
                        : campaigns.status === 'failed'
                          ? 'Campaigns unavailable'
                          : (campaignOptions.find((o) => o.value === value)?.label ?? 'No campaign')
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {campaignOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {campaigns.status === 'failed' && (
                <p id="edit-campaign-hint" className="text-xs text-muted-foreground">
                  Couldn&apos;t load your campaigns. Saving keeps the current one.
                </p>
              )}
            </div>

            {isDeepLink && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor={FIELD_IDS.iosDeepLink}>iOS Deep Link</Label>
                  <Input {...inputProps('iosDeepLink')} placeholder="app://path" />
                  <FieldError field="iosDeepLink" message={errors.iosDeepLink} />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor={FIELD_IDS.androidDeepLink}>Android Deep Link</Label>
                  <Input {...inputProps('androidDeepLink')} placeholder="app://path" />
                  <FieldError field="androidDeepLink" message={errors.androidDeepLink} />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor={FIELD_IDS.fallbackUrl}>Fallback URL</Label>
                  <Input
                    {...inputProps('fallbackUrl')}
                    type="url"
                    placeholder="https://example.com/fallback"
                  />
                  <FieldError field="fallbackUrl" message={errors.fallbackUrl} />
                </div>
              </>
            )}

            <div className="grid gap-2">
              <Label htmlFor={FIELD_IDS.expiresAt}>Expiration Date (optional)</Label>
              <Input
                {...inputProps('expiresAt', expiredUntouched ? 'edit-expires-at-note' : undefined)}
                type="datetime-local"
              />
              <FieldError field="expiresAt" message={errors.expiresAt} />
              {expiredUntouched && (
                <p id="edit-expires-at-note" className="text-xs text-muted-foreground">
                  This date has passed, so the link is off. It stays off until you pick a later time or clear the date.
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor={FIELD_IDS.maxClicks}>Max Clicks (optional)</Label>
              {/* Text with a numeric keypad rather than type="number", so the
                  check sees exactly what was typed (no "1e3" or scroll-wheel
                  changes). */}
              <Input
                {...inputProps(
                  'maxClicks',
                  limitReachedUntouched ? 'edit-max-clicks-note edit-max-clicks-hint' : 'edit-max-clicks-hint',
                )}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Unlimited"
              />
              <FieldError field="maxClicks" message={errors.maxClicks} />
              {limitReachedUntouched && (
                <p id="edit-max-clicks-note" className="text-xs text-muted-foreground">
                  The link has reached this limit, so it is off. It stays off until you raise the limit or clear it.
                </p>
              )}
              {/* The redirect checks the count it read, and the click is
                  counted afterwards, so clicks in flight together can pass. */}
              <p id="edit-max-clicks-hint" className="text-xs text-muted-foreground">
                Approximate: a burst of clicks at the same moment can pass the limit slightly.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !fields.originalUrl.trim()}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
