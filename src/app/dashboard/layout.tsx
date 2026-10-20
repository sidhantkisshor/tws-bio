import { getAuthenticatedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardMasthead } from '@/components/dashboard/DashboardMasthead'
import { Toaster } from '@/components/ui/sonner'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Per-request cached: the dashboard pages reuse this same auth lookup
  // instead of each paying their own round trip to the Auth server.
  const user = await getAuthenticatedUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <>
      <div className="min-h-screen bg-page text-ink">
        <DashboardMasthead userEmail={user.email || ''} />
        {/* Content: max width 1280, gutters 40 on desktop and 16 on phones.
            overflow-x-clip keeps a wide child from scrolling the page
            sideways; tables that need it scroll inside themselves. */}
        <main className="mx-auto max-w-[1280px] overflow-x-clip px-4 pb-14 md:px-10">
          {children}
        </main>
      </div>
      {/* Every dashboard action can toast (edit, delete, export, create). */}
      <Toaster />
    </>
  )
}
