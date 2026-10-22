import { LoginForm } from '@/components/auth/LoginForm'
import { cn } from '@/lib/utils'

interface SignInPanelProps {
  /** h1 on /login, where the panel is the page; h2 on the home page. */
  headingLevel?: 1 | 2
  className?: string
}

/**
 * The sign-in panel, one of the two raised panels in Day Book (surface fill,
 * hairline border, 6px radius). Shared by the home page and /login so the two
 * cannot drift. Accounts are invite-only, so there is no sign-up offer.
 */
export function SignInPanel({ headingLevel = 2, className }: SignInPanelProps) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2'
  return (
    <section
      aria-labelledby="sign-in-heading"
      className={cn('grid gap-4 rounded-panel border border-rule bg-surface p-5 sm:p-8', className)}
    >
      <Heading id="sign-in-heading" className="type-h2 text-ink">
        Members only
      </Heading>
      <LoginForm />
    </section>
  )
}
