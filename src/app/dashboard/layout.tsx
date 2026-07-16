import { getAuthenticatedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Per-request cached — the dashboard pages reuse this same auth lookup
  // instead of each paying their own round trip to the Auth server.
  const user = await getAuthenticatedUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar userEmail={user.email || ''} />
      <main className="flex-1 overflow-x-hidden overflow-y-auto pt-14 md:pt-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
