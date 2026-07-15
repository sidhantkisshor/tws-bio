import { describe, it, expect } from 'vitest'
import { isValidUrl, generateShortCode, getShortUrl, BLOCKED_HOSTNAMES } from '@/lib/utils'

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
