import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, after } from 'next/server'
import type { Database } from '@/types/database'
import { GET } from '../route'

type LinkRow = Database['public']['Tables']['links']['Row']
type RpcResult = { data: unknown; error: { code: string; message: string } | null }

// The slice of the PostgREST builder the route touches: `.abortSignal()` to
// bound a call, then an await or a `.then()`.
interface RpcBuilder extends PromiseLike<RpcResult> {
  abortSignal(signal: AbortSignal): RpcBuilder
}

const { rpc } = vi.hoisted(() => {
  // The route and linkPages read the short domain once, at import, so it is
  // pinned before the route loads. The self-loop check and the default
  // utm_source both depend on it.
  process.env.NEXT_PUBLIC_SHORT_DOMAIN = 'tws.bio'
  return { rpc: vi.fn<(fn: string, args: Record<string, unknown>) => RpcBuilder>() }
})

// The route builds one anon client at import and only ever calls rpc() on it.
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ rpc }),
}))

// after() needs a live Next.js request scope. Capturing its tasks lets a test
// see whether a click was scheduled, then run it to see what it records.
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: vi.fn(),
}))

const CODE = 'abc123'
const LINK_ID = '5f0c2b1e-8d4a-4c3b-9e2f-1a7d6c5b4e3f'
const DESTINATION = 'https://twsgurukulx.com/course'
// A bare click with no referrer lands on the destination stamped with the
// link's own campaign, with the short domain as its source.
const TAGGED_DESTINATION = `${DESTINATION}?utm_source=tws.bio&utm_medium=short_link&utm_campaign=${CODE}`
const VIDEO_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

const CHROME_DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
// Full Chrome, not a WebView (no "; wv)"), so it can take an intent: redirect.
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36'
const CUBOT =
  'Mozilla/5.0 (Linux; Android 11; CUBOT KINGKONG 5 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
const LINK_PREVIEWS = ['WhatsApp/2.23.20.0 A', 'facebookexternalhit/1.1', 'TelegramBot (like TwitterBot)']

function makeLink(overrides: Partial<LinkRow> = {}): LinkRow {
  return {
    id: LINK_ID,
    short_code: CODE,
    original_url: DESTINATION,
    link_type: 'url',
    ios_deep_link: null,
    android_deep_link: null,
    fallback_url: null,
    expires_at: null,
    max_clicks: null,
    total_clicks: 0,
    unique_clicks: 0,
    is_active: true,
    campaign_id: null,
    title: null,
    description: null,
    tags: null,
    custom_meta: null,
    password_hash: null,
    qr_code_url: null,
    user_id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
    created_at: '2026-10-01T09:00:00.000Z',
    updated_at: '2026-10-01T09:00:00.000Z',
    ...overrides,
  }
}

// What the deep-link form saves for a YouTube video.
function makeDeepLink(): LinkRow {
  return makeLink({
    link_type: 'deep_link',
    original_url: VIDEO_URL,
    fallback_url: VIDEO_URL,
    ios_deep_link: 'youtube://www.youtube.com/watch?v=dQw4w9WgXcQ',
    android_deep_link: 'vnd.youtube:dQw4w9WgXcQ',
  })
}

// What each RPC resolves to, by function name. Reset before every test.
let results: Record<string, RpcResult>

function rpcBuilder(result: RpcResult): RpcBuilder {
  const settled = Promise.resolve(result)
  const builder: RpcBuilder = {
    abortSignal: () => builder,
    then: (onFulfilled, onRejected) => settled.then(onFulfilled, onRejected),
  }
  return builder
}

function serve(link: LinkRow) {
  results.get_link_by_short_code = { data: [link], error: null }
}

function visit(shortCode: string, { method = 'GET', userAgent = CHROME_DESKTOP, referer = '' } = {}) {
  const headers: Record<string, string> = { 'user-agent': userAgent }
  if (referer) headers.referer = referer
  const request = new NextRequest(`https://tws.bio/${shortCode}`, { method, headers })
  return GET(request, { params: Promise.resolve({ shortCode }) })
}

