import type { Metadata } from 'next'
import { createClient, getAuthenticatedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CreateLinkForm, type CreateLinkInitialValues } from '@/components/CreateLinkForm'
import { PageHeader } from '@/components/dashboard/PageHeader'

// The root layout's template adds " - tws.bio".
export const metadata: Metadata = { title: 'New link' }

// A link id from the Duplicate row action. Checked before the query: a value
// that is not a uuid makes Postgres raise an error instead of finding nothing.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const IST_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * The "Stops working on" day for a stored expiry: the form stops a link at the
 * end of the chosen IST day, so the day is the one the last moment falls in.
 * An expiry that has already passed is not copied: it would turn the new link
 * off the moment it is saved.
 */
function expiryDay(expiresAt: string | null, now: number): string {
  if (!expiresAt) return ''
  const t = new Date(expiresAt).getTime()
  if (Number.isNaN(t) || t <= now) return ''
  return IST_DATE.format(new Date(t - 1))
}

export default async function CreateLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>
}) {
  const { from } = await searchParams
  const fromId = typeof from === 'string' && UUID_PATTERN.test(from) ? from : null

  const supabase = await createClient()
  // Auth, the campaign list and the link to copy load together. RLS limits
  // both reads to the signed-in owner, so another owner's id finds nothing.
  const [user, campaignsResult, sourceResult] = await Promise.all([
    getAuthenticatedUser(),
    supabase.from('campaigns').select('id, name').order('created_at', { ascending: false }),
    fromId
      ? supabase
          .from('links')
          .select(
            'short_code, original_url, link_type, ios_deep_link, android_deep_link, fallback_url, campaign_id, expires_at, max_clicks',
          )
          .eq('id', fromId)
          .maybeSingle()
      : Promise.resolve(null),
  ])
  if (!user) redirect('/login')

  if (campaignsResult.error) console.error('Create link: campaigns failed to load:', campaignsResult.error)
  if (sourceResult?.error) console.error('Create link: link to copy failed to load:', sourceResult.error)

  const source = sourceResult?.data ?? null
  const now = Date.now()
  const initialValues: CreateLinkInitialValues | undefined = source
    ? {
        url: source.original_url,
        linkType: source.link_type === 'deep_link' ? 'deep_link' : 'url',
        iosDeepLink: source.ios_deep_link ?? '',
        androidDeepLink: source.android_deep_link ?? '',
        fallbackUrl: source.fallback_url ?? '',
        campaignId: source.campaign_id,
        expiresOn: expiryDay(source.expires_at, now),
        maxClicks: source.max_clicks,
      }
    : undefined

  // Only a requested copy that could not be loaded gets a note.
  const copyNote =
    from === undefined || source
      ? null
      : sourceResult?.error
        ? 'The link to copy could not be loaded, so the form starts empty.'
        : 'The link to copy was not found, so the form starts empty.'

  return (
    <>
      <PageHeader
        title="New link"
        description={
          copyNote ? (
            <>
              <p>The link works as soon as you save it.</p>
              <p role="status" className="mt-1">
                {copyNote}
              </p>
            </>
          ) : (
            'The link works as soon as you save it.'
          )
        }
      />
      <CreateLinkForm
        // A new key per source, so moving from one copy to another resets the form.
        key={fromId ?? 'new'}
        initialUser={{ id: user.id }}
        showHeader={false}
        initialValues={initialValues}
        initialCampaigns={campaignsResult.error ? undefined : (campaignsResult.data ?? [])}
        copiedFrom={source?.short_code}
        cancelHref="/dashboard/links"
      />
    </>
  )
}
