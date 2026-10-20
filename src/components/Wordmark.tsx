import { cn } from '@/lib/utils'

// The one brand lockup: the favicon's green tick bar beside the name. Size and
// color come from the caller (the nav pills, the footer); the bar stays green.
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-bold tracking-tight', className)}>
      <span aria-hidden className="h-[0.85em] w-0.5 bg-primary-text" />
      tws.bio
    </span>
  )
}
