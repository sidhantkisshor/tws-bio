import { describe, it, expect } from 'vitest'
import { computeMovers, quietLinks, topDecliners, topGainers } from '../movers'

describe('computeMovers', () => {
  it('computes delta and pct, with null pct when prior is 0', () => {
    const out = computeMovers({ a: 150, b: 50, c: 10 }, { a: 100, b: 100 })
    const by = Object.fromEntries(out.map((m) => [m.linkId, m]))
    expect(by.a).toMatchObject({ current: 150, prior: 100, delta: 50, pct: 0.5 })
    expect(by.b).toMatchObject({ delta: -50, pct: -0.5 })
    expect(by.c).toMatchObject({ prior: 0, delta: 10, pct: null })
  })

  it('accepts Maps and includes links seen in only one window', () => {
    const out = computeMovers(new Map([['a', 5]]), new Map([['z', 8]]))
    expect(out.map((m) => m.linkId).sort()).toEqual(['a', 'z'])
    expect(out.find((m) => m.linkId === 'z')).toMatchObject({ current: 0, delta: -8, pct: -1 })
  })

  it('drops links under minClicks in both windows', () => {
    const out = computeMovers({ a: 2, b: 20 }, { a: 1, b: 5 }, { minClicks: 10 })
    expect(out.map((m) => m.linkId)).toEqual(['b'])
  })

  it('handles empty input and sorts ties by id', () => {
    expect(computeMovers({}, {})).toEqual([])
    const out = computeMovers({ b: 5, a: 5 }, {})
    expect(out.map((m) => m.linkId)).toEqual(['a', 'b'])
  })
})

describe('topGainers and topDecliners', () => {
  const list = computeMovers({ a: 100, b: 10, c: 50, d: 7 }, { a: 10, b: 60, c: 50, d: 9 })

  it('gainers have delta > 0, biggest first', () => {
    expect(topGainers(list, 5).map((m) => m.linkId)).toEqual(['a'])
  })

  it('decliners have delta < 0, biggest drop first, and skip flat links', () => {
    expect(topDecliners(list, 5).map((m) => m.linkId)).toEqual(['b', 'd'])
    expect(topDecliners(list, 1).map((m) => m.linkId)).toEqual(['b'])
  })

  it('n of 0 or less gives nothing', () => {
    expect(topGainers(list, 0)).toEqual([])
    expect(topDecliners(list, -3)).toEqual([])
  })
})

describe('quietLinks', () => {
  const now = new Date('2026-10-20T00:00:00Z')
  const links = [
    { id: 'old-quiet', created_at: '2026-08-01T00:00:00Z' },
    { id: 'old-busy', created_at: '2026-08-01T00:00:00Z' },
    { id: 'new-quiet', created_at: '2026-10-15T00:00:00Z' },
    { id: 'edge', created_at: '2026-10-06T00:00:00Z' },
    { id: 'bad-date', created_at: 'nope' },
  ]

  it('returns old links with no clicks in the window', () => {
    expect(quietLinks(links, { 'old-busy': 3 }, now)).toEqual(['old-quiet'])
  })

  it('a link exactly 14 days old is not yet quiet; a custom age works', () => {
    expect(quietLinks(links, new Map(), now)).not.toContain('edge')
    expect(quietLinks(links, new Map(), now, 1)).toContain('new-quiet')
  })
})
