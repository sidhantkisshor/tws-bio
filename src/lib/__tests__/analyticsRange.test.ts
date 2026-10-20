import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CHART_TIME_ZONE,
  RANGE_DAYS,
  SPARKLINE_DAYS,
  dayKey,
  parseTimeRange,
  rangeWindow,
  sparklineWindow,
  zeroFillDays,
} from '@/lib/analytics'
import { fillDailyClicks } from '@/lib/linkFilters'

// analytics.ts also holds the RPC helpers, which import the request-scoped
// Supabase client. These specs only cover the pure range helpers.
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  getAuthenticatedUser: vi.fn(),
}))

const DAY = 24 * 60 * 60 * 1000
// 14:30 UTC, which is 20:00 in India: late enough in the day that a rolling
// `now - N days` start would show up as a partial first bucket.
const NOW = new Date('2026-10-19T14:30:00.000Z')
// 00:00 on 19 October in India (IST, UTC+5:30), the start of NOW's day.
const TODAY_START = Date.parse('2026-10-18T18:30:00.000Z')

const total = (rows: { clicks: number }[]) => rows.reduce((sum, row) => sum + row.clicks, 0)

// The date in India by the time zone database, built from parts so that no
// locale's date order is involved.
const kolkataParts = new Intl.DateTimeFormat('en-US', {
  timeZone: CHART_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function kolkataDate(date: Date): string {
  const parts = kolkataParts.formatToParts(date)
  const part = (type: string) => parts.find((p) => p.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

describe('parseTimeRange', () => {
  it('accepts the current range values', () => {
    for (const range of ['7d', '30d', '90d', 'all'] as const) {
      expect(parseTimeRange(range)).toBe(range)
    }
  })

  it('maps the legacy Analytics values, so old bookmarks keep their range', () => {
    expect(parseTimeRange('7')).toBe('7d')
    expect(parseTimeRange('30')).toBe('30d')
    expect(parseTimeRange('90')).toBe('90d')
  })

  it('falls back to 30 days for a missing or unknown value', () => {
    const garbage = [
      undefined,
      null,
      '',
      '14',
      '14d',
      '365',
      '30days',
      'ALL',
      '7D',
      ' 7d',
      '7d ',
      'constructor',
      'toString',
      '__proto__',
      'hasOwnProperty',
    ]
    for (const param of garbage) {
      expect(parseTimeRange(param)).toBe('30d')
    }
  })
})

describe('rangeWindow', () => {
  it('covers exactly N whole IST days, ending today', () => {
    // Every bound is IST midnight, which is 18:30 UTC on the date before.
    expect(rangeWindow('7d', NOW)).toEqual({
      since: new Date('2026-10-12T18:30:00.000Z'),
      priorSince: new Date('2026-10-05T18:30:00.000Z'),
      days: 7,
    })
    expect(rangeWindow('30d', NOW)).toEqual({
      since: new Date('2026-09-19T18:30:00.000Z'),
      priorSince: new Date('2026-08-20T18:30:00.000Z'),
      days: 30,
    })
    expect(rangeWindow('90d', NOW)).toEqual({
      since: new Date('2026-07-21T18:30:00.000Z'),
      priorSince: new Date('2026-04-22T18:30:00.000Z'),
      days: 90,
    })
  })

  it('puts the prior window right before the current one, at the same length', () => {
    for (const range of ['7d', '30d', '90d'] as const) {
      // A bounded range types its window as non-null, so no `!` is needed here.
      const { since, priorSince, days } = rangeWindow(range, NOW)
      expect(days).toBe(RANGE_DAYS[range])
      expect(since.getTime() - priorSince.getTime()).toBe(RANGE_DAYS[range] * DAY)
      // Today is the last whole day of the current window.
      expect(TODAY_START - since.getTime()).toBe((RANGE_DAYS[range] - 1) * DAY)
    }
  })

  it('keeps the same window from the first to the last moment of the IST day', () => {
    const expected = rangeWindow('7d', NOW)
    // 00:00, 00:30, 23:59 and 23:59:59.999 on 19 October in India.
    for (const iso of [
      '2026-10-18T18:30:00.000Z',
      '2026-10-18T19:00:00.000Z',
      '2026-10-19T18:29:00.000Z',
      '2026-10-19T18:29:59.999Z',
    ]) {
      expect(rangeWindow('7d', new Date(iso))).toEqual(expected)
    }
    // 00:00 on 20 October in India starts the next window.
    expect(rangeWindow('7d', new Date('2026-10-19T18:30:00.000Z')).since).toEqual(
      new Date('2026-10-13T18:30:00.000Z')
    )
  })

  it('moves at IST midnight even though the UTC date stays the same', () => {
    // 23:30 on the 19th and 00:30 on the 20th in India. Both are 19 October
    // in UTC, but they fall on different IST days.
    expect(rangeWindow('7d', new Date('2026-10-19T18:00:00.000Z')).since).toEqual(
      new Date('2026-10-12T18:30:00.000Z')
    )
    expect(rangeWindow('7d', new Date('2026-10-19T19:00:00.000Z')).since).toEqual(
      new Date('2026-10-13T18:30:00.000Z')
    )
  })

  it('stays put at UTC midnight, which is 05:30 in India', () => {
    expect(rangeWindow('7d', new Date('2026-10-19T23:59:59.999Z'))).toEqual(
      rangeWindow('7d', new Date('2026-10-20T00:00:00.000Z'))
    )
  })

  it('has no bounds for all time', () => {
    expect(rangeWindow('all', NOW)).toEqual({ since: null, priorSince: null, days: null })
  })

  it('defaults now to the current time', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(NOW)
      expect(rangeWindow('30d')).toEqual(rangeWindow('30d', NOW))
    } finally {
      vi.useRealTimers()
    }
  })

  it('lists the day count of each bounded range', () => {
    expect(RANGE_DAYS).toEqual({ '7d': 7, '30d': 30, '90d': 90 })
  })
})

describe('day boundaries are IST whatever the server time zone', () => {
  const originalTz = process.env.TZ

  afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ
    else process.env.TZ = originalTz
  })

  // 20:00 UTC on 19 October, which is already 01:30 on 20 October in India.
  const now = new Date('2026-10-19T20:00:00.000Z')

  // [server zone, the server's local hour at `now`]. UTC is where Vercel runs
  // functions, and its date there is still the 19th.
  it.each([
    ['UTC', 20],
    ['Asia/Kolkata', 1],
    ['America/Los_Angeles', 13],
    ['Pacific/Kiritimati', 10],
  ] as [string, number][])('on a server in %s', (zone, localHour) => {
    process.env.TZ = zone
    // Checking the local hour first proves the zone switch took effect, so
    // this case cannot pass by accident.
    expect(now.getHours()).toBe(localHour)
    expect(dayKey(now)).toBe('2026-10-20')
    expect(rangeWindow('7d', now).since).toEqual(new Date('2026-10-13T18:30:00.000Z'))
    expect(sparklineWindow(now).since).toBe('2026-10-06T18:30:00.000Z')
  })
})

