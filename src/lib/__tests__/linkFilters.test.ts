import { describe, expect, it } from 'vitest'
import {
  applyLinkFilters,
  applyLinkSort,
  chipCounts,
  chipLinkIds,
  fillDailyClicks,
  isExpiringSoon,
  kindSlug,
  matchesSearch,
  matchingCampaignIds,
  parseKind,
  parseShow,
  type IndexedLink,
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

  in(column: string, values: readonly string[]) {
    this.calls.push(['in', column, [...values]])
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

describe('applyLinkFilters: chips and campaign search', () => {
  const campaign = 'c0000000-0000-4000-8000-000000000001'

  it('adds the matching campaigns to the one search .or()', () => {
    expect(filterCalls({ q: 'launch', campaignIds: [campaign] })).toStrictEqual([
      ['or', `short_code.ilike.%launch%,original_url.ilike.%launch%,campaign_id.in.(${campaign})`],
    ])
  })

  it('leaves the search unchanged when no campaign matches', () => {
    expect(filterCalls({ q: 'promo', campaignIds: [] })).toStrictEqual([
      ['or', 'short_code.ilike.%promo%,original_url.ilike.%promo%'],
    ])
  })

  it('drops a campaign id that is not a uuid instead of putting it in the filter', () => {
    expect(filterCalls({ q: 'x', campaignIds: ['a),id.eq.(b'] })).toStrictEqual([
      ['or', 'short_code.ilike.%x%,original_url.ilike.%x%'],
    ])
  })

  it('restricts to the chip ids last, after the column filters', () => {
    expect(filterCalls({ status: 'active', ids: ['a', 'b'] })).toStrictEqual([
      ['eq', 'is_active', true],
      ['in', 'id', ['a', 'b']],
    ])
  })

  it('adds no id filter for null ids', () => {
    expect(filterCalls({ ids: null })).toStrictEqual([])
  })
})

describe('chip params', () => {
  it('reads only the known show values', () => {
    expect(parseShow('drops')).toBe('drops')
    expect(parseShow('expiring')).toBe('expiring')
    expect(parseShow('attention')).toBe('attention')
    expect(parseShow('everything')).toBe('all')
    expect(parseShow(undefined)).toBe('all')
  })

  it('round-trips every destination kind through its slug', () => {
    expect(kindSlug('Broker partner')).toBe('broker-partner')
    expect(parseKind('broker-partner')).toBe('Broker partner')
    expect(parseKind('course')).toBe('Course')
    expect(parseKind('Course')).toBeNull()
    expect(parseKind('nope')).toBeNull()
    expect(parseKind(null)).toBeNull()
  })
})

describe('isExpiringSoon', () => {
  const now = new Date('2026-10-20T12:00:00Z')

  it('is true within the next 7 days only', () => {
    expect(isExpiringSoon('2026-10-21T12:00:00Z', now)).toBe(true)
    expect(isExpiringSoon('2026-10-27T12:00:00Z', now)).toBe(true)
    expect(isExpiringSoon('2026-10-27T12:00:01Z', now)).toBe(false)
  })

  it('is false for an expired link, no expiry or a bad date', () => {
    expect(isExpiringSoon('2026-10-20T11:59:59Z', now)).toBe(false)
    expect(isExpiringSoon(null, now)).toBe(false)
    expect(isExpiringSoon('soon', now)).toBe(false)
  })
})

describe('search mirror, chip counts and chip ids', () => {
  const now = new Date('2026-10-20T12:00:00Z')
  const base: IndexedLink = {
    id: '',
    short_code: '',
    original_url: 'https://example.org/',
    link_type: 'url',
    is_active: true,
    expires_at: null,
    campaign_id: null,
    kind: null,
    needsLook: false,
  }
  const links: IndexedLink[] = [
    { ...base, id: 'a', short_code: 'ai-trade', original_url: 'https://twsgurukulx.com/ai', kind: 'Course', campaign_id: 'camp-1' },
    { ...base, id: 'b', short_code: 'tg', original_url: 'https://t.me/tws', kind: 'Community', link_type: 'deep_link' },
    { ...base, id: 'c', short_code: 'r/10k', original_url: 'https://twsgurukulx.com/r/10k', kind: 'Course' },
    { ...base, id: 'd', short_code: 'kit', original_url: 'https://rzp.io/l/kit', kind: 'Payment', needsLook: true, is_active: false },
    { ...base, id: 'e', short_code: 'webinar', expires_at: '2026-10-22T00:00:00Z', is_active: null },
  ]

  it('matches the code, the destination or a matching campaign, ignoring case', () => {
    const none = new Set<string>()
    expect(matchesSearch(links[0], 'AI', none)).toBe(true)
    expect(matchesSearch(links[1], 't.me', none)).toBe(true)
    expect(matchesSearch(links[0], 'launch', none)).toBe(false)
    expect(matchesSearch(links[0], 'launch', new Set(['camp-1']))).toBe(true)
    expect(matchesSearch(links[1], '(),%', none)).toBe(true)
  })

  it('finds campaigns by name', () => {
    const campaigns = [
      { id: 'camp-1', name: 'AI trade launch' },
      { id: 'camp-2', name: 'HLC cohort' },
    ]
    expect(matchingCampaignIds(campaigns, 'launch')).toEqual(['camp-1'])
    expect(matchingCampaignIds(campaigns, '')).toEqual([])
  })

  it('counts every chip', () => {
    expect(chipCounts(links, now)).toEqual({
      all: 5,
      live: 3,
      paused: 2,
      app: 1,
      drops: 1,
      expiring: 1,
      attention: 1,
      kinds: [
        { kind: 'Course', slug: 'course', count: 2 },
        { kind: 'Community', slug: 'community', count: 1 },
        { kind: 'Payment', slug: 'payment', count: 1 },
      ],
    })
  })

  it('gives the ids a chip stands for, and null when none is set', () => {
    expect(chipLinkIds(links, 'all', null, now)).toBeNull()
    expect(chipLinkIds(links, 'drops', null, now)).toEqual(['c'])
    expect(chipLinkIds(links, 'expiring', null, now)).toEqual(['e'])
    expect(chipLinkIds(links, 'attention', null, now)).toEqual(['d'])
    expect(chipLinkIds(links, 'all', 'Course', now)).toEqual(['a', 'c'])
    expect(chipLinkIds(links, 'drops', 'Course', now)).toEqual(['c'])
    expect(chipLinkIds(links, 'attention', 'Video', now)).toEqual([])
  })
})
