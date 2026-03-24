import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function CampaignsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, description, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const campaignStats = await Promise.all(
    (campaigns || []).map(async (campaign) => {
      const { data: links } = await supabase
        .from('links')
        .select('id, total_clicks')
        .eq('campaign_id', campaign.id)

      const totalLinks = links?.length || 0
      const totalClicks = links?.reduce((sum, l) => sum + (l.total_clicks || 0), 0) || 0
      return { ...campaign, totalLinks, totalClicks }
    })
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-lg font-bold text-gray-900">Campaigns</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {campaignStats.length > 0 ? (
          <div className="bg-white shadow-sm rounded-lg divide-y divide-gray-200">
            {campaignStats.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/dashboard/campaigns/${campaign.id}`}
                className="block px-6 py-4 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{campaign.name}</h3>
                    {campaign.description && (
                      <p className="text-sm text-gray-500 mt-0.5">{campaign.description}</p>
                    )}
                  </div>
                  <div className="flex gap-6 text-sm text-gray-500">
                    <span>{campaign.totalLinks} links</span>
                    <span>{campaign.totalClicks.toLocaleString()} clicks</span>
                    <span>{campaign.created_at ? new Date(campaign.created_at).toLocaleDateString() : ''}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm">
            <p className="text-gray-500">No campaigns yet. Create one when making a new link.</p>
          </div>
        )}
      </main>
    </div>
  )
}
