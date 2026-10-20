import { describe, expect, it } from 'vitest'
import {
  applyLinkFilters,
  applyLinkSort,
  fillDailyClicks,
  type LinkFilters,
  type SortOption,
} from '@/lib/linkFilters'

// Records each builder call in order and returns itself, like the PostgREST
// builder does. `ilike` is here only so a test can prove it is never called:
// the search has to stay one `.or()` across both columns.
class StubQuery {
  calls: unknown[][] = []

  or(filters: string) {
    this.calls.push(['or', filters])
    return this
  }

  eq(column: string, value: string | boolean) {
    this.calls.push(['eq', column, value])
    return this
  }

  ilike(column: string, pattern: string) {
    this.calls.push(['ilike', column, pattern])
    return this
  }

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.calls.push(['order', column, options])
    return this
  }
}

const NO_FILTERS: LinkFilters = { q: '', type: 'all', status: 'all' }

function filterCalls(filters: Partial<LinkFilters>) {
  return applyLinkFilters(new StubQuery(), { ...NO_FILTERS, ...filters }).calls
}

function sortCalls(sort: SortOption) {
  return applyLinkSort(new StubQuery(), sort).calls
}

describe('applyLinkFilters', () => {
  it('adds nothing when no filter is set', () => {
    expect(filterCalls({})).toStrictEqual([])
  })

  it('searches the short code and the destination in one .or()', () => {
    expect(filterCalls({ q: 'promo' })).toStrictEqual([
      ['or', 'short_code.ilike.%promo%,original_url.ilike.%promo%'],
    ])
  })

  it('strips the characters that would break the .or() grammar', () => {
    expect(filterCalls({ q: 'a(b),c%d' })).toStrictEqual([
      ['or', 'short_code.ilike.%abcd%,original_url.ilike.%abcd%'],
    ])
  })

  it('skips the search when nothing is left after stripping', () => {
    expect(filterCalls({ q: '(),%' })).toStrictEqual([])
  })

  it('counts a null link_type as a URL link', () => {
    expect(filterCalls({ type: 'url' })).toStrictEqual([
      ['or', 'link_type.eq.url,link_type.is.null'],
    ])
  })

  it('matches deep links exactly', () => {
    expect(filterCalls({ type: 'deep_link' })).toStrictEqual([['eq', 'link_type', 'deep_link']])
  })

  it('keeps only active links', () => {
    expect(filterCalls({ status: 'active' })).toStrictEqual([['eq', 'is_active', true]])
  })

  it('counts a null is_active as inactive', () => {
    expect(filterCalls({ status: 'inactive' })).toStrictEqual([
      ['or', 'is_active.eq.false,is_active.is.null'],
    ])
  })

  it('applies search, then type, then status', () => {
    expect(filterCalls({ q: 'yt', type: 'deep_link', status: 'inactive' })).toStrictEqual([
      ['or', 'short_code.ilike.%yt%,original_url.ilike.%yt%'],
      ['eq', 'link_type', 'deep_link'],
      ['or', 'is_active.eq.false,is_active.is.null'],
    ])
    expect(filterCalls({ q: 'yt', type: 'url', status: 'active' })).toStrictEqual([
      ['or', 'short_code.ilike.%yt%,original_url.ilike.%yt%'],
      ['or', 'link_type.eq.url,link_type.is.null'],
      ['eq', 'is_active', true],
    ])
  })

  it('never sorts and never calls .ilike()', () => {
    const methods = filterCalls({ q: 'yt', type: 'url', status: 'inactive' }).map(([m]) => m)
    expect(methods).not.toContain('order')
    expect(methods).not.toContain('ilike')
  })

  it('returns the builder it was given, so each caller keeps its own query type', () => {
    const query = new StubQuery()
    expect(applyLinkFilters(query, { q: 'x', type: 'url', status: 'active' })).toBe(query)
  })
})

describe('applyLinkSort', () => {
  it.each([
    ['created_desc', ['order', 'created_at', { ascending: false }]],
    ['created_asc', ['order', 'created_at', { ascending: true }]],
    ['clicks_desc', ['order', 'total_clicks', { ascending: false, nullsFirst: false }]],
    ['clicks_asc', ['order', 'total_clicks', { ascending: true, nullsFirst: true }]],
  ] as [SortOption, unknown[]][])('orders %s with one .order() call', (sort, call) => {
    expect(sortCalls(sort)).toStrictEqual([call])
  })

  it('falls back to newest first for an unknown key', () => {
    expect(sortCalls('most_popular' as SortOption)).toStrictEqual([
      ['order', 'created_at', { ascending: false }],
    ])
  })

  it('returns the builder it was given', () => {
    const query = new StubQuery()
    expect(applyLinkSort(query, 'clicks_desc')).toBe(query)
  })
})

// sparklineWindow, which makes the keys, lives in analytics.ts with the rest of
// the IST day math, so its specs (and the one that feeds its keys through
// fillDailyClicks) are in analyticsRange.test.ts.
describe('fillDailyClicks', () => {
  const keys = ['2026-10-17', '2026-10-18', '2026-10-19']

  it('gives one count per day, oldest first, with 0 for a quiet day', () => {
    expect(
      fillDailyClicks(keys, [
        { day: '2026-10-19', clicks: 4 },
        { day: '2026-10-17', clicks: 2 },
      ])
    ).toStrictEqual([2, 0, 4])
  })

  it('reads a bigint count that arrives as a string', () => {
    expect(fillDailyClicks(keys, [{ day: '2026-10-18', clicks: '7' }])).toStrictEqual([0, 7, 0])
  })

  it('drops rows outside the window', () => {
    expect(
      fillDailyClicks(keys, [
        { day: null, clicks: 9 },
        { day: '2026-10-16', clicks: 5 },
        // After today: p_since has no upper bound, so clock skew can return one.
        { day: '2026-10-20', clicks: 3 },
      ])
    ).toStrictEqual([0, 0, 0])
  })

  it('gives all zeros for a link with no clicks', () => {
    expect(fillDailyClicks(keys, [])).toStrictEqual([0, 0, 0])
  })
})
