import { describe, it, expect } from 'vitest'
import { shouldForwardParam, withForwardedParams, FORWARDED_PARAMS } from '../forwardParams'

const qs = (s: string) => new URLSearchParams(s)

describe('shouldForwardParam', () => {
  it('forwards every utm_ parameter, whatever the case', () => {
    expect(shouldForwardParam('utm_source')).toBe(true)
    expect(shouldForwardParam('utm_medium')).toBe(true)
    expect(shouldForwardParam('utm_campaign')).toBe(true)
    expect(shouldForwardParam('utm_term')).toBe(true)
    expect(shouldForwardParam('utm_content')).toBe(true)
    expect(shouldForwardParam('UTM_Source')).toBe(true)
    expect(shouldForwardParam('utm_anything_new')).toBe(true)
  })

  it('forwards the cross-domain linker and the ad click IDs', () => {
    for (const key of ['_gl', 'gclid', 'gbraid', 'wbraid', 'fbclid', 'ttclid', 'msclkid', 'li_fat_id']) {
      expect(shouldForwardParam(key), key).toBe(true)
    }
  })

  it('ignores parameters that are not tracking parameters', () => {
    expect(shouldForwardParam('password')).toBe(false)
    expect(shouldForwardParam('redirect')).toBe(false)
    expect(shouldForwardParam('admin')).toBe(false)
    expect(shouldForwardParam('utmsource')).toBe(false) // no underscore
  })
})

describe('withForwardedParams', () => {
  it('carries utm parameters onto a bare destination', () => {
    const out = withForwardedParams(
      'https://twsgurukulx.com/course',
      qs('utm_source=instagram&utm_medium=bio'),
    )
    const url = new URL(out)
    expect(url.origin + url.pathname).toBe('https://twsgurukulx.com/course')
    expect(url.searchParams.get('utm_source')).toBe('instagram')
    expect(url.searchParams.get('utm_medium')).toBe('bio')
  })

  it('carries the GA4 cross-domain linker, so the session survives the hop', () => {
    const out = withForwardedParams('https://hitpoint.app/', qs('_gl=1abc123'))
    expect(new URL(out).searchParams.get('_gl')).toBe('1abc123')
  })

  it('carries ad click IDs so Meta and Google can attribute the conversion', () => {
    const out = withForwardedParams(
      'https://tradingwithsidhant.com/p',
      qs('fbclid=IwAR123&gclid=Cj0KEQ'),
    )
    const url = new URL(out)
    expect(url.searchParams.get('fbclid')).toBe('IwAR123')
    expect(url.searchParams.get('gclid')).toBe('Cj0KEQ')
  })

  it('keeps parameters the destination already declares', () => {
    const out = withForwardedParams(
      'https://twsgurukulx.com/c?utm_source=newsletter',
      qs('utm_source=instagram'),
    )
    const url = new URL(out)
    expect(url.searchParams.getAll('utm_source')).toEqual(['newsletter'])
  })

  it('preserves the destination path, hash and unrelated query', () => {
    const out = withForwardedParams(
      'https://hitpoint.app/pricing?plan=pro#faq',
      qs('utm_source=ig'),
    )
    const url = new URL(out)
    expect(url.pathname).toBe('/pricing')
    expect(url.hash).toBe('#faq')
    expect(url.searchParams.get('plan')).toBe('pro')
    expect(url.searchParams.get('utm_source')).toBe('ig')
  })

  it('drops parameters that are not on the allow-list', () => {
    const out = withForwardedParams(
      'https://tradingwithsidhant.com/',
      qs('utm_source=ig&evil=1&redirect=https://attacker.example'),
    )
    const url = new URL(out)
    expect(url.searchParams.get('utm_source')).toBe('ig')
    expect(url.searchParams.has('evil')).toBe(false)
    expect(url.searchParams.has('redirect')).toBe(false)
  })

  it('leaves app-scheme deep links untouched', () => {
    const deep = 'youtube://watch?v=abc'
    expect(withForwardedParams(deep, qs('utm_source=ig'))).toBe(deep)
    expect(withForwardedParams('instagram://user?username=x', qs('_gl=1'))).toBe(
      'instagram://user?username=x',
    )
  })

  it('returns the destination unchanged when there is nothing to forward', () => {
    expect(withForwardedParams('https://hitpoint.app/', qs(''))).toBe('https://hitpoint.app/')
  })

  it('returns the original string when the destination cannot be parsed', () => {
    expect(withForwardedParams('not a url', qs('utm_source=ig'))).toBe('not a url')
  })

  it('encodes forwarded values rather than trusting them', () => {
    const out = withForwardedParams(
      'https://hitpoint.app/',
      qs('utm_campaign=' + encodeURIComponent('a b&c=d')),
    )
    const url = new URL(out)
    expect(url.searchParams.get('utm_campaign')).toBe('a b&c=d')
    expect(url.hostname).toBe('hitpoint.app')
  })
})