describe('dayKey', () => {
  it('labels a moment with its IST calendar day', () => {
    // 00:00, 00:30, 23:59 and the last millisecond of 19 October in India.
    expect(dayKey(new Date('2026-10-18T18:30:00.000Z'))).toBe('2026-10-19')
    expect(dayKey(new Date('2026-10-18T19:00:00.000Z'))).toBe('2026-10-19')
    expect(dayKey(new Date('2026-10-19T18:29:00.000Z'))).toBe('2026-10-19')
    expect(dayKey(new Date('2026-10-19T18:29:59.999Z'))).toBe('2026-10-19')
    // 00:00 and 00:30 on 20 October in India, still the 19th in UTC.
    expect(dayKey(new Date('2026-10-19T18:30:00.000Z'))).toBe('2026-10-20')
    expect(dayKey(new Date('2026-10-19T19:00:00.000Z'))).toBe('2026-10-20')
  })

  it('turns the year at IST midnight, before UTC does', () => {
    expect(dayKey(new Date('2026-12-31T18:29:59.999Z'))).toBe('2026-12-31')
    expect(dayKey(new Date('2026-12-31T18:30:00.000Z'))).toBe('2027-01-01')
  })

  it('agrees with the time zone database for CHART_TIME_ZONE', () => {
    // A wrong offset shows up as a date that turns at the wrong minute. A
    // 37-minute step does not divide a day, so over a year it lands on every
    // minute of the day, both sides of midnight included.
    let checked = 0
    const end = Date.parse('2027-01-01T00:00:00.000Z')
    for (let t = Date.parse('2026-01-01T00:00:00.000Z'); t < end; t += 37 * 60 * 1000) {
      const date = new Date(t)
      if (dayKey(date) !== kolkataDate(date)) {
        expect.fail(`${date.toISOString()}: dayKey ${dayKey(date)}, Intl ${kolkataDate(date)}`)
      }
      checked++
    }
    expect(checked).toBeGreaterThan(14000)
  })
})

