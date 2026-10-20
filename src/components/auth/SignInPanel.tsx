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
 * cannot drift. Accounts are invite-only, so the line under the title says
 * who it is for instead of offering a sign-up.
 */
export function SignInPanel({ headingLevel = 2, className }: SignInPanelProps) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2'
  return (
    <section
      aria-labelledby="sign-in-heading"
      className={cn('grid gap-4 rounded-panel border border-rule bg-surface p-5 sm:p-8', className)}
    >
      <div className="grid gap-1.5">
        <Heading id="sign-in-heading" className="type-h2 text-ink">
          Sign in
        </Heading>
        <p className="text-[13px] leading-normal text-text-2">
          For the Trading with Sidhant team. Sidhant creates each account.
        </p>
      </div>
      <LoginForm />
    </section>
  )
}
