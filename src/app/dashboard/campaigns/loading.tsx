// Route-level Suspense fallback for /dashboard/campaigns: the header with
// the range control, then the campaigns ledger.

function Bar({ className }: { className: string }) {
  return <div className={`rounded-[2px] bg-sunk ${className}`} />
}

function Header({ back }: { back?: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pt-7 pb-4 md:pt-10 md:pb-6">
      <div className="min-w-0">
        {back && <Bar className="mb-3 h-4 w-20" />}
        <Bar className="h-8 w-48 max-w-full md:h-10 md:w-56" />
        <Bar className="mt-3 h-4 w-80 max-w-full" />
      </div>
      <Bar className="h-11 w-full md:h-9 md:w-[300px]" />
    </div>
  )
}

function TableSkeleton({ rows, title }: { rows: number; title?: boolean }) {
  return (
    <div className={title ? 'rule-open pt-3.5' : 'rule-open pt-4'}>
      {title && (
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <Bar className="h-6 w-44" />
          <Bar className="h-3.5 w-16" />
        </div>
      )}
      <div className="flex justify-between gap-4 border-b border-ink-2 pb-2.5">
        <Bar className="h-3 w-20" />
        <Bar className="h-3 w-32" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-4 border-b border-rule py-3.5">
          <div className="min-w-0">
            <Bar className="h-4 w-40" />
            <Bar className="mt-1.5 h-3.5 w-56 max-w-full" />
          </div>
          <Bar className="h-4 w-24 shrink-0" />
        </div>
      ))}
    </div>
  )
}

export default function CampaignsLoading() {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="animate-pulse">
      <span className="sr-only">Loading campaigns</span>
      <Header />
      <TableSkeleton rows={4} />
    </div>
  )
}
