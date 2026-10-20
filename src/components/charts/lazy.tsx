'use client'

import { createContext, useContext, type ComponentProps } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
// Type-only imports: a value import would put recharts back in the page's
// entry chunk, which is the whole thing this file exists to avoid.
import type { ClickChart } from '@/components/dashboard/ClickChart'

// recharts is the largest chunk in the app (about 400 KB raw), and every chart
// page loaded it statically, so the sidebar, filters and links waited for it
// before they hydrated. These wrappers fetch each chart after hydration, and
// the server HTML carries a same-size placeholder in place of the chart.

// next/dynamic renders `loading` without the chart's props, so each wrapper
// hands its box classes down through context. The placeholder then takes the
// same space the chart will, and the card does not jump when the chart loads.
const PlaceholderBox = createContext('')

function ChartPlaceholder() {
  const box = useContext(PlaceholderBox)
  // ChartContainer is `aspect-video` plus the caller's classes, so the same
  // pair gives the same box, even for a caller that sets no height.
  return <div aria-hidden="true" className={cn('aspect-video rounded-md bg-muted/30', box)} />
}

const ClickChartImpl = dynamic(
  () => import('@/components/dashboard/ClickChart').then((m) => m.ClickChart),
  { ssr: false, loading: ChartPlaceholder },
)

// ClickChart draws every state (chart, empty, error) at h-64.
const CLICK_CHART_BOX = 'h-64 w-full'

export function LazyClickChart(props: ComponentProps<typeof ClickChart>) {
  return (
    <PlaceholderBox.Provider value={CLICK_CHART_BOX}>
      <ClickChartImpl {...props} />
    </PlaceholderBox.Provider>
  )
}

// The same chart, under the name the analytics, campaign and link detail
// pages import.
export { LazyClickChart as LazyClicksOverTimeChart }