/** Run every task the route handed to after(), as Next.js does once the response is sent. */
async function runAfterTasks() {
  for (const [task] of vi.mocked(after).mock.calls) {
    await (typeof task === 'function' ? task() : task)
  }
}

/** The arguments of every record_click_and_increment call made so far. */
function recordedClicks() {
  return rpc.mock.calls.filter(([fn]) => fn === 'record_click_and_increment').map(([, args]) => args)
}

async function expectNoClick() {
  await runAfterTasks()
  expect(recordedClicks()).toHaveLength(0)
}

async function expectOneClick() {
  expect(after).toHaveBeenCalledTimes(1)
  await runAfterTasks()
  const clicks = recordedClicks()
  expect(clicks).toHaveLength(1)
  expect(clicks[0]).toMatchObject({ p_link_id: LINK_ID })
}

beforeEach(() => {
  vi.clearAllMocks()
  // Pinned so a value in the shell running the tests cannot change them.
  vi.stubEnv('SHORTLINK_AUTOTAG', undefined)
  // Click tagging stays off, so a click task never reaches for the tag server.
  // The fetch stub is a backstop: nothing in this file may leave the machine.
  vi.stubEnv('SGTM_CLICKS', undefined)
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('route tests must not reach the network'))))
  results = {
    get_link_by_short_code: { data: [makeLink()], error: null },
    record_click_and_increment: { data: null, error: null },
  }
  rpc.mockImplementation((fn) => rpcBuilder(results[fn] ?? { data: null, error: null }))
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('GET /[shortCode], requests that go nowhere', () => {
  it.each(['favicon.ico', 'wp-login.php'])(
    'answers %s, which cannot be a short code, with a 404 and no lookup',
    async (path) => {
      const res = await visit(path)
      expect(res.status).toBe(404)
      expect(res.headers.get('content-type')).toMatch(/^text\/html/)
      expect(rpc).not.toHaveBeenCalled()
      expect(after).not.toHaveBeenCalled()
    },
  )

  it.each([
    { label: 'null', data: null },
    { label: 'an empty list', data: [] },
  ])('answers a code the lookup returns $label for with the branded 404, and schedules no click', async ({ data }) => {
    results.get_link_by_short_code = { data, error: null }
    const res = await visit('nosuch')
    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toMatch(/^text\/html/)
    expect(await res.text()).toContain('404: LINK NOT FOUND')
    expect(rpc).toHaveBeenCalledWith('get_link_by_short_code', { p_short_code: 'nosuch' })
    expect(after).not.toHaveBeenCalled()
  })

  it('answers an expired link with a 410 and records no click', async () => {
    serve(makeLink({ expires_at: new Date(Date.now() - 60_000).toISOString() }))
    const res = await visit(CODE)
    expect(res.status).toBe(410)
    expect(res.headers.get('location')).toBeNull()
    await expectNoClick()
  })

  it('answers a failed lookup with a 503 to retry, never cached, and records no click', async () => {
    // The route logs the failure on purpose. Silenced so it does not read as a test error.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    results.get_link_by_short_code = {
      data: null,
      error: { code: '57014', message: 'canceling statement due to statement timeout' },
    }
    const res = await visit(CODE)
    expect(res.status).toBe(503)
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0)
    expect(res.headers.get('cache-control')).toContain('no-store')
    await expectNoClick()
  })

  it.each(['javascript:alert(1)', 'http://127.0.0.1/'])(
    'refuses the unsafe destination %s with a 403 page and records no click',
    async (destination) => {
      serve(makeLink({ original_url: destination }))
      const res = await visit(CODE)
      expect(res.status).toBe(403)
      expect(res.headers.get('content-type')).toMatch(/^text\/html/)
      expect(res.headers.get('location')).toBeNull()
      await expectNoClick()
    },
  )

  it('refuses a destination that is this same short link, which would loop, and records no click', async () => {
    serve(makeLink({ original_url: `https://tws.bio/${CODE}` }))
    const res = await visit(CODE)
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
    expect(res.headers.get('content-type')).toMatch(/^text\/html/)
    expect(res.headers.get('location')).toBeNull()
    await expectNoClick()
  })
})

