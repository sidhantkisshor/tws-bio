import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthShell } from '@/components/auth/AuthShell'
import { buttonVariants } from '@/components/ui/button-variants'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Invite only - tws.bio',
  description: 'tws.bio has no public sign-up. Sidhant creates each account.',
}

// Signups are disabled on the Supabase project, so there is no form to show.
// The route stays so old links to /signup land somewhere useful.
export default function SignupPage() {
  return (
    <AuthShell>
      <section className="grid gap-4 rounded-panel border border-rule bg-surface p-5 sm:p-8">
        <div className="grid gap-2">
          <h1 className="type-h2 text-ink">Accounts are invite-only</h1>
          <p className="text-[15px] leading-relaxed text-text-2">
            tws.bio is the link tool of the Trading with Sidhant team. There is no public sign-up:
            Sidhant creates each account. If you are on the team and need one, ask him.
          </p>
        </div>
        <Link href="/login" className={cn(buttonVariants({ size: 'lg' }), 'w-full')}>
          Sign in
        </Link>
        <p className="text-[13px] text-text-2">
          Looking for a course or a video?{' '}
          <Link
            href="/"
            className="rounded-ctl text-accent-text underline decoration-accent-text/40 underline-offset-[3px] hover:decoration-current focus-ring"
          >
            See where to go
          </Link>
          .
        </p>
      </section>
    </AuthShell>
  )
}
