// Route-level Suspense fallback for /dashboard/links/[id]. Mirrors the page:
// back link, the short link with its destination, meta line and actions, the
// range control, the KPI row, then the ruled sections (clicks per day with
// devices beside where clicks come from, best time to post beside link
// settings, countries and browsers beside what GA4 receives). Opening a link
// or switching its range keeps the same shape.

function Bar({ className }: { className: string }) {
  return <div className={`rounded-[2px] bg-sunk ${className}`} />
}

function SectionSkeleton({
  rows,
  level = 2,
  chart,
}: {
  rows: number
  level?: 2 | 3
  chart?: boolean
}) {
  return (
    <div className={level === 2 ? 'rule-open pt-3.5' : 'rule-sub pt-3'}>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <Bar className={level === 2 ? 'h-6 w-40' : 'h-5 w-24'} />
        <Bar className="h-3.5 w-24" />
      </div>
      {chart ? (
        <Bar className="h-[220px] w-full md:h-[280px]" />
      ) : (
        <div className="flex flex-col gap-4">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i}>
              <div className="flex justify-between gap-4">
                <Bar className="h-4 w-28" />
                <Bar className="h-4 w-20" />
              </div>
              <Bar className={`mt-2 h-1.5 ${['w-full', 'w-3/4', 'w-1/2', 'w-1/3', 'w-1/4', 'w-1/5'][i % 6]}`} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function LinkDetailLoading() {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="animate-pulse">
      <span className="sr-only">Loading link</span>

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pt-7 pb-4 md:pt-10 md:pb-6">
        <div className="min-w-0">
          <Bar className="mb-3 h-4 w-14" />
          {/* The short link with Copy, QR, Edit and More beside it */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Bar className="h-8 w-48 max-w-full md:h-10 md:w-64" />
            <Bar className="h-8 w-48" />
          </div>
          <Bar className="mt-3 h-4 w-72 max-w-full" />
          <Bar className="mt-2.5 h-4 w-56 max-w-full" />
        </div>
        <Bar className="h-11 w-full md:h-9 md:w-[300px]" />
      </div>

      <div className="rule-open mb-9 grid grid-cols-2 md:mb-10 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={`py-4 ${i % 2 === 1 ? 'border-l border-rule pl-4' : ''} ${i >= 2 ? 'border-t border-rule lg:border-t-0' : ''} ${i >= 1 ? 'lg:border-l lg:pl-6' : ''}`}
          >
            <Bar className="h-3.5 w-24" />
            <Bar className="mt-3 h-9 w-24 md:h-11 md:w-32" />
            <Bar className="mt-3 h-3.5 w-20" />
          </div>
        ))}
      </div>

      <div className="grid gap-9 md:gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-10">
          <SectionSkeleton rows={0} chart />
          <SectionSkeleton rows={3} level={3} />
        </div>
        <SectionSkeleton rows={6} />
      </div>

      <div className="mt-9 grid gap-9 md:mt-12 md:gap-12 lg:grid-cols-2">
        <div className="rule-open pt-3.5">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <Bar className="h-6 w-40" />
            <Bar className="h-3.5 w-32" />
          </div>
          <Bar className="h-10 w-full max-w-[60ch]" />
          <Bar className="mt-4 h-[170px] w-full" />
        </div>
        <SectionSkeleton rows={5} />
      </div>

      <div className="mt-9 grid gap-9 md:mt-12 md:gap-12 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-10">
          <SectionSkeleton rows={5} />
          <SectionSkeleton rows={4} level={3} />
        </div>
        <SectionSkeleton rows={6} />
      </div>
    </div>
  )
}
