import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

// One header for every dashboard page, so titles share a weight, a wrap rule
// and a back-link shape. The optional back link is a chevron (44px on touch
// screens, 40px with a pointer); actions sit at the right and wrap below the
// title on narrow screens.
export function PageHeader({
  title,
  description,
  backHref,
  backLabel = 'Back',
  actions,
  titleClassName,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  backHref?: string
  backLabel?: string
  actions?: React.ReactNode
  titleClassName?: string
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {backHref && (
          <Link
            href={backHref}
            aria-label={backLabel}
            className="focus-ring -ml-2 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground sm:size-10"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
        )}
        <div className="min-w-0">
          <h1 className={cn('truncate text-2xl font-semibold tracking-tight text-foreground', titleClassName)}>
            {title}
          </h1>
          {description && (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
