import { describe, it, expect } from 'vitest'
import { isValidUrl, generateShortCode, getShortUrl, BLOCKED_HOSTNAMES, formatDate, formatCount, plural } from '@/lib/utils'

describe('isValidUrl - SSRF / abuse blocklist', () => {
  const blocked = [
    'http://localhost',
    'http://127.0.0.1',
    'http://127.1',
    'http://0177.0.0.1',
    'http://2130706433',
    'http://0x7f000001',
    'http://[::1]',
    'http://[0:0:0:0:0:0:0:1]',
    'http://[::]',
    'http://[fc00::1]',
    'http://[fe80::1]',
    'http://[::ffff:127.0.0.1]',
    'http://localhost.',
    'http://foo.localhost.',
    'http://127.0.0.1.',
    'http://[::127.0.0.1]',
    'http://[64:ff9b::127.0.0.1]',
    'http://169.254.169.254',
    'http://10.0.0.5',
    'http://192.168.1.1',
    'http://172.16.0.1',
    'javascript:alert(1)',
    'data:text/html,x',
  ]

  it.each(blocked)('rejects %s', (url) => {
    expect(isValidUrl(url)).toBe(false)
  })

  const allowed = [
    'https://example.com',
    'https://sub.example.com/path?q=1',
    'https://8.8.8.8',
    'http://93.184.216.34',
    'http://1.1.1.1',
    'http://16843009',
  ]

  it.each(allowed)('accepts %s', (url) => {
    expect(isValidUrl(url)).toBe(true)
  })

  it('rejects non-http(s) schemes', () => {
    expect(isValidUrl('ftp://example.com')).toBe(false)
    expect(isValidUrl('vbscript:msgbox(1)')).toBe(false)
    expect(isValidUrl('not-a-url')).toBe(false)
  })

  it('rejects URLs longer than 2048 chars', () => {
    expect(isValidUrl('https://example.com/' + 'a'.repeat(2048))).toBe(false)
  })
})

describe('BLOCKED_HOSTNAMES.test (preserved API)', () => {
  it('blocks internal hostnames', () => {
    expect(BLOCKED_HOSTNAMES.test('localhost')).toBe(true)
    expect(BLOCKED_HOSTNAMES.test('127.0.0.1')).toBe(true)
    expect(BLOCKED_HOSTNAMES.test('[::1]')).toBe(true)
    expect(BLOCKED_HOSTNAMES.test('169.254.169.254')).toBe(true)
  })

  it('allows public hostnames', () => {
    expect(BLOCKED_HOSTNAMES.test('example.com')).toBe(false)
    expect(BLOCKED_HOSTNAMES.test('8.8.8.8')).toBe(false)
  })
})

describe('generateShortCode', () => {
  it('returns a code of the requested length', () => {
    expect(generateShortCode()).toHaveLength(6)
    expect(generateShortCode(10)).toHaveLength(10)
  })

  it('only uses alphanumeric characters', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateShortCode(12)).toMatch(/^[a-zA-Z0-9]+$/)
    }
  })
})

describe('getShortUrl', () => {
  it('appends the short code to the base URL', () => {
    expect(getShortUrl('abc123')).toMatch(/\/abc123$/)
  })
})

describe('formatDate', () => {
  it('shows the India Standard Time date, whatever zone it runs in', () => {
    // 20:00 UTC on 19 October is 01:30 IST on 20 October.
    expect(formatDate('2026-10-19T20:00:00Z')).toBe('20 Oct 2026')
    expect(formatDate('2026-10-19T18:29:59Z')).toBe('19 Oct 2026')
    expect(formatDate('2026-10-19T18:30:00Z')).toBe('20 Oct 2026')
  })

  it('spells every month with three letters', () => {
    expect(formatDate('2026-09-10T06:00:00Z')).toBe('10 Sep 2026')
    expect(formatDate('2026-06-01T06:00:00Z')).toBe('1 Jun 2026')
    expect(formatDate('2026-12-31T17:00:00Z')).toBe('31 Dec 2026')
  })

  it('shows a placeholder for a missing or invalid date', () => {
    expect(formatDate(null)).toBe('---')
    expect(formatDate(undefined)).toBe('---')
    expect(formatDate('not a date')).toBe('---')
  })
})

describe('formatCount', () => {
  it('uses the singular for exactly one', () => {
    expect(formatCount(1, 'link')).toBe('1 link')
    expect(formatCount(1, 'click')).toBe('1 click')
  })

  it('uses the plural for zero and for more than one', () => {
    expect(formatCount(0, 'link')).toBe('0 links')
    expect(formatCount(2, 'link')).toBe('2 links')
  })

  it('groups thousands the en-US way, whatever the runtime locale', () => {
    expect(formatCount(1538, 'click')).toBe('1,538 clicks')
    expect(formatCount(100000, 'click')).toBe('100,000 clicks')
  })

  it('takes an irregular plural', () => {
    expect(formatCount(2, 'entry', 'entries')).toBe('2 entries')
    expect(formatCount(1, 'entry', 'entries')).toBe('1 entry')
  })

  it('is also exported as plural', () => {
    expect(plural(1, 'link')).toBe('1 link')
  })
})