describe('zeroFillDays', () => {
  const week = rangeWindow('7d', NOW)

  it('gives one bucket per day: 7 for 7d, 30 for 30d', () => {
    const seven = zeroFillDays([], week.since, week.days)
    expect(seven).toHaveLength(7)
    expect(seven[0].date).toBe('2026-10-13')
    expect(seven[6].date).toBe('2026-10-19')

    const month = rangeWindow('30d', NOW)
    const thirty = zeroFillDays([], month.since, month.days)
    expect(thirty).toHaveLength(30)
    expect(thirty[0].date).toBe('2026-09-20')
    expect(thirty[29].date).toBe('2026-10-19')
    expect(total(thirty)).toBe(0)
  })

  it('fills the days between clicks with zeros', () => {
    const rows = [
      { date: '2026-10-14', clicks: 5 },
      { date: '2026-10-17', clicks: 3 },
    ]
    expect(zeroFillDays(rows, week.since, week.days)).toEqual([
      { date: '2026-10-13', clicks: 0 },
      { date: '2026-10-14', clicks: 5 },
      { date: '2026-10-15', clicks: 0 },
      { date: '2026-10-16', clicks: 0 },
      { date: '2026-10-17', clicks: 3 },
      { date: '2026-10-18', clicks: 0 },
      { date: '2026-10-19', clicks: 0 },
    ])
  })

  it('drops rows outside the window and keeps every click inside it', () => {
    const rows = [
      { date: '2026-10-12', clicks: 9 },
      { date: '2026-10-13', clicks: 1 },
      { date: '2026-10-19', clicks: 2 },
      { date: '2026-10-20', clicks: 4 },
    ]
    const filled = zeroFillDays(rows, week.since, week.days)
    expect(filled).toHaveLength(7)
    expect(filled.map((row) => row.date)).not.toContain('2026-10-12')
    expect(filled.map((row) => row.date)).not.toContain('2026-10-20')
    expect(total(filled)).toBe(3)
  })

  it('charts a day that has begun in India before UTC reaches it', () => {
    // 00:30 on 20 October in India, 19:00 on the 19th in UTC. The RPC labels
    // a click from the last half hour 2026-10-20, and the window ends on it.
    const { since, days } = rangeWindow('7d', new Date('2026-10-19T19:00:00.000Z'))
    const rows = [
      { date: '2026-10-13', clicks: 9 },
      { date: '2026-10-14', clicks: 1 },
      { date: '2026-10-20', clicks: 2 },
    ]
    const filled = zeroFillDays(rows, since, days)
    expect(filled.map((row) => row.date)).toEqual([
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
      '2026-10-19',
      '2026-10-20',
    ])
    expect(filled[0]).toEqual({ date: '2026-10-14', clicks: 1 })
    expect(filled[6]).toEqual({ date: '2026-10-20', clicks: 2 })
    expect(total(filled)).toBe(3)
  })

  it('reads a timestamp by its date and adds up rows on the same day', () => {
    const rows = [
      { date: '2026-10-15T00:00:00+00:00', clicks: 4 },
      { date: '2026-10-15', clicks: 1 },
    ]
    expect(zeroFillDays(rows, week.since, week.days)[2]).toEqual({ date: '2026-10-15', clicks: 5 })
  })

  it('starts on the IST day that holds since, even when since is mid-day', () => {
    // 20:30 on 13 October in India.
    const evening = zeroFillDays([], new Date('2026-10-13T15:00:00.000Z'), 3)
    expect(evening.map((row) => row.date)).toEqual(['2026-10-13', '2026-10-14', '2026-10-15'])
    // 01:30 on 14 October in India, while UTC still says the 13th.
    const night = zeroFillDays([], new Date('2026-10-13T20:00:00.000Z'), 3)
    expect(night.map((row) => row.date)).toEqual(['2026-10-14', '2026-10-15', '2026-10-16'])
  })

  it('crosses month, year and leap-day boundaries', () => {
    const newYear = rangeWindow('7d', new Date('2027-01-03T10:00:00.000Z'))
    expect(zeroFillDays([], newYear.since, newYear.days).map((row) => row.date)).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ])

    // 00:30 on 1 January in India, still 31 December in UTC.
    const newYearsNight = rangeWindow('7d', new Date('2026-12-31T19:00:00.000Z'))
    expect(
      zeroFillDays([], newYearsNight.since, newYearsNight.days).map((row) => row.date)
    ).toEqual([
      '2026-12-26',
      '2026-12-27',
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
    ])

    const leap = rangeWindow('7d', new Date('2028-03-02T10:00:00.000Z'))
    expect(zeroFillDays([], leap.since, leap.days).map((row) => row.date)).toEqual([
      '2028-02-25',
      '2028-02-26',
      '2028-02-27',
      '2028-02-28',
      '2028-02-29',
      '2028-03-01',
      '2028-03-02',
    ])
  })

  describe('with no window (all time)', () => {
    const all = rangeWindow('all', NOW)

    it('runs from the first to the last day that has clicks', () => {
      const rows = [
        { date: '2026-10-04', clicks: 1 },
        { date: '2026-10-01', clicks: 2 },
      ]
      expect(zeroFillDays(rows, all.since, all.days)).toEqual([
        { date: '2026-10-01', clicks: 2 },
        { date: '2026-10-02', clicks: 0 },
        { date: '2026-10-03', clicks: 0 },
        { date: '2026-10-04', clicks: 1 },
      ])
    })

    it('gives a single point for a single day', () => {
      expect(zeroFillDays([{ date: '2026-10-01', clicks: 2 }], all.since, all.days)).toEqual([
        { date: '2026-10-01', clicks: 2 },
      ])
    })

    it('is empty when there are no clicks', () => {
      expect(zeroFillDays([], all.since, all.days)).toEqual([])
    })
  })
})