describe('GET /[shortCode], a standard link', () => {
  it('sends a browser on with an uncached 307 to the tagged destination and records one click', async () => {
    const res = await visit(CODE)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(TAGGED_DESTINATION)
    expect(res.headers.get('cache-control')).toContain('no-store')
    await expectOneClick()
  })

  it('sends the destination untagged when SHORTLINK_AUTOTAG=off', async () => {
    vi.stubEnv('SHORTLINK_AUTOTAG', 'off')
    const res = await visit(CODE)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(DESTINATION)
  })

  it('answers HEAD with the same redirect but records no click', async () => {
    const res = await visit(CODE, { method: 'HEAD' })
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(TAGGED_DESTINATION)
    await expectNoClick()
  })

  it.each(LINK_PREVIEWS)('redirects the link preview "%s" but records no click', async (userAgent) => {
    const res = await visit(CODE, { userAgent })
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(TAGGED_DESTINATION)
    await expectNoClick()
  })

  it('records a click from a CUBOT phone, a real visitor whose brand name contains "bot"', async () => {
    const res = await visit(CODE, { userAgent: CUBOT })
    expect(res.status).toBe(307)
    await expectOneClick()
  })
})

describe('GET /[shortCode], the default utm_source', () => {
  it('names the site the link was clicked on', async () => {
    const res = await visit(CODE, { referer: 'https://www.youtube.com/watch?v=x' })
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(
      `${DESTINATION}?utm_source=youtube.com&utm_medium=short_link&utm_campaign=${CODE}`,
    )
  })

  it("adds no utm params at all on a click from one of the business's own sites", async () => {
    const res = await visit(CODE, { referer: 'https://tradingwithsidhant.com/' })
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(DESTINATION)
  })

  it('keeps utm_source=tws.bio when the click has no referrer', async () => {
    const res = await visit(CODE)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(TAGGED_DESTINATION)
  })

  it('stamps the deep-link web fallback with the same source', async () => {
    serve(makeDeepLink())
    const res = await visit(CODE, { userAgent: IPHONE_SAFARI, referer: 'https://l.instagram.com/' })
    expect(res.status).toBe(200)
    const fallback = `${VIDEO_URL}&utm_source=l.instagram.com&utm_medium=short_link&utm_campaign=${CODE}`
    expect(await res.text()).toContain(JSON.stringify(fallback))
  })
})

describe('GET /[shortCode], a deep link', () => {
  it('serves an iPhone the app hand-off page with its security headers, and records one click', async () => {
    serve(makeDeepLink())
    const res = await visit(CODE, { userAgent: IPHONE_SAFARI })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/^text\/html/)
    const csp = res.headers.get('content-security-policy') ?? ''
    expect(csp).toContain("default-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(res.headers.get('x-frame-options')).toBe('DENY')
    expect(res.headers.get('cache-control')).toContain('no-store')
    expect(await res.text()).toContain('href="youtube://www.youtube.com/watch?v=dQw4w9WgXcQ"')
    await expectOneClick()
  })

  it('sends Android Chrome an uncached 307 to an intent: URI or the web fallback, and records one click', async () => {
    serve(makeDeepLink())
    const res = await visit(CODE, { userAgent: ANDROID_CHROME })
    expect(res.status).toBe(307)
    expect(res.headers.get('cache-control')).toContain('no-store')
    const location = res.headers.get('location') ?? ''
    expect(location).toMatch(/^(intent:|https:\/\/www\.youtube\.com\/watch\?v=dQw4w9WgXcQ)/)
    // Either way, a visitor without the app has to end up on the video page.
    const landing = location.startsWith('intent:')
      ? decodeURIComponent(/S\.browser_fallback_url=([^;]+)/.exec(location)?.[1] ?? '')
      : location
    expect(landing.slice(0, VIDEO_URL.length)).toBe(VIDEO_URL)
    await expectOneClick()
  })
})
