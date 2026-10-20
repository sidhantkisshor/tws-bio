/**
 * Route-level fallback for /dashboard (Overview), and for any dashboard
 * route without its own loading.tsx. Plain sunk blocks in the page's own
 * layout: header, KPI row, chart beside top movers, sources beside best time
 * to post, then top links. No shimmer, no animation.
 */
function Block({ className }: { className: string }) {
  return <div className={`rounded-[2px] bg-sunk ${className}`} />
}

function SectionHead() {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <Block className="h-6 w-40" />
      <Block className="h-3.5 w-28" />
    </div>
  )
}

export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>

      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pt-7 pb-4 md:pt-10 md:pb-6">
        <div className="min-w-0">
          <Block className="h-9 w-44" />
          <Block className="mt-3 h-4 w-72 max-w-full" />
        </div>
        <Block className="h-11 w-full md:h-9 md:w-80" />
      </div>

      {/* KPI row */}
      <div className="rule-open mb-2 grid grid-cols-2 lg:grid-cols-4 [&>*]:border-rule [&>*:nth-child(even)]:border-l [&>*:nth-child(even)]:pl-4 [&>*:nth-child(n+3)]:border-t lg:[&>*:nth-child(n+2)]:border-l lg:[&>*:nth-child(n+2)]:pl-6 lg:[&>*:nth-child(n+3)]:border-t-0">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="py-4 pr-2">
            <Block className="h-3.5 w-20" />
            <Block className="mt-3 h-9 w-24 md:h-11" />
            <Block className="mt-3 h-3.5 w-24" />
          </div>
        ))}
      </div>

      {/* Clicks per day beside top movers */}
      <div className="mt-8 mb-9 grid grid-cols-1 gap-9 md:mt-10 lg:mb-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-12">
        <div className="rule-open pt-3.5">
          <SectionHead />
          <Block className="h-[220px] w-full md:h-[280px]" />
        </div>
        <div className="rule-open pt-3.5">
          <SectionHead />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex justify-between border-b border-rule py-2.5 last:border-b-0">
              <Block className="h-4 w-24" />
              <Block className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* Sources beside best time to post */}
      <div className="mb-9 grid grid-cols-1 gap-9 lg:mb-12 lg:grid-cols-2 lg:gap-12">
        <div className="rule-open pt-3.5">
          <SectionHead />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="py-2.5">
              <Block className="h-4 w-full" />
              <Block className="mt-2 h-1.5 w-2/3" />
            </div>
          ))}
        </div>
        <div className="rule-open pt-3.5">
          <SectionHead />
          <Block className="h-4 w-3/4" />
          <Block className="mt-4 h-44 w-full" />
        </div>
      </div>

      {/* Top links */}
      <div className="rule-open pt-3.5">
        <SectionHead />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex justify-between gap-4 border-b border-rule py-3.5 last:border-b-0">
            <Block className="h-4 w-40" />
            <Block className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}
