import { describe, it, expect } from 'vitest'
import { checkDestination, checkDestinations } from '../destinationCheck'

type Reply = { status: number; location?: string } | Error

/** A fake fetch driven by a table of `METHOD url` to reply. Records every call. */
function fakeFetch(table: Record<string, Reply>) {
  const calls: { method: string; url: string; headers: Record<string, string>; redirect?: string }[] = []
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    calls.push({
      method,
      url,
      headers: (init?.headers ?? {}) as Record<string, string>,
      redirect: init?.redirect,
    })
    const reply = table[`${method} ${url}`]
    if (!reply) throw new Error(`unexpected ${method} ${url}`)
    if (reply instanceof Error) throw reply
    const headers = new Headers()
    if (reply.location) headers.set('location', reply.location)
    return new Response(null, { status: reply.status, headers })
  }) as typeof fetch
  return { impl, calls }
}

describe('checkDestination', () => {
  it('returns ok for a 2xx HEAD and sends the checker user agent without following redirects', async () => {
    const f = fakeFetch({ 'HEAD https://a.com/': { status: 200 } })
    const r = await checkDestination('https://a.com/', { fetchImpl: f.impl })
    expect(r).toMatchObject({ status: 'ok', httpStatus: 200, finalUrl: 'https://a.com/' })
    expect(typeof r.ms).toBe('number')
    expect(f.calls[0].headers['User-Agent']).toBe('tws.bio link checker')
    expect(f.calls[0].redirect).toBe('manual')
  })

  it('follows redirects manually and reports redirect with the final URL', async () => {
    const f = fakeFetch({
      'HEAD https://a.com/': { status: 301, location: '/b' },
      'HEAD https://a.com/b': { status: 302, location: 'https://c.com/x' },
      'HEAD https://c.com/x': { status: 200 },
    })
    const r = await checkDestination('https://a.com/', { fetchImpl: f.impl })
    expect(r).toMatchObject({ status: 'redirect', httpStatus: 200, finalUrl: 'https://c.com/x' })
  })

  it('gives error when the redirect chain is longer than 5 hops', async () => {
    const table: Record<string, Reply> = {}
    for (let i = 0; i < 10; i++) {
      table[`HEAD https://a.com/${i}`] = { status: 302, location: `/${i + 1}` }
    }
    const f = fakeFetch(table)
    const r = await checkDestination('https://a.com/0', { fetchImpl: f.impl })
    expect(r.status).toBe('error')
    expect(f.calls).toHaveLength(6)
  })

  it('allows exactly 5 redirects', async () => {
    const table: Record<string, Reply> = { 'HEAD https://a.com/5': { status: 200 } }
    for (let i = 0; i < 5; i++) table[`HEAD https://a.com/${i}`] = { status: 302, location: `/${i + 1}` }
    const r = await checkDestination('https://a.com/0', { fetchImpl: fakeFetch(table).impl })
    expect(r.status).toBe('redirect')
  })

  it('gives error for a redirect with no Location', async () => {
    const f = fakeFetch({ 'HEAD https://a.com/': { status: 302 } })
    expect((await checkDestination('https://a.com/', { fetchImpl: f.impl })).status).toBe('error')
  })

  it('blocks a redirect hop that points at a private host', async () => {
    const f = fakeFetch({ 'HEAD https://a.com/': { status: 302, location: 'http://169.254.169.254/latest' } })
    const r = await checkDestination('https://a.com/', { fetchImpl: f.impl })
    expect(r.status).toBe('blocked')
    expect(f.calls).toHaveLength(1)
  })

  it.each([
    'http://localhost:3000/x',
    'http://127.0.0.1/',
    'http://10.0.0.5/',
    'http://192.168.1.1/',
    'http://[::1]/',
    'https://printer.local/',
    'https://db.internal/x',
    'https://tws.bio/abc',
    'https://www.tws.bio/abc',
    'https://x.tws.bio/abc',
  ])('blocks %s without calling fetch', async (url) => {
    const f = fakeFetch({})
    const r = await checkDestination(url, { fetchImpl: f.impl })
    expect(r.status).toBe('blocked')
    expect(f.calls).toHaveLength(0)
  })

  it('uses the shortDomain option when given', async () => {
    const f = fakeFetch({})
    const r = await checkDestination('https://go.example.net/a', { fetchImpl: f.impl, shortDomain: 'go.example.net' })
    expect(r.status).toBe('blocked')
  })

  it('gives error for non-http schemes and unparseable input', async () => {
    const f = fakeFetch({})
    expect((await checkDestination('ftp://a.com/', { fetchImpl: f.impl })).status).toBe('error')
    expect((await checkDestination('javascript:alert(1)', { fetchImpl: f.impl })).status).toBe('error')
    expect((await checkDestination('', { fetchImpl: f.impl })).status).toBe('error')
    expect(f.calls).toHaveLength(0)
  })

  it.each([405, 501, 403])('falls back to GET when HEAD returns %i', async (code) => {
    const f = fakeFetch({
      'HEAD https://a.com/': { status: code },
      'GET https://a.com/': { status: 200 },
    })
    const r = await checkDestination('https://a.com/', { fetchImpl: f.impl })
    expect(r.status).toBe('ok')
    expect(f.calls.map((c) => c.method)).toEqual(['HEAD', 'GET'])
  })

  it('reports broken for 404, 500, and a GET that still gives 403', async () => {
    const f = fakeFetch({
      'HEAD https://a.com/404': { status: 404 },
      'HEAD https://a.com/500': { status: 500 },
      'HEAD https://a.com/403': { status: 403 },
      'GET https://a.com/403': { status: 403 },
    })
    expect(await checkDestination('https://a.com/404', { fetchImpl: f.impl })).toMatchObject({ status: 'broken', httpStatus: 404 })
    expect(await checkDestination('https://a.com/500', { fetchImpl: f.impl })).toMatchObject({ status: 'broken', httpStatus: 500 })
    expect(await checkDestination('https://a.com/403', { fetchImpl: f.impl })).toMatchObject({ status: 'broken', httpStatus: 403 })
  })

  it('reports timeout when fetch aborts with a TimeoutError', async () => {
    const err = new DOMException('The operation timed out', 'TimeoutError')
    const f = fakeFetch({ 'HEAD https://a.com/': err })
    expect((await checkDestination('https://a.com/', { fetchImpl: f.impl })).status).toBe('timeout')
  })

  it('times out for real when fetch honours the signal and never answers', async () => {
    const impl = ((_: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
      })) as unknown as typeof fetch
    const r = await checkDestination('https://a.com/', { fetchImpl: impl, timeoutMs: 20 })
    expect(r.status).toBe('timeout')
  })

  it('reports error for a network failure', async () => {
    const f = fakeFetch({ 'HEAD https://a.com/': new TypeError('fetch failed') })
    expect((await checkDestination('https://a.com/', { fetchImpl: f.impl })).status).toBe('error')
  })
})

describe('checkDestinations', () => {
  it('keeps input order and never exceeds the concurrency limit', async () => {
    let active = 0
    let peak = 0
    const impl = (async (input: RequestInfo | URL) => {
      active++
      peak = Math.max(peak, active)
      await new Promise((r) => setTimeout(r, 5))
      active--
      return new Response(null, { status: String(input).includes('bad') ? 404 : 200 })
    }) as typeof fetch
    const urls = Array.from({ length: 10 }, (_, i) => `https://a.com/${i === 3 ? 'bad' : i}`)
    const out = await checkDestinations(urls, 3, { fetchImpl: impl })
    expect(out).toHaveLength(10)
    expect(out[3].status).toBe('broken')
    expect(out.filter((r) => r.status === 'ok')).toHaveLength(9)
    expect(peak).toBeLessThanOrEqual(3)
    expect(peak).toBeGreaterThan(1)
  })

  it('handles an empty list', async () => {
    expect(await checkDestinations([])).toEqual([])
  })
})
