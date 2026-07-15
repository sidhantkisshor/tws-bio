import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'

export default async function CampaignsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: campaigns, error: campaignsError } = await supabase
    .from('campaigns')
    .select('id, name, description, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (campaignsError) {
    console.error('[campaigns] campaigns query:', campaignsError)
  }

  const campaignIds = (campaigns || []).map((c) => c.id)
  const { data: allLinks, error: allLinksError } = campaignIds.length > 0
    ? await supabase
        .from('links')
        .select('campaign_id, total_clicks')
        .in('campaign_id', campaignIds)
    : { data: [] as { campaign_id: string | null; total_clicks: number | null }[], error: null }

  if (allLinksError) {
    console.error('[campaigns] links query:', allLinksError)
  }

  // A failed fetch must never render identically to "you have no campaigns
  // yet" — check the error fields explicitly instead of falling through the
  // `campaignStats.length > 0` empty-state branch below.
  const hasError = Boolean(campaignsError || allLinksError)

  const linksByCampaign = new Map<string, { count: number; clicks: number }>()
  for (const link of allLinks || []) {
    if (!link.campaign_id) continue
    const stats = linksByCampaign.get(link.campaign_id) || { count: 0, clicks: 0 }
    stats.count++
    stats.clicks += link.total_clicks || 0
    linksByCampaign.set(link.campaign_id, stats)
  }

  const campaignStats = (campaigns || []).map((campaign) => {
    const stats = linksByCampaign.get(campaign.id) || { count: 0, clicks: 0 }
    return { ...campaign, totalLinks: stats.count, totalClicks: stats.clicks }
  })

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="font-heading text-2xl text-foreground">Campaigns</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              <Link href="/dashboard/campaigns">
                <Button variant="outline">Try again</Button>
              </Link>
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
              <Link href="/dashboard/create">
                <Button>Create Link</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
