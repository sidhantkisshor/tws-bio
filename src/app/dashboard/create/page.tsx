import { getAuthenticatedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CreateLinkForm } from '@/components/CreateLinkForm'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function CreateLinkPage() {
  const user = await getAuthenticatedUser()
  if (!user) redirect('/login')

  return (
    <div>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="size-4" />
        Back to dashboard
      </Link>

      <h1 className="font-heading text-2xl text-foreground mb-6">Create Link</h1>

      <CreateLinkForm initialUser={{ id: user.id }} />
    </div>
  )
}
