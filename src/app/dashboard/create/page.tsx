import { getAuthenticatedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CreateLinkForm } from '@/components/CreateLinkForm'
import { PageHeader } from '@/components/dashboard/PageHeader'

export default async function CreateLinkPage() {
  const user = await getAuthenticatedUser()
  if (!user) redirect('/login')

  return (
    // One column for the title and the form, so they share a left edge.
    <div className="max-w-2xl">
      <PageHeader title="Create Link" backHref="/dashboard" backLabel="Back to dashboard" />

      <CreateLinkForm initialUser={{ id: user.id }} showHeader={false} />
    </div>
  )
}
