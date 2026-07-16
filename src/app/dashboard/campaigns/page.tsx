import { getAuthenticatedUser, createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  // yet" — check the error field explicitly instead of falling through the
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
      <div className="flex items-center justify-between mb-6 gap-4">
        <h1 className="font-heading text-2xl text-foreground">Campaigns</h1>
        <Button render={<Link href="/dashboard/create" />}>
          Create Link
        </Button>
      </div>

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
            <Button render={<Link href="/dashboard/campaigns" />} variant="outline">
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : campaignStats.length > 0 ? (
        <Card className="bg-card border-border overflow-hidden">
          <div className="divide-y divide-border">
            {campaignStats.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/dashboard/campaigns/${campaign.id}`}
                className="block px-6 py-4 hover:bg-muted"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{campaign.name}</h3>
                    {campaign.description && (
                      <p className="text-sm text-muted-foreground mt-0.5">{campaign.description}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 sm:gap-6 text-sm text-muted-foreground">
                    <span>{campaign.totalLinks} links</span>
                    <span>{campaign.totalClicks.toLocaleString()} clicks</span>
                    <span>{formatDate(campaign.created_at)}</span>
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
            <Button render={<Link href="/dashboard/create" />}>
              Create Link
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
