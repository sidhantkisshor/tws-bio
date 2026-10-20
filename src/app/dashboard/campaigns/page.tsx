import { getAuthenticatedUser, createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button-variants'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'

// Shape of the embedded select below. The links.campaign_id FK exists in the
// database (the embed resolves fine at runtime) but isn't declared in the
// generated Database types' Relationships, so inference needs this override.
interface CampaignWithLinks {
  id: string
  name: string
  description: string | null
  created_at: string | null
  links: { total_clicks: number | null }[]
}

export default async function CampaignsPage() {
  const user = await getAuthenticatedUser()
  if (!user) redirect('/login')
  const supabase = await createClient()

  // Single round trip: each campaign's links (total_clicks only) come back
  // embedded with the campaigns themselves, so the link count and click sum
  // don't need a second dependent query.
  const { data: campaigns, error: campaignsError } = await supabase
    .from('campaigns')
    .select('id, name, description, created_at, links(total_clicks)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .overrideTypes<CampaignWithLinks[], { merge: false }>()

  if (campaignsError) {
    console.error('[campaigns] campaigns query:', campaignsError)
  }

  // A failed fetch must never render identically to "you have no campaigns
  // yet", so check the error field explicitly instead of falling through the
  // `campaignStats.length > 0` empty-state branch below.
  const hasError = Boolean(campaignsError)

  const campaignStats = (campaigns || []).map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    created_at: campaign.created_at,
    totalLinks: campaign.links.length,
    totalClicks: campaign.links.reduce((sum, link) => sum + (link.total_clicks || 0), 0),
  }))

  return (
    <div>
      <PageHeader
        title="Campaigns"
        actions={
          <Link href="/dashboard/create" className={buttonVariants()}>
            Create Link
          </Link>
        }
      />

      {hasError ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center text-center gap-4 py-12">
            <div className="rounded-full bg-destructive/10 p-3">
              <AlertTriangle className="size-6 text-destructive" />
            </div>
            <div>
              <p className="text-foreground font-medium">Couldn&apos;t load your campaigns</p>
              <p className="text-sm text-muted-foreground mt-1">
                Something went wrong. Please try again.
              </p>
            </div>
            <Link href="/dashboard/campaigns" className={buttonVariants({ variant: 'outline' })}>
              Try again
            </Link>
          </CardContent>
        </Card>
      ) : campaignStats.length > 0 ? (
        <Card className="bg-card border-border overflow-hidden gap-0 py-0">
          <div className="divide-y divide-border">
            {campaignStats.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/dashboard/campaigns/${campaign.id}`}
                className="block px-4 py-4 outline-none transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-foreground">{campaign.name}</h3>
                    {campaign.description && (
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">{campaign.description}</p>
                    )}
                  </div>
                  {/* Fixed right-aligned columns from sm up, so the numbers line
                      up down the list. The click count is the value: it takes the
                      foreground color, the labels stay muted. */}
                  <div className="flex shrink-0 flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground sm:flex-nowrap sm:gap-6">
                    <span className="sm:w-20 sm:text-right">
                      <span className="font-mono tabular-nums">
                        {campaign.totalLinks.toLocaleString('en-US')}
                      </span>{' '}
                      {campaign.totalLinks === 1 ? 'link' : 'links'}
                    </span>
                    <span className="sm:w-28 sm:text-right">
                      <span className="font-mono tabular-nums text-foreground">
                        {campaign.totalClicks.toLocaleString('en-US')}
                      </span>{' '}
                      {campaign.totalClicks === 1 ? 'click' : 'clicks'}
                    </span>
                    <span className="sm:w-40 sm:text-right">
                      Created {formatDate(campaign.created_at)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center text-center gap-4 py-12">
            <p className="text-muted-foreground">No campaigns yet. Create one when making a new link.</p>
            <Link href="/dashboard/create" className={buttonVariants()}>
              Create Link
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
