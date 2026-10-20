/**
 * Route-level Suspense fallback for /dashboard/links. Mirrors the real page's
 * shape (title, ruled toolbar with search, sort and chips, then ledger rows)
 * so a hard navigation (first load, full refresh) gets a layout-matched
 * skeleton instead of a blank screen. The toolbar covers in-page search,
 * filter and sort changes itself.
 */
export default function LinksLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading links</span>

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pt-7 pb-4 md:pt-10 md:pb-6">
        <div>
          <div className="h-9 w-28 rounded-[2px] bg-sunk md:h-10" />
          <div className="mt-3 h-4 w-72 max-w-full rounded-[2px] bg-sunk" />
        </div>
        <div className="h-11 w-28 rounded-ctl bg-sunk sm:h-9" />
      </div>

      <div className="rule-open pt-4 pb-4 md:pb-5">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="h-11 flex-1 rounded-ctl bg-sunk sm:h-9" />
          <div className="h-11 w-full rounded-ctl bg-sunk sm:h-9 md:w-[200px]" />
        </div>
        <div className="mt-3 flex gap-2 overflow-hidden">
          {[56, 64, 80, 88, 72, 96].map((w, i) => (
            <div key={i} className="h-8 shrink-0 rounded-ctl bg-sunk" style={{ width: w }} />
          ))}
        </div>
      </div>

      <div className="border-b border-ink-2 pb-2.5">
        <div className="h-3 w-24 rounded-[2px] bg-sunk" />
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-6 border-b border-rule py-3.5">
          <div className="w-40 shrink-0 space-y-2">
            <div className="h-4 w-full rounded-[2px] bg-sunk" />
            <div className="h-3 w-24 rounded-[2px] bg-sunk" />
          </div>
          <div className="hidden h-4 flex-1 rounded-[2px] bg-sunk md:block" />
          <div className="ml-auto h-4 w-14 rounded-[2px] bg-sunk" />
        </div>
      ))}
    </div>
  )
}
