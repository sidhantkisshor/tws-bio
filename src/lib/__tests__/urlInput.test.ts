import { describe, expect, it } from 'vitest'
import { isValidUrl, normalizeUrl } from '@/lib/utils'

describe('normalizeUrl', () => {
  it('adds https:// to a pasted bare host', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com')
    expect(normalizeUrl('www.example.com/page?x=1#top')).toBe('https://www.example.com/page?x=1#top')
    expect(normalizeUrl('  shop.example.co.in:8443/cart  ')).toBe('https://shop.example.co.in:8443/cart')
  })

  it('completes a protocol-relative URL', () => {
    expect(normalizeUrl('//example.com/a')).toBe('https://example.com/a')
  })

  it('leaves URLs that already have a scheme unchanged', () => {
    expect(normalizeUrl('https://example.com')).toBe('https://example.com')
    expect(normalizeUrl('http://example.com')).toBe('http://example.com')
    expect(normalizeUrl('ftp://example.com')).toBe('ftp://example.com')
  })

  it('does not invent a URL from text that is not a host', () => {
    expect(normalizeUrl('mailto:me@example.com')).toBe('mailto:me@example.com')
    expect(normalizeUrl('javascript:alert(1)')).toBe('javascript:alert(1)')
    expect(normalizeUrl('localhost:3000')).toBe('localhost:3000')
    expect(normalizeUrl('two words.com')).toBe('two words.com')
    expect(normalizeUrl('')).toBe('')
  })
})

describe('isValidUrl on this app\'s own host', () => {
  it('rejects a destination that is another short link', () => {
    expect(isValidUrl('https://tws.bio/abc123')).toBe(false)
    expect(isValidUrl('https://www.tws.bio/abc123')).toBe(false)
    expect(isValidUrl('https://TWS.BIO/yt?x=1')).toBe(false)
  })

  it('accepts the app\'s own pages', () => {
    expect(isValidUrl('https://tws.bio')).toBe(true)
    expect(isValidUrl('https://tws.bio/')).toBe(true)
    expect(isValidUrl('https://tws.bio/resources')).toBe(true)
    expect(isValidUrl('https://tws.bio/r/some-video')).toBe(true)
  })

  it('still accepts other sites', () => {
    expect(isValidUrl('https://tws.bio.example.com/abc')).toBe(true)
    expect(isValidUrl('https://example.com/tws.bio/abc')).toBe(true)
  })
})
