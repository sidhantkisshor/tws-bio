import { describe, expect, it } from 'vitest'
import {
  EXPIRY_HINT_DAY,
  EXPIRY_HINT_EMPTY,
  checkLinkEdit,
  endOfIstDay,
  expiryDayOf,
  expiryHint,
  type LinkEditContext,
  type LinkEditFields,
} from '@/lib/linkEdit'

const blank: LinkEditFields = {
  originalUrl: 'https://example.com/page',
  iosDeepLink: '',
  androidDeepLink: '',
  fallbackUrl: '',
  expiresAt: '',
  maxClicks: '',
}

const NOW = new Date('2026-10-19T12:00:00.000Z')

function check(fields: Partial<LinkEditFields>, context: Partial<LinkEditContext> = {}) {
  return checkLinkEdit(
    { ...blank, ...fields },
    { isDeepLink: false, totalClicks: 0, storedExpiresAt: null, storedMaxClicks: null, now: NOW, ...context },
  )
}

describe('destination and fallback', () => {
  it('completes a bare host before checking, and saves the completed value', () => {
    const result = check({ originalUrl: '  example.com/sale ' })
    expect(result.errors).toEqual({})
    expect(result.fields.originalUrl).toBe('https://example.com/sale')
    expect(result.update.original_url).toBe('https://example.com/sale')
  })

  it('rejects a destination that is not a web address', () => {
    expect(check({ originalUrl: 'not a url' }).errors.originalUrl).toMatch(/full web address/)
    expect(check({ originalUrl: 'mailto:me@example.com' }).errors.originalUrl).toMatch(/full web address/)
    expect(check({ originalUrl: 'http://localhost:3000/x' }).errors.originalUrl).toBeDefined()
  })

  it('says why another tws.bio short link is refused', () => {
    expect(check({ originalUrl: 'https://tws.bio/abc123' }).errors.originalUrl).toMatch(/not another tws\.bio short link/)
  })

  it('completes and checks the fallback of a deep link', () => {
    const ok = check({ fallbackUrl: 'apps.apple.com/app/id1' }, { isDeepLink: true })
    expect(ok.errors).toEqual({})
    expect(ok.update.fallback_url).toBe('https://apps.apple.com/app/id1')

    const bad = check({ fallbackUrl: 'not a url' }, { isDeepLink: true })
    expect(bad.errors.fallbackUrl).toMatch(/full web address/)
  })
})

