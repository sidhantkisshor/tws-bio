// ClicksOverTimeChart previously hand-rolled its own AreaChart with hardcoded
// hex colors (#00B03B stroke, #1f1f1f grid, #a3a3a3 ticks, #111111 tooltip)
// and an en-IN locale, duplicating ClickChart's shadcn ChartContainer
// implementation with a different look and a different date format. Both
// render the same `{ date, clicks }[]` shape, so this re-exports the single
// canonical component (CSS-variable chart tokens, one locale) instead of
// maintaining two implementations of the same chart.
export { ClickChart as ClicksOverTimeChart } from '@/components/dashboard/ClickChart'
