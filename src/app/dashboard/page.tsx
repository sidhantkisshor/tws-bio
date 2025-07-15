import { createClient } from '../../lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '../../components/ui/button'
import { getShortUrl } from '../../lib/utils'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  const { data: links } = await supabase
    .from('links')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-100">
      <nav className="border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
              tws.bio
            </span>
          </Link>
          <div className="flex items-center space-x-4">
            <Link href="/dashboard/new">
              <Button size="sm">Create Link</Button>
            </Link>
            <form action="/auth/signout" method="post">
              <Button variant="ghost" size="sm" type="submit">
                Sign Out
              </Button>
            </form>
          </div>
        </div>
      </nav>

      <main className="container px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Your Links</h1>
          <p className="text-gray-500 mt-2">
            Manage and track all your shortened links
          </p>
        </div>

        {!links || links.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">
              You haven't created any links yet
            </p>
            <Link href="/dashboard/new">
              <Button>Create Your First Link</Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {links.map((link) => (
              <div
                key={link.id}
                className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold">
                      {link.title || 'Untitled Link'}
                    </h3>
                    <p className="text-sm text-blue-600 mt-1">
                      {getShortUrl(link.short_code)}
                    </p>
                    <p className="text-sm text-gray-500 mt-1 truncate max-w-md">
                      {link.original_url}
                    </p>
                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                      <span>{link.total_clicks} clicks</span>
                      <span>•</span>
                      <span>
                        Created {new Date(link.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/dashboard/links/${link.id}`}>
                      <Button variant="outline" size="sm">
                        View Stats
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
} 