import { describe, it, expect } from 'vitest'
import { brandPageHtml, deadLinkResponse, notFoundResponse, unavailableResponse } from '../linkPages'

// The exact policy the dead-link pages have always sent. Spelled out here, not
// imported, so a loosened CSP fails this file instead of passing silently.
const DEAD_LINK_CSP = "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'"

const HOSTILE_HOME = 'https://evil.example/"><script>alert(1)</script>'

function expectSecurityHeaders(res: Response) {
  expect(res.headers.get('content-type')).toBe('text/html')
  expect(res.headers.get('cache-control')).toBe('private, no-store')
  expect(res.headers.get('content-security-policy')).toBe(DEAD_LINK_CSP)
  expect(res.headers.get('x-content-type-options')).toBe('nosniff')
  expect(res.headers.get('x-frame-options')).toBe('DENY')
}

describe('deadLinkResponse', () => {
  it('escapes the home URL, which can come from the request origin, so it cannot break out of the href', async () => {
    const html = await deadLinkResponse(404, '404: LINK NOT FOUND', 'Gone.', HOSTILE_HOME).text()
    expect(html).toContain('href="https://evil.example/&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"')
    expect(html).not.toContain('<script')
  })

  it('keeps the status it was given and carries the security headers on every one', () => {
    for (const status of [403, 404, 410] as const) {
      const res = deadLinkResponse(status, `${status}: TEST`, 'Message.', 'https://tws.bio')
      expect(res.status).toBe(status)
      expectSecurityHeaders(res)
    }
  })

  it('renders the eyebrow as the heading and the page title, with a button home', async () => {
    const html = await deadLinkResponse(410, '410: LINK EXPIRED', 'Past its date.', 'https://tws.bio').text()
    expect(html).toContain('<title>410: LINK EXPIRED</title>')
    expect(html).toContain('<h1 class="eyebrow">410: LINK EXPIRED</h1>')
    expect(html).toContain('<p>Past its date.</p>')
    expect(html).toContain('<a class="btn" href="https://tws.bio">Go to tws.bio</a>')
  })
})

describe('notFoundResponse', () => {
  it('is a 404 with the security headers and the shared not-found copy', async () => {
    const res = notFoundResponse('https://tws.bio')
    expect(res.status).toBe(404)
    expectSecurityHeaders(res)
    const html = await res.text()
    expect(html).toContain('404: LINK NOT FOUND')
    expect(html).toContain("This short link doesn't exist or is no longer active.")
  })

  it('escapes the home URL too', async () => {
    const html = await notFoundResponse(HOSTILE_HOME).text()
    expect(html).not.toContain('<script')
    expect(html).toContain('&quot;&gt;&lt;script&gt;')
  })
})

describe('unavailableResponse', () => {
  it('is a 503 with Retry-After: 30 and the same security headers as the dead-link pages', () => {
    const res = unavailableResponse()
    expect(res.status).toBe(503)
    expect(res.headers.get('retry-after')).toBe('30')
    expectSecurityHeaders(res)
  })

  it('tells the visitor the link is fine, rather than calling it dead', async () => {
    const html = await unavailableResponse().text()
    expect(html).toContain('503: TEMPORARILY UNAVAILABLE')
    expect(html).toContain('This link is fine')
    expect(html).not.toContain('LINK NOT FOUND')
  })

  it('retries without a script, since the CSP has no script-src: a meta refresh plus a reload button', async () => {
    const html = await unavailableResponse().text()
    expect(html).toContain('<meta http-equiv="refresh" content="15">')
    expect(html).toContain('<a class="btn" href="">Try again</a>')
    expect(html).not.toContain('<script')
  })
})

describe('brandPageHtml', () => {
  it('places headHtml inside the head, ahead of the title', () => {
    const html = brandPageHtml({ title: 'T', cardHtml: '<p>x</p>', headHtml: '<meta name="x" content="y">' })
    const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'))
    expect(head).toContain('<meta name="x" content="y"><title>T</title>')
  })

  it('adds nothing to the head when headHtml is absent', () => {
    const html = brandPageHtml({ title: 'T', cardHtml: '<p>x</p>' })
    expect(html).toContain('<meta name="theme-color" content="#0a0a0a">\n<title>T</title>')
  })
})

// Built from char codes so this file itself contains neither character.
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)

describe('page copy', () => {
  it('uses no em or en dash in any page', async () => {
    const pages = [
      await notFoundResponse('https://tws.bio').text(),
      await unavailableResponse().text(),
    ]
    for (const html of pages) expect(html).not.toMatch(DASHES)
  })
})
