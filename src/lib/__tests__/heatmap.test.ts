import { describe, it, expect } from 'vitest'
import { buildHeatmap, dayLabel, hourLabel } from '../heatmap'

describe('labels', () => {
  it('names days Monday first', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(dayLabel)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
    expect(dayLabel(7)).toBe('')
  })
  it('names hours on a 12 hour clock', () => {
    expect(hourLabel(0)).toBe('12am')
    expect(hourLabel(1)).toBe('1am')
    expect(hourLabel(11)).toBe('11am')
    expect(hourLabel(12)).toBe('12pm')
    expect(hourLabel(13)).toBe('1pm')
    expect(hourLabel(23)).toBe('11pm')
    expect(hourLabel(24)).toBe('')
    expect(hourLabel(-1)).toBe('')
  })
})

describe('buildHeatmap', () => {
  it('returns an empty 7x24 grid for no rows', () => {
    const h = buildHeatmap([])
    expect(h.grid).toHaveLength(7)
    expect(h.grid.every((r) => r.length === 24 && r.every((v) => v === 0))).toBe(true)
    expect(h).toMatchObject({ max: 0, total: 0, peak: null, bestWindows: [] })
  })

  it('places clicks, finds the peak, and totals', () => {
    const h = buildHeatmap([
      { dow: 0, hour: 21, clicks: 40 },
      { dow: 6, hour: 12, clicks: 10 },
      { dow: 0, hour: 21, clicks: 5 },
    ])
    expect(h.grid[0][21]).toBe(45)
    expect(h.grid[6][12]).toBe(10)
    expect(h.max).toBe(45)
    expect(h.total).toBe(55)
    expect(h.peak).toEqual({ dow: 0, hour: 21, clicks: 45 })
  })

  it('first cell wins a tie for the peak', () => {
    const h = buildHeatmap([
      { dow: 3, hour: 5, clicks: 9 },
      { dow: 1, hour: 8, clicks: 9 },
    ])
    expect(h.peak).toEqual({ dow: 1, hour: 8, clicks: 9 })
  })

  it('ignores out of range and non-positive rows', () => {
    const h = buildHeatmap([
      { dow: 7, hour: 0, clicks: 5 },
      { dow: 0, hour: 24, clicks: 5 },
      { dow: -1, hour: 3, clicks: 5 },
      { dow: 2, hour: 2, clicks: 0 },
      { dow: 2, hour: 3, clicks: Number.NaN },
    ])
    expect(h.total).toBe(0)
  })

  it('picks the top 3 non-overlapping 2-hour windows', () => {
    const h = buildHeatmap([
      { dow: 0, hour: 20, clicks: 30 },
      { dow: 0, hour: 21, clicks: 50 },
      { dow: 0, hour: 22, clicks: 40 },
      { dow: 2, hour: 12, clicks: 45 },
      { dow: 4, hour: 9, clicks: 5 },
    ])
    expect(h.bestWindows[0]).toEqual({ dow: 0, startHour: 21, clicks: 90 })
    // 20-21 and 22-23 overlap the winner on the same day, so they are skipped.
    expect(h.bestWindows[1]).toEqual({ dow: 2, startHour: 11, clicks: 45 })
    expect(h.bestWindows).toHaveLength(3)
    // The 19-20 window on Monday ends before the winner starts, so it is allowed.
    expect(h.bestWindows[2]).toEqual({ dow: 0, startHour: 19, clicks: 30 })
  })

  it('allows two windows on one day when they do not overlap (ties pick the earlier hour)', () => {
    const h = buildHeatmap([
      { dow: 1, hour: 8, clicks: 10 },
      { dow: 1, hour: 20, clicks: 10 },
    ])
    expect(h.bestWindows.map((w) => w.startHour).sort((a, b) => a - b)).toEqual([7, 19])
  })

  it('does not wrap a window past midnight', () => {
    const h = buildHeatmap([{ dow: 0, hour: 23, clicks: 4 }])
    expect(h.bestWindows).toEqual([{ dow: 0, startHour: 22, clicks: 4 }])
  })
})
