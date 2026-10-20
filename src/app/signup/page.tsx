import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthShell } from '@/components/auth/AuthShell'
import { buttonVariants } from '@/components/ui/button-variants'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Invite only - tws.bio',
  description: 'tws.bio accounts are invite-only.',
}

// Signups are disabled on the Supabase project, so there is no form to show.
// The route stays so old links to /signup land somewhere useful.
export default function SignupPage() {
  return (
    <AuthShell
      title="Accounts are invite-only"
      description="tws.bio has no public sign-up. If you need an account, ask the owner."
    >
      <Link href="/login" className={cn(buttonVariants(), 'w-full')}>
        Sign in
      </Link>
    </AuthShell>
  )
}
