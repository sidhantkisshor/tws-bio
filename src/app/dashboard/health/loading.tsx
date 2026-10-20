/**
 * Fallback for /dashboard/health in the page's own layout: header, the
 * severity counts, a ruled list of issues and the destinations block. Plain
 * sunk blocks, no shimmer, no animation.
 */
function Block({ className }: { className: string }) {
  return <div className={`rounded-[2px] bg-sunk ${className}`} />
}

export default function HealthLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>

      <div className="pt-7 pb-4 md:pt-10 md:pb-6">
        <Block className="h-9 w-32" />
        <Block className="mt-3 h-4 w-80 max-w-full" />
      </div>

      <div className="rule-open mb-2 grid grid-cols-2 lg:grid-cols-4 [&>*]:border-rule [&>*:nth-child(even)]:border-l [&>*:nth-child(even)]:pl-4 [&>*:nth-child(n+3)]:border-t lg:[&>*:nth-child(n+2)]:border-l lg:[&>*:nth-child(n+2)]:pl-6 lg:[&>*:nth-child(n+3)]:border-t-0">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="py-4 pr-2">
            <Block className="h-3.5 w-20" />
            <Block className="mt-3 h-9 w-14 md:h-11" />
          </div>
        ))}
      </div>

      <div className="rule-open mt-8 pt-3.5 md:mt-10">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <Block className="h-6 w-28" />
          <Block className="h-3.5 w-40" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-rule py-3.5 last:border-b-0">
            <Block className="h-5 w-20 shrink-0" />
            <Block className="h-4 flex-1" />
            <Block className="hidden h-4 w-16 md:block" />
          </div>
        ))}
      </div>

      <div className="rule-open mt-9 pt-3.5 lg:mt-12">
        <Block className="mb-4 h-6 w-32" />
        <Block className="h-11 w-full sm:h-9 sm:w-56" />
      </div>
    </div>
  )
}
