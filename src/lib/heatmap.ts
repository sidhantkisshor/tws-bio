// Weekday by hour grid of clicks, in India Standard Time. The SQL side
// (get_click_heatmap, migration 030) returns dow 0 = Monday ... 6 = Sunday.

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

export interface HeatmapWindow {
  dow: number
  startHour: number
  clicks: number
}

export interface Heatmap {
  grid: number[][]
  max: number
  total: number
  peak: { dow: number; hour: number; clicks: number } | null
  bestWindows: HeatmapWindow[]
}

export function dayLabel(dow: number): string {
  return DAYS[dow] ?? ''
}

/** 0 gives "12am", 12 gives "12pm", 23 gives "11pm". */
export function hourLabel(hour: number): string {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return ''
  const h = hour % 12 === 0 ? 12 : hour % 12
  return `${h}${hour < 12 ? 'am' : 'pm'}`
}

export function buildHeatmap(rows: { dow: number; hour: number; clicks: number }[]): Heatmap {
  const grid: number[][] = Array.from({ length: 7 }, () => new Array<number>(24).fill(0))
  for (const r of rows) {
    if (!Number.isInteger(r.dow) || !Number.isInteger(r.hour)) continue
    if (r.dow < 0 || r.dow > 6 || r.hour < 0 || r.hour > 23) continue
    const n = Number(r.clicks)
    if (!Number.isFinite(n) || n <= 0) continue
    grid[r.dow][r.hour] += n
  }

  let max = 0
  let total = 0
  let peak: Heatmap['peak'] = null
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const v = grid[d][h]
      total += v
      if (v > max) {
        max = v
        peak = { dow: d, hour: h, clicks: v }
      }
    }
  }

  // Two-hour windows inside one day (no wrap past midnight), best first.
  const candidates: HeatmapWindow[] = []
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 23; h++) {
      const clicks = grid[d][h] + grid[d][h + 1]
      if (clicks > 0) candidates.push({ dow: d, startHour: h, clicks })
    }
  }
  candidates.sort((a, b) => b.clicks - a.clicks || a.dow - b.dow || a.startHour - b.startHour)
  const bestWindows: HeatmapWindow[] = []
  for (const c of candidates) {
    if (bestWindows.length === 3) break
    const overlaps = bestWindows.some(
      (w) => w.dow === c.dow && Math.abs(w.startHour - c.startHour) < 2,
    )
    if (!overlaps) bestWindows.push(c)
  }

  return { grid, max, total, peak, bestWindows }
}