describe('withForwardedParams regressions', () => {
  it('leaves a destination query with a semicolon byte for byte, so param b is not lost', () => {
    const out = withForwardedParams('https://ex.com/p?a=1;b=2', qs('utm_source=ig'))
    expect(out).toContain('a=1;b=2')
  })

  it('does not form-encode a space already in the destination query to a plus', () => {
    const out = withForwardedParams('https://ex.com/p?q=a b', qs('utm_source=ig'))
    expect(out).not.toContain('q=a+b')
  })

  it('leaves an already-encoded destination value untouched, not double- or single-decoded', () => {
    const out = withForwardedParams(
      'https://ex.com/p?next=https%3A%2F%2Ffoo.com%2Fa',
      qs('utm_source=ig'),
    )
    expect(out).toContain('next=https%3A%2F%2Ffoo.com%2Fa')
  })

  it('only ever appends to the destination, so a no-op and a real forward share the same prefix', () => {
    const destination = 'https://ex.com/p?q=a b&next=https%3A%2F%2Ffoo.com'
    expect(withForwardedParams(destination, qs('evil=1'))).toBe(destination)
    expect(withForwardedParams(destination, qs('utm_source=ig'))).toBe(
      `${destination}&utm_source=ig`,
    )
  })

  it('does not let a differently-cased utm_source add a second value', () => {
    const out = withForwardedParams(
      'https://ex.com/c?utm_source=newsletter',
      qs('UTM_SOURCE=attacker'),
    )
    expect(out).not.toContain('attacker')
    expect(new URL(out).searchParams.getAll('utm_source')).toEqual(['newsletter'])
  })

  it('rewrites an uppercase fbclid to the lowercase key Meta actually reads', () => {
    const out = withForwardedParams('https://ex.com/c', qs('FBCLID=abc'))
    expect(out).toContain('fbclid=abc')
    expect(out).not.toContain('FBCLID')
  })

  it('rewrites an uppercase gclid to the lowercase key Google actually reads', () => {
    const out = withForwardedParams('https://ex.com/c', qs('Gclid=xyz'))
    expect(out).toContain('gclid=xyz')
    expect(out).not.toContain('Gclid')
  })

  it("normalises Snapchat's click ID to its canonical ScCid spelling", () => {
    const canonical = [...FORWARDED_PARAMS].find((p) => p.toLowerCase() === 'sccid')
    expect(canonical).toBe('ScCid')
    const out = withForwardedParams('https://ex.com/c', qs('sccid=1'))
    expect(out).toContain(`${canonical}=1`)
  })

  it('lowercases a mixed-case utm_ key, since that is the only casing GA4 reads', () => {
    const out = withForwardedParams('https://ex.com/c', qs('UTM_Source=ig'))
    expect(out).toContain('utm_source=ig')
    expect(out).not.toContain('UTM_Source')
  })

  it('no longer forwards ref or source, since they are generic affiliate codes a stranger could mint to claim commission on our clicks', () => {
    expect(shouldForwardParam('ref')).toBe(false)
    expect(shouldForwardParam('source')).toBe(false)
    expect(withForwardedParams('https://ex.com/c', qs('ref=affiliate&source=x'))).toBe(
      'https://ex.com/c',
    )
  })

  it('caps the number of forwarded params at the documented MAX_FORWARDED_PARAMS (25)', () => {
    const MAX_FORWARDED_PARAMS = 25
    const params = new URLSearchParams()
    for (let i = 0; i < 100; i++) params.append(`utm_field${i}`, `v${i}`)

    const out = withForwardedParams('https://ex.com/c', params)
    const url = new URL(out)
    const forwardedCount = [...url.searchParams.keys()].filter((k) => k.startsWith('utm_field')).length
    expect(forwardedCount).toBeLessThanOrEqual(MAX_FORWARDED_PARAMS)
  })

  it('caps total output length near the documented MAX_FORWARDED_CHARS (2048), so a huge value cannot blow the Location header past 4 KB', () => {
    const out = withForwardedParams(
      'https://ex.com/c',
      qs('utm_campaign=' + 'x'.repeat(5000)),
    )
    expect(out.length).toBeLessThan(4096)
  })

  it('drops an incoming param whose value is empty, since an empty utm_source suppresses GA4 referral attribution', () => {
    const destination = 'https://ex.com/c'
    expect(withForwardedParams(destination, qs('utm_source=&fbclid='))).toBe(destination)
    expect(withForwardedParams(destination, qs('utm_source'))).toBe(destination)
  })

  it('collapses duplicate incoming keys to the first occurrence', () => {
    const out = withForwardedParams('https://ex.com/c', qs('utm_source=a&utm_source=b'))
    const url = new URL(out)
    expect(url.searchParams.getAll('utm_source')).toEqual(['a'])
  })

  it('appends forwarded params into the query, before the hash, on a bare fragment destination', () => {
    const out = withForwardedParams('https://ex.com/p#faq', qs('utm_source=ig'))
    expect(out).toBe('https://ex.com/p?utm_source=ig#faq')
  })

  it('appends forwarded params before the hash when the destination already has a query and a hash', () => {
    const out = withForwardedParams('https://ex.com/p?a=1#faq', qs('utm_source=ig'))
    expect(out).toBe('https://ex.com/p?a=1&utm_source=ig#faq')
  })

  it('never changes the destination host, however path-like or protocol-like the forwarded value is', () => {
    const cases = [
      qs('utm_source=//evil.com'),
      qs('utm_content=@evil.com'),
      qs('utm_term=?x=1'),
    ]
    for (const params of cases) {
      const out = withForwardedParams('https://ex.com/p', params)
      expect(new URL(out).hostname).toBe('ex.com')
    }
  })

  it('does not double the separator when the destination query string is a trailing bare question mark', () => {
    const out = withForwardedParams('https://ex.com/p?', qs('utm_source=ig'))
    expect(out).not.toContain('?&')
    expect(out).toBe('https://ex.com/p?utm_source=ig')
  })
})
