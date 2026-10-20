import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, after } from 'next/server'
import { GET } from '../route'

type RpcResult = { data: unknown; error: { code: string; message: string } | null }

// The slice of the PostgREST builder the route touches: `.abortSignal()` to
// bound a call, then an await.
interface RpcBuilder extends PromiseLike<RpcResult> {
  abortSignal(signal: AbortSignal): RpcBuilder
}

const { rpc } = vi.hoisted(() => ({
  rpc: vi.fn<(fn: string, args: Record<string, unknown>) => RpcBuilder>(),
}))

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

const SLUG = 'nifty-options-101'
const DROP_LINK_ID = '3e2d1c0b-9a8f-4e7d-8c6b-5a4f3e2d1c0b'

const CHROME_DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

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

function visit(slug: string, { method = 'GET', userAgent = CHROME_DESKTOP } = {}) {
  const request = new NextRequest(`https://tws.bio/r/${encodeURIComponent(slug)}`, {
    method,
    headers: { 'user-agent': userAgent },
  })
  return GET(request, { params: Promise.resolve({ slug }) })
}

/** Run every task the route handed to after(), as Next.js does once the response is sent. */
async function runAfterTasks() {
  for (const [task] of vi.mocked(after).mock.calls) {
    await (typeof task === 'function' ? task() : task)
  }
}

// The redirect never waits on the database, so every request with a valid slug
// gets this same answer, whether or not it counts as a click.
function expectDropRedirect(res: Response) {
  expect(res.status).toBe(302)
  expect(res.headers.get('cache-control')).toContain('no-store')
  const location = new URL(res.headers.get('location') ?? '')
  expect(location.origin + location.pathname).toBe(`https://twsgurukulx.com/r/${SLUG}`)
  expect(location.searchParams.get('utm_source')).toBe('youtube')
  expect(location.searchParams.get('utm_medium')).toBe('tws_bio')
  expect(location.searchParams.get('utm_campaign')).toBe(SLUG)
}

beforeEach(() => {
  vi.clearAllMocks()
  results = {
    resource_drop_link_id: { data: DROP_LINK_ID, error: null },
    record_click_and_increment: { data: null, error: null },
  }
  rpc.mockImplementation((fn) => rpcBuilder(results[fn] ?? { data: null, error: null }))
})

describe('GET /r/[slug]', () => {
  it('sends a browser to the Resource Drop page with the default campaign, and records the click', async () => {
    const res = await visit(SLUG)
    expectDropRedirect(res)
    expect(after).toHaveBeenCalledTimes(1)

    await runAfterTasks()
    // The click lands on the slug's own links row, found or created first.
    expect(rpc.mock.calls.map(([fn]) => fn)).toEqual(['resource_drop_link_id', 'record_click_and_increment'])
    expect(rpc.mock.calls[0][1]).toEqual({ p_slug: SLUG })
    expect(rpc.mock.calls[1][1]).toMatchObject({ p_link_id: DROP_LINK_ID })
  })

  it.each([
    { label: 'a HEAD request', method: 'HEAD', userAgent: CHROME_DESKTOP },
    { label: 'the WhatsApp preview', method: 'GET', userAgent: 'WhatsApp/2.23.20.0 A' },
    { label: 'the Facebook preview', method: 'GET', userAgent: 'facebookexternalhit/1.1' },
    { label: 'the Telegram preview', method: 'GET', userAgent: 'TelegramBot (like TwitterBot)' },
  ])('redirects $label the same way, but records nothing', async ({ method, userAgent }) => {
    const res = await visit(SLUG, { method, userAgent })
    expectDropRedirect(res)
    await runAfterTasks()
    expect(rpc).not.toHaveBeenCalled()
  })

  it.each(['UPPER_case', 'a/b'])('answers the invalid slug "%s" with the branded 404 page, not plain text', async (slug) => {
    const res = await visit(slug)
    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toMatch(/^text\/html/)
    expect(res.headers.get('location')).toBeNull()
    const html = await res.text()
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('404: LINK NOT FOUND')
    expect(after).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })
})
