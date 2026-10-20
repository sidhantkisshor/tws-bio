import { describe, expect, it } from 'vitest'
import { rankLinkHealth, type OwnerLink } from '../data'

const NOW = new Date('2026-10-20T12:00:00Z')
const OLD = '2026-01-01T00:00:00Z'

function link(over: Partial<OwnerLink> & { id: string; short_code: string }): OwnerLink {
  return {
    original_url: 'https://tradingwithsidhant.com/',
    fallback_url: null,
    link_type: 'url',
    expires_at: null,
    max_clicks: null,
    total_clicks: 0,
    is_active: true,
    created_at: OLD,
    campaign_id: null,
    ...over,
  }
}

describe('rankLinkHealth', () => {
  it('gives one row per link, worst issue first', () => {
    const rows = rankLinkHealth(
      [link({ id: 'a', short_code: 'oct-sale', expires_at: '2026-10-01T00:00:00Z', is_active: false })],
      { a: 0 },
      NOW,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].issues.map((i) => i.kind)).toEqual(['expired', 'inactive'])
  })

  it('drops "quiet" for a link that is turned off or expired', () => {
    const rows = rankLinkHealth(
      [
        link({ id: 'off', short_code: 'old-promo', is_active: false }),
        link({ id: 'quiet', short_code: 'quiet-one' }),
      ],
      { off: 0, quiet: 0 },
      NOW,
    )
    const byId = Object.fromEntries(rows.map((r) => [r.link.id, r.issues.map((i) => i.kind)]))
    expect(byId.off).toEqual(['inactive'])
    expect(byId.quiet).toEqual(['quiet'])
  })

  it('ranks rows by the worst severity, then by recent clicks', () => {
    const rows = rankLinkHealth(
      [
        link({ id: 'low', short_code: 'low', is_active: false }),
        link({ id: 'med', short_code: 'med', expires_at: '2026-10-23T00:00:00Z' }),
        link({ id: 'high-few', short_code: 'high-few', original_url: 'https://example.com/' }),
        link({ id: 'high-many', short_code: 'high-many', original_url: 'https://example.com/x' }),
      ],
      { low: 5, med: 5, 'high-few': 1, 'high-many': 40 },
      NOW,
    )
    expect(rows.map((r) => r.link.id)).toEqual(['high-many', 'high-few', 'med', 'low'])
  })

  it('skips links with no issues and never flags quiet when clicks did not load', () => {
    const rows = rankLinkHealth([link({ id: 'ok', short_code: 'ok' })], null, NOW)
    expect(rows).toEqual([])
  })
})
