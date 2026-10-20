import { describe, it, expect } from 'vitest'
import { healthByLink, linkHealthIssues, sortIssues, summarizeHealth, type HealthLink } from '../linkHealth'

const now = new Date('2026-10-20T06:00:00Z')
const base: HealthLink = {
  short_code: 'course',
  original_url: 'https://twsgurukulx.com/courses/x',
  fallback_url: null,
  expires_at: null,
  max_clicks: null,
  total_clicks: 10,
  is_active: true,
  created_at: '2026-09-01T00:00:00Z',
}
const opts: { now: Date; shortDomain: string; clicksInLast30d?: number } = {
  now,
  shortDomain: 'tws.bio',
  clicksInLast30d: 5,
}
const kinds = (l: Partial<HealthLink>, o = opts) =>
  linkHealthIssues({ ...base, ...l }, o).map((i) => `${i.kind}:${i.severity}`)

describe('linkHealthIssues', () => {
  it('reports nothing for a healthy link', () => {
    expect(kinds({})).toEqual([])
  })

  it('flags placeholder destinations', () => {
    for (const url of [
      'https://example.com/a',
      'https://www.example.org',
      'http://localhost:3000',
      'http://127.0.0.1/x',
      'https://shop.test/x',
      'https://foo.invalid',
    ]) {
      expect(kinds({ original_url: url })).toContain('placeholder:high')
    }
    expect(kinds({ original_url: 'https://notexample.com' })).toEqual([])
  })

  it('flags a self loop as high, via the destination or the fallback', () => {
    expect(kinds({ original_url: 'https://tws.bio/course' })).toEqual(['loop:high'])
    expect(kinds({ fallback_url: 'https://www.tws.bio/course/' })).toEqual(['loop:high'])
  })

  it('flags another short link as medium', () => {
    expect(kinds({ original_url: 'https://tws.bio/other' })).toEqual(['loop:medium'])
    expect(kinds({ original_url: 'https://tws.bio/r/slug' })).toEqual(['loop:medium'])
  })

  it('does not flag a loop for a look-alike host or a bad URL', () => {
    expect(kinds({ original_url: 'https://tws.bio.evil.com/course' })).toEqual([])
    expect(kinds({ original_url: 'not a url' })).toEqual([])
  })

  it('flags expired and expiring_soon', () => {
    expect(kinds({ expires_at: '2026-10-20T06:00:00Z' })).toEqual(['expired:high'])
    expect(kinds({ expires_at: '2026-10-19T00:00:00Z' })).toEqual(['expired:high'])
    expect(kinds({ expires_at: '2026-10-27T06:00:00Z' })).toEqual(['expiring_soon:medium'])
    expect(kinds({ expires_at: '2026-10-27T06:00:01Z' })).toEqual([])
    const msg = linkHealthIssues({ ...base, expires_at: '2026-10-19T00:00:00Z' }, opts)[0].message
    expect(msg).toContain('link expired')
  })

  it('flags at_cap and near_cap', () => {
    expect(kinds({ max_clicks: 100, total_clicks: 100 })).toEqual(['at_cap:high'])
    expect(kinds({ max_clicks: 100, total_clicks: 120 })).toEqual(['at_cap:high'])
    expect(kinds({ max_clicks: 100, total_clicks: 90 })).toEqual(['near_cap:medium'])
    expect(kinds({ max_clicks: 100, total_clicks: 89 })).toEqual([])
    expect(kinds({ max_clicks: null, total_clicks: 999 })).toEqual([])
  })

  it('flags inactive links as low', () => {
    expect(kinds({ is_active: false })).toEqual(['inactive:low'])
  })

  it('flags quiet only with a 0 count and an age over 14 days', () => {
    expect(kinds({}, { ...opts, clicksInLast30d: 0 })).toEqual(['quiet:low'])
    expect(kinds({}, { ...opts, clicksInLast30d: undefined })).toEqual([])
    expect(
      kinds({ created_at: '2026-10-10T00:00:00Z' }, { ...opts, clicksInLast30d: 0 }),
    ).toEqual([])
  })

  it('does not flag quiet for a link that is off or expired', () => {
    const quiet = { ...opts, clicksInLast30d: 0 }
    expect(kinds({ is_active: false }, quiet)).toEqual(['inactive:low'])
    expect(kinds({ expires_at: '2026-10-01T00:00:00Z' }, quiet)).toEqual(['expired:high'])
    expect(kinds({ expires_at: '2026-10-25T00:00:00Z' }, quiet)).toEqual(['expiring_soon:medium', 'quiet:low'])
  })

  it('can report several issues at once', () => {
    expect(kinds({ is_active: false, expires_at: '2026-10-01T00:00:00Z' })).toEqual([
      'expired:high',
      'inactive:low',
    ])
  })
})