describe('sparklineWindow', () => {
  it('gives SPARKLINE_DAYS IST days that end today, from IST midnight', () => {
    // 01:30 on 20 October in India, still the 19th in UTC.
    const { since, keys } = sparklineWindow(new Date('2026-10-19T20:00:00.000Z'))
    expect(SPARKLINE_DAYS).toBe(14)
    expect(since).toBe('2026-10-06T18:30:00.000Z')
    expect(keys).toHaveLength(14)
    expect(keys[0]).toBe('2026-10-07')
    expect(keys[13]).toBe('2026-10-20')
  })

  it('moves to the next window at IST midnight, not at UTC midnight', () => {
    // 23:59:59.999 on 19 October in India.
    const before = sparklineWindow(new Date('2026-10-19T18:29:59.999Z'))
    expect(before.since).toBe('2026-10-05T18:30:00.000Z')
    expect(before.keys[13]).toBe('2026-10-19')
    // 00:00 on 20 October in India.
    const after = sparklineWindow(new Date('2026-10-19T18:30:00.000Z'))
    expect(after.since).toBe('2026-10-06T18:30:00.000Z')
    expect(after.keys[13]).toBe('2026-10-20')
    // UTC midnight is 05:30 in India, the middle of that same day.
    expect(sparklineWindow(new Date('2026-10-20T00:00:00.000Z'))).toEqual(after)
  })

  it('uses the same days as rangeWindow and zeroFillDays', () => {
    for (const iso of [
      '2026-10-19T14:30:00.000Z',
      '2026-10-19T19:00:00.000Z',
      '2026-12-31T19:00:00.000Z',
    ]) {
      const now = new Date(iso)
      const { since, keys } = sparklineWindow(now, 7)
      const week = rangeWindow('7d', now)
      expect(since).toBe(week.since.toISOString())
      expect(keys).toEqual(zeroFillDays([], week.since, week.days).map((row) => row.date))
    }
  })

  it('crosses a month end without skipping or repeating a day', () => {
    const { since, keys } = sparklineWindow(new Date('2026-03-05T12:00:00Z'))
    expect(since).toBe('2026-02-19T18:30:00.000Z')
    expect(keys).toStrictEqual([
      '2026-02-20',
      '2026-02-21',
      '2026-02-22',
      '2026-02-23',
      '2026-02-24',
      '2026-02-25',
      '2026-02-26',
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
      '2026-03-05',
    ])
  })

  it('lines up with the IST day rows fillDailyClicks maps onto it', () => {
    // 13:30 on 19 October in India.
    const window = sparklineWindow(new Date('2026-10-19T08:00:00Z'))
    const filled = fillDailyClicks(window.keys, [
      { day: '2026-10-06', clicks: 1 },
      { day: '2026-10-19', clicks: 3 },
    ])
    expect(filled).toHaveLength(14)
    expect(filled[0]).toBe(1)
    expect(filled[13]).toBe(3)
    expect(filled.slice(1, 13).every((n) => n === 0)).toBe(true)
  })
})
