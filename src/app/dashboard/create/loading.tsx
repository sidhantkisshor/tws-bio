/**
 * Route-level Suspense fallback for /dashboard/create. It has the real page's
 * shape: the title and its line, the 2px rule, then the form fields on the
 * left and the raised preview panel on the right (under the form on phones),
 * so the layout does not jump when the page arrives. Static blocks, no motion.
 */
export default function CreateLinkLoading() {
  const field = (labelWidth: string) => (
    <div className="grid gap-2">
      <div className={`h-3.5 rounded-ctl bg-sunk ${labelWidth}`} />
      <div className="h-11 w-full rounded-ctl border border-rule bg-surface sm:h-9" />
      <div className="h-3 w-3/4 rounded-ctl bg-sunk" />
    </div>
  )

  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the new link form</span>
      {/* PageHeader: title and description */}
      <div className="pt-7 pb-4 md:pt-10 md:pb-6">
        <div className="h-[33px] w-40 rounded-ctl bg-sunk md:h-[40px]" />
        <div className="mt-3 h-4 w-64 max-w-full rounded-ctl bg-sunk" />
      </div>

      <div className="@container">
        <div className="rule-open grid gap-8 pt-5 @4xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] @4xl:gap-14 @4xl:pt-7">
          <div className="grid max-w-[560px] content-start gap-[22px]">
            {field('w-24')}
            {field('w-28')}
            <div className="grid gap-[22px] sm:grid-cols-2 sm:gap-4">
              {field('w-24')}
              {field('w-36')}
            </div>
            <div className="flex h-11 items-center border-y border-rule sm:h-9">
              <div className="h-3.5 w-48 rounded-ctl bg-sunk" />
            </div>
            <div className="flex gap-3 pt-1">
              <div className="h-11 flex-1 rounded-ctl bg-sunk sm:h-10 sm:w-28 sm:flex-none" />
              <div className="h-11 flex-1 rounded-ctl border border-rule bg-surface sm:h-10 sm:w-24 sm:flex-none" />
            </div>
          </div>

          <div className="self-start rounded-panel border border-rule bg-surface p-[18px] sm:p-6">
            <div className="h-3 w-16 rounded-ctl bg-sunk" />
            <div className="rule-total mt-2.5 mb-4 pb-4">
              <div className="h-7 w-56 max-w-full rounded-ctl bg-sunk" />
            </div>
            <div className="grid gap-3">
              <div className="h-3.5 w-full rounded-ctl bg-sunk" />
              <div className="h-3.5 w-4/5 rounded-ctl bg-sunk" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