describe('summarizeHealth', () => {
  it('counts issues by severity and the links that have any', () => {
    const a = linkHealthIssues({ ...base, is_active: false, expires_at: '2026-10-01T00:00:00Z' }, opts)
    const b = linkHealthIssues({ ...base, max_clicks: 100, total_clicks: 95 }, opts)
    expect(summarizeHealth({ a, b, c: [] })).toEqual({ high: 1, medium: 1, low: 1, links: 2 })
    expect(summarizeHealth(new Map([['a', a]]))).toEqual({ high: 1, medium: 0, low: 1, links: 1 })
    expect(summarizeHealth({})).toEqual({ high: 0, medium: 0, low: 0, links: 0 })
  })
})

describe('sortIssues', () => {
  it('puts the worst first and keeps the rule order on a tie', () => {
    const issues = linkHealthIssues(
      { ...base, is_active: false, max_clicks: 100, total_clicks: 95, original_url: 'https://example.com/x' },
      opts,
    )
    expect(issues.map((i) => i.kind)).toEqual(['placeholder', 'near_cap', 'inactive'])
    const shuffled = [issues[2], issues[1], issues[0]]
    expect(sortIssues(shuffled).map((i) => i.kind)).toEqual(['placeholder', 'near_cap', 'inactive'])
  })
})

describe('healthByLink', () => {
  const links = [
    { ...base, id: 'ok', short_code: 'ok' },
    { ...base, id: 'off', short_code: 'off', is_active: false, total_clicks: 50 },
    { ...base, id: 'old', short_code: 'old', is_active: false, expires_at: '2026-10-01T00:00:00Z', total_clicks: 5 },
    { ...base, id: 'cap', short_code: 'cap', max_clicks: 10, total_clicks: 9 },
    { ...base, id: 'sale', short_code: 'sale', expires_at: '2026-10-02T00:00:00Z', total_clicks: 900 },
  ]

  it('lists each link once with its issues worst first, ranked by worst issue then clicks', () => {
    const out = healthByLink(links, {
      now,
      shortDomain: 'tws.bio',
      clicksInLast30d: (l) => (l.id === 'ok' ? 5 : 0),
    })
    expect(out.map((e) => e.link.id)).toEqual(['old', 'sale', 'cap', 'off'])
    expect(out.find((e) => e.link.id === 'old')?.issues.map((i) => i.kind)).toEqual(['expired', 'inactive'])
    expect(out.find((e) => e.link.id === 'off')?.issues.map((i) => i.kind)).toEqual(['inactive'])
    expect(out.find((e) => e.link.id === 'cap')?.issues.map((i) => i.kind)).toEqual(['near_cap', 'quiet'])
    expect(out[0]).toMatchObject({ worst: 'high', clicks30: 0 })
  })

  it('uses the 30-day count to rank and skips quiet when the count is unknown', () => {
    const recent: Record<string, number> = { off: 1, old: 2, cap: 3, sale: 40 }
    const out = healthByLink(links, { now, shortDomain: 'tws.bio', clicksInLast30d: (l) => recent[l.id] })
    expect(out.map((e) => e.link.id)).toEqual(['sale', 'old', 'cap', 'off'])
    const unknown = healthByLink(links, { now, shortDomain: 'tws.bio' })
    expect(unknown.flatMap((e) => e.issues.map((i) => i.kind))).not.toContain('quiet')
    expect(unknown.find((e) => e.link.id === 'cap')?.clicks30).toBeNull()
  })

  it('returns nothing for healthy links', () => {
    expect(healthByLink([base], { now, shortDomain: 'tws.bio', clicksInLast30d: () => 3 })).toEqual([])
  })
})
