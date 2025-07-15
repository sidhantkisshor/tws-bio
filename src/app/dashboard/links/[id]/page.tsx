import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function LinkStatsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Fetch link details
  const { data: link, error: linkError } = await supabase
    .from('links')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (linkError || !link) {
    redirect('/dashboard');
  }

  // Fetch click analytics
  const { data: clicks, error: clicksError } = await supabase
    .from('clicks')
    .select('*')
    .eq('link_id', id)
    .order('clicked_at', { ascending: false })
    .limit(100);

  // Calculate analytics
  const totalClicks = link.total_clicks || 0;
  const clicksByDevice = clicks?.reduce((acc, click) => {
    acc[click.device_type || 'unknown'] = (acc[click.device_type || 'unknown'] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const clicksByCountry = clicks?.reduce((acc, click) => {
    if (click.country) {
      acc[click.country] = (acc[click.country] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-blue-600 hover:text-blue-700 mb-4 inline-block"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Link Statistics</h1>
          <p className="text-gray-600 mt-2">{link.short_code}</p>
        </div>

        {/* Link Details */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Link Details</h2>
          <div className="space-y-2">
            <p>
              <span className="font-medium">Short URL:</span>{' '}
              <a
                href={`${process.env.NEXT_PUBLIC_SHORT_DOMAIN}/${link.short_code}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {process.env.NEXT_PUBLIC_SHORT_DOMAIN}/{link.short_code}
              </a>
            </p>
            <p>
              <span className="font-medium">Destination:</span>{' '}
              <a
                href={link.original_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline truncate inline-block max-w-md"
              >
                {link.original_url}
              </a>
            </p>
            <p>
              <span className="font-medium">Created:</span>{' '}
              {new Date(link.created_at).toLocaleString()}
            </p>
            <p>
              <span className="font-medium">Total Clicks:</span> {totalClicks}
            </p>
          </div>
        </div>

        {/* Device Analytics */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Clicks by Device</h2>
          {Object.keys(clicksByDevice).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(clicksByDevice).map(([device, count]) => (
                <div key={device} className="flex justify-between">
                  <span className="capitalize">{device}</span>
                  <span className="font-medium">{String(count)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No click data yet</p>
          )}
        </div>

        {/* Country Analytics */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Clicks by Country</h2>
          {Object.keys(clicksByCountry).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(clicksByCountry)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .slice(0, 10)
                .map(([country, count]) => (
                  <div key={country} className="flex justify-between">
                    <span>{country}</span>
                    <span className="font-medium">{String(count)}</span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-gray-500">No location data yet</p>
          )}
        </div>

        {/* Recent Clicks */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Clicks</h2>
          {clicks && clicks.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Time
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Device
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Browser
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Country
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {clicks.slice(0, 20).map((click) => (
                    <tr key={click.id}>
                      <td className="px-4 py-2 text-sm">
                        {new Date(click.clicked_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-sm capitalize">
                        {click.device_type || 'unknown'}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {click.browser_name || '-'}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {click.country || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500">No clicks recorded yet</p>
          )}
        </div>
      </div>
    </div>
  );
}