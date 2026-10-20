import { cn } from '@/lib/utils'

// The one brand lockup: "tws.bio" set in Satoshi Bold. Size and color come
// from the caller (masthead 19px ink, footer smaller); there is no accent in
// it, because amber is kept for actions.
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center font-sans font-bold tracking-[-0.01em]', className)}>
      tws.bio
    </span>
  )
}