describe('app deep links', () => {
  it('accepts schemes the redirect follows', () => {
    const result = check(
      { iosDeepLink: 'youtube://watch?v=abc', androidDeepLink: ' vnd.youtube://abc ' },
      { isDeepLink: true },
    )
    expect(result.errors).toEqual({})
    expect(result.update.ios_deep_link).toBe('youtube://watch?v=abc')
    expect(result.update.android_deep_link).toBe('vnd.youtube://abc')
  })

  it('rejects values the redirect would drop', () => {
    for (const value of ['myapp://open', 'intent://x#Intent;end', 'www.example.com/x', 'javascript:alert(1)', 'http://127.0.0.1/x']) {
      const result = check({ iosDeepLink: value, androidDeepLink: value }, { isDeepLink: true })
      expect(result.errors.iosDeepLink, value).toMatch(/can't open this link/)
      expect(result.errors.androidDeepLink, value).toMatch(/can't open this link/)
    }
  })

  it('saves empty deep-link fields as null', () => {
    const result = check({}, { isDeepLink: true })
    expect(result.update).toMatchObject({ ios_deep_link: null, android_deep_link: null, fallback_url: null })
  })

  it('leaves the hidden deep-link columns alone on a URL link', () => {
    const result = check({ iosDeepLink: 'myapp://open' }, { isDeepLink: false })
    expect(result.errors).toEqual({})
    expect(result.update).not.toHaveProperty('ios_deep_link')
    expect(result.update).not.toHaveProperty('android_deep_link')
    expect(result.update).not.toHaveProperty('fallback_url')
  })
})

describe('expiry, a day in India time', () => {
  // NOW is 17:30 on 19 Oct in India.

  it('saves a picked day as the end of that day, India time', () => {
    const result = check({ expiresAt: '2026-10-20' })
    expect(result.errors).toEqual({})
    // Midnight IST after 20 Oct is 18:30 UTC on 20 Oct.
    expect(result.update.expires_at).toBe('2026-10-20T18:30:00.000Z')
  })

  it('accepts today, and rejects a day that has ended', () => {
    expect(check({ expiresAt: '2026-10-19' }).errors.expiresAt).toBeUndefined()
    expect(check({ expiresAt: '2026-10-18' }).errors.expiresAt).toMatch(/today or a later day/)
  })

  it('rejects a part-filled date', () => {
    expect(check({ expiresAt: '2026-10' }).errors.expiresAt).toMatch(/full date/)
  })

  it('writes an untouched stored expiry back exactly, time included', () => {
    // 11:45 IST on 1 Nov: not the end of a day.
    const stored = '2026-11-01T06:15:42+00:00'
    const result = check({ expiresAt: '2026-11-01' }, { storedExpiresAt: stored })
    expect(result.errors).toEqual({})
    expect(result.update.expires_at).toBe(stored)
  })

  it('writes an untouched expiry back even once it has passed', () => {
    const stored = '2026-10-01T06:15:42+00:00'
    const result = check({ expiresAt: expiryDayOf(stored) }, { storedExpiresAt: stored })
    expect(result.errors).toEqual({})
    expect(result.update.expires_at).toBe(stored)
  })

  it('still rejects a new past day when the link has a stored expiry', () => {
    const past = check({ expiresAt: '2026-10-02' }, { storedExpiresAt: '2026-10-01T06:15:42+00:00' })
    expect(past.errors.expiresAt).toMatch(/today or a later day/)
    const future = check({ expiresAt: '2026-10-18' }, { storedExpiresAt: '2026-11-01T06:15:42+00:00' })
    expect(future.errors.expiresAt).toMatch(/today or a later day/)
  })

  it('takes a new day in place of a stored expiry, at the end of that day', () => {
    const result = check({ expiresAt: '2026-11-02' }, { storedExpiresAt: '2026-11-01T06:15:42+00:00' })
    expect(result.errors).toEqual({})
    expect(result.update.expires_at).toBe('2026-11-02T18:30:00.000Z')
  })

  it('treats an empty field as no expiry', () => {
    expect(check({ expiresAt: '' }).update.expires_at).toBeNull()
  })
})

describe('expiryDayOf and expiryHint', () => {
  it('shows a midnight IST expiry (what Create saves) as the day before', () => {
    expect(expiryDayOf('2026-10-20T18:30:00.000Z')).toBe('2026-10-20')
    expect(expiryDayOf(new Date(endOfIstDay('2026-12-31')).toISOString())).toBe('2026-12-31')
  })

  it('shows a mid-day expiry as its own IST day', () => {
    expect(expiryDayOf('2026-11-01T06:15:42+00:00')).toBe('2026-11-01')
    // 20:00 UTC is 01:30 the next day in India.
    expect(expiryDayOf('2026-11-01T20:00:00Z')).toBe('2026-11-02')
  })

  it('is empty for no expiry or a bad value', () => {
    expect(expiryDayOf(null)).toBe('')
    expect(expiryDayOf('not a date')).toBe('')
  })

  it('names the stored time while the day is unchanged', () => {
    const stored = '2026-11-01T06:15:42+00:00'
    expect(expiryHint('2026-11-01', stored)).toBe('It stops at 11:45 AM that day, India time.')
    expect(expiryHint('2026-11-02', stored)).toBe(EXPIRY_HINT_DAY)
    expect(expiryHint('2026-10-20', '2026-10-20T18:30:00.000Z')).toBe(EXPIRY_HINT_DAY)
    expect(expiryHint('', stored)).toBe(EXPIRY_HINT_EMPTY)
  })
})

describe('max clicks', () => {
  it('treats an empty field as no limit', () => {
    expect(check({ maxClicks: '  ' }).update.max_clicks).toBeNull()
  })

  it('accepts a whole number above the current total', () => {
    expect(check({ maxClicks: ' 500 ' }, { totalClicks: 57 }).update.max_clicks).toBe(500)
    expect(check({ maxClicks: '58' }, { totalClicks: 57 }).errors).toEqual({})
    expect(check({ maxClicks: '1' }, { totalClicks: null }).update.max_clicks).toBe(1)
  })

  it('rejects zero, negatives, decimals and exponents', () => {
    for (const value of ['0', '000', '-5', '2.5', '1e3', 'ten']) {
      expect(check({ maxClicks: value }).errors.maxClicks, value).toMatch(/whole number of 1 or more/)
    }
  })

  it('rejects a limit the link has already reached', () => {
    expect(check({ maxClicks: '57' }, { totalClicks: 57 }).errors.maxClicks).toBe(
      'This link already has 57 clicks, so the limit must be above 57.',
    )
    expect(check({ maxClicks: '1' }, { totalClicks: 1 }).errors.maxClicks).toBe(
      'This link already has 1 click, so the limit must be above 1.',
    )
    expect(check({ maxClicks: '900' }, { totalClicks: 1234 }).errors.maxClicks).toMatch(/1,234 clicks/)
  })

  it('rejects a number the INTEGER column cannot hold', () => {
    expect(check({ maxClicks: '2147483647' }).errors).toEqual({})
    expect(check({ maxClicks: '2147483648' }).errors.maxClicks).toMatch(/smaller number/)
  })

  it('writes an untouched limit back even once the link has reached it', () => {
    const reached = { storedMaxClicks: 57, totalClicks: 60 }
    const result = check({ maxClicks: '57' }, reached)
    expect(result.errors).toEqual({})
    expect(result.update.max_clicks).toBe(57)
    // Surrounding spaces are trimmed before the comparison.
    expect(check({ maxClicks: ' 57 ' }, reached).update.max_clicks).toBe(57)
  })

  it('still rejects a new limit at or below the count when the link has a stored limit', () => {
    const reached = { storedMaxClicks: 57, totalClicks: 60 }
    expect(check({ maxClicks: '58' }, reached).errors.maxClicks).toBe(
      'This link already has 60 clicks, so the limit must be above 60.',
    )
    expect(check({ maxClicks: '60' }, reached).errors.maxClicks).toMatch(/must be above 60/)
    expect(check({ maxClicks: '0' }, reached).errors.maxClicks).toMatch(/whole number of 1 or more/)
  })

  it('takes a new limit above the count, or no limit, in place of a reached one', () => {
    const reached = { storedMaxClicks: 57, totalClicks: 60 }
    expect(check({ maxClicks: '61' }, reached).update.max_clicks).toBe(61)
    const cleared = check({ maxClicks: '' }, reached)
    expect(cleared.errors).toEqual({})
    expect(cleared.update.max_clicks).toBeNull()
  })
})

describe('a link that has expired and reached its limit', () => {
  it('saves a new destination and writes both stored values back', () => {
    const storedExpiresAt = '2026-10-01T06:15:42+00:00'
    const result = check(
      {
        originalUrl: 'https://example.com/new-page',
        expiresAt: expiryDayOf(storedExpiresAt),
        maxClicks: '57',
      },
      { storedExpiresAt, storedMaxClicks: 57, totalClicks: 60 },
    )
    expect(result.errors).toEqual({})
    expect(result.update).toEqual({
      original_url: 'https://example.com/new-page',
      expires_at: storedExpiresAt,
      max_clicks: 57,
    })
  })
})
