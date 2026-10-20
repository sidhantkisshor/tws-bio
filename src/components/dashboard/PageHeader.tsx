import Link from 'next/link'
import { useId } from 'react'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

// One header for every dashboard page: the serif page title, an optional
// one-line description in secondary text, and the actions at the right
// (range control, Export CSV), bottom-aligned with the title. On phones the
// actions wrap below and span the full width. The section rule that follows
// (KPI row, toolbar) belongs to the next block; pass `rule` when the page has
// no ruled block straight after the header.
export function PageHeader({
  title,
  description,
  backHref,
  backLabel = 'Back',
  actions,
  actionsClassName,
  titleAccessory,
  titleClassName,
  rule = false,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  backHref?: string
  backLabel?: string
  actions?: React.ReactNode
  actionsClassName?: string
  titleAccessory?: React.ReactNode
  titleClassName?: string
  /** Draw the 2px ink rule under the header. */
  rule?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pt-7 pb-4 md:pt-10 md:pb-6',
        rule && 'mb-6 border-b-2 border-rule-strong',
        className,
      )}
    >
      <div className="min-w-0">
        {backHref && (
          <Link
            href={backHref}
            className="focus-ring -ml-1 mb-2 inline-flex min-h-11 items-center gap-1 rounded-ctl pr-2 text-[13px] font-medium text-text-2 transition-colors duration-150 hover:text-ink sm:min-h-8"
          >
            <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden />
            {backLabel}
          </Link>
        )}
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className={cn('type-title min-w-0 text-ink [overflow-wrap:anywhere]', titleClassName)}>
            {title}
          </h1>
          {titleAccessory}
        </div>
        {description &&
          (typeof description === 'string' ? (
            <p className="mt-2 max-w-[70ch] text-sm text-text-2">{description}</p>
          ) : (
            <div className="mt-2 min-w-0 text-sm text-text-2">{description}</div>
          ))}
      </div>
      {actions && (
        <div
          className={cn(
            'flex w-full flex-wrap items-center gap-3 md:w-auto',
            actionsClassName,
          )}
        >
          {actions}
        </div>
      )}
    </div>
  )
}

/**
 * A ruled block: the 2px ink rule opens it, a serif section title on the left,
 * and a caption (window label) or actions on the right. Every dashboard
 * section uses it, so the rhythm is the same on every page. Not a card: no
 * fill, no border box.
 */
export function Section({
  title,
  caption,
  actions,
  children,
  className,
  headClassName,
  level = 2,
  id,
}: {
  title: React.ReactNode
  /** Short context in tertiary text at the right, e.g. "Last 90 days". */
  caption?: React.ReactNode
  /** Controls or a text link at the right, after the caption. */
  actions?: React.ReactNode
  children?: React.ReactNode
  className?: string
  headClassName?: string
  /** 2 for a section (22px serif over a 2px rule), 3 for a sub-section (18px over a 1px rule). */
  level?: 2 | 3
  id?: string
}) {
  const autoId = useId()
  const headingId = id ?? `section-${autoId.replace(/[:]/g, '')}`
  const Heading = level === 2 ? 'h2' : 'h3'
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'min-w-0',
        level === 2 ? 'rule-open pt-3.5' : 'rule-sub pt-3',
        className,
      )}
    >
      <div
        className={cn(
          'mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1',
          level === 3 && 'mb-3',
          headClassName,
        )}
      >
        <Heading id={headingId} className={cn(level === 2 ? 'type-h2' : 'type-h3', 'text-ink')}>
          {title}
        </Heading>
        {(caption || actions) && (
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            {caption && <span className="text-[13px] text-text-3">{caption}</span>}
            {actions}
          </div>
        )}
      </div>
      {children}
    </section>
  )
}
