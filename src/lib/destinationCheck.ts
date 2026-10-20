import { isBlockedHost } from './utils'

// Server-side only: asks a destination whether it still answers. Never import
// this from a Client Component.
//
// Statuses:
//  - ok: the first answer was 2xx.
//  - redirect: the page answered 2xx after one or more redirects (finalUrl says where).
//  - broken: the last answer was 4xx or 5xx. A HEAD that gets 400, 403, 404,
//    405 or 501 is asked again with GET first.
//  - timeout: no answer within timeoutMs, for the whole chain.
//  - blocked: the URL, or a redirect hop, points somewhere this checker will not call.
//  - error: not http(s), no usable answer, a redirect without a Location, too many
//    redirects, or a network failure.
//  - skipped: checkDestinations' time budget ran out before this URL started,
//    or while a shortened check of it was still waiting.

export type DestinationStatus = 'ok' | 'redirect' | 'broken' | 'timeout' | 'blocked' | 'error' | 'skipped'

export interface DestinationResult {
  status: DestinationStatus
  httpStatus?: number
  finalUrl?: string
  ms: number
}

const USER_AGENT = 'tws.bio link checker'
const MAX_REDIRECTS = 5
const DEFAULT_TIMEOUT_MS = 6000
/** HEAD answers that get one retry with GET before the link counts as broken. */
const HEAD_RETRY_STATUSES = new Set([400, 403, 404, 405, 501])

function defaultShortDomain(): string {
  return (process.env.NEXT_PUBLIC_SHORT_DOMAIN || 'tws.bio').toLowerCase().replace(/^www\./, '')
}

function isBlockedTarget(url: URL, shortDomain: string): boolean {
  const host = url.hostname.toLowerCase().replace(/\.+$/, '')
  if (isBlockedHost(host)) return true
  if (host.endsWith('.local') || host.endsWith('.internal')) return true
  const bare = host.replace(/^www\./, '')
  return bare === shortDomain || bare.endsWith(`.${shortDomain}`)
}

function isTimeout(err: unknown): boolean {
  return err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')
}

export async function checkDestination(
  url: string,
  opts: { timeoutMs?: number; fetchImpl?: typeof fetch; shortDomain?: string } = {},
): Promise<DestinationResult> {
  const started = Date.now()
  const done = (r: Omit<DestinationResult, 'ms'>): DestinationResult => ({
    ...r,
    ms: Date.now() - started,
  })
  const doFetch = opts.fetchImpl ?? fetch
  const shortDomain = (opts.shortDomain ?? defaultShortDomain()).toLowerCase().replace(/^www\./, '')
  const signal = AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  let current: URL
  try {
    current = new URL(url.trim())
  } catch {
    return done({ status: 'error' })
  }

  let hops = 0
  try {
    for (;;) {
      if (current.protocol !== 'http:' && current.protocol !== 'https:') {
        return done({ status: 'error', finalUrl: current.toString() })
      }
      if (isBlockedTarget(current, shortDomain)) {
        return done({ status: 'blocked', finalUrl: current.toString() })
      }

      const request = (method: 'HEAD' | 'GET') =>
        doFetch(current.toString(), {
          method,
          redirect: 'manual',
          signal,
          headers: { 'User-Agent': USER_AGENT },
        })

      // Many sites (x.com, open.spotify.com, some CDNs) refuse or mishandle
      // HEAD, so these answers get one GET before the link counts as broken.
      let res = await request('HEAD')
      if (HEAD_RETRY_STATUSES.has(res.status)) {
        await res.body?.cancel().catch(() => {})
        res = await request('GET')
      }
      // Only the status and headers are read: free the body of a GET.
      await res.body?.cancel().catch(() => {})

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location')
        if (!location) return done({ status: 'error', httpStatus: res.status, finalUrl: current.toString() })
        if (hops >= MAX_REDIRECTS) {
          return done({ status: 'error', httpStatus: res.status, finalUrl: current.toString() })
        }
        hops += 1
        try {
          current = new URL(location, current)
        } catch {
          return done({ status: 'error', httpStatus: res.status, finalUrl: current.toString() })
        }
        continue
      }

      const finalUrl = current.toString()
      if (res.status >= 200 && res.status < 300) {
        return done({ status: hops > 0 ? 'redirect' : 'ok', httpStatus: res.status, finalUrl })
      }
      if (res.status >= 400) return done({ status: 'broken', httpStatus: res.status, finalUrl })
      return done({ status: 'error', httpStatus: res.status, finalUrl })
    }
  } catch (err) {
    if (isTimeout(err) || signal.aborted) return done({ status: 'timeout' })
    return done({ status: 'error' })
  }
}

export interface CheckManyOptions {
  timeoutMs?: number
  fetchImpl?: typeof fetch
  shortDomain?: string
  /**
   * Time budget for the whole batch, in ms. A URL that would start with less
   * than MIN_START_MS of it left comes back 'skipped' (not called), and a
   * URL that starts near the end gets only the time that is left. So the
   * batch ends within the budget however many slow hosts it meets, and a
   * caller with a hard limit (a Server Action's maxDuration) still gets
   * every result it finished.
   */
  budgetMs?: number
  /** The clock, for tests. Defaults to Date.now. */
  now?: () => number
}

/** A check needs at least this long to tell a slow host from a dead one. */
const MIN_START_MS = 1000

/** Check many URLs, at most `concurrency` at a time. Results keep the input order. */
export async function checkDestinations(
  urls: string[],
  concurrency = 6,
  opts: CheckManyOptions = {},
): Promise<DestinationResult[]> {
  const { budgetMs, now = Date.now, ...one } = opts
  const timeoutMs = one.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const deadline = budgetMs === undefined ? Infinity : now() + budgetMs
  const results = new Array<DestinationResult>(urls.length)
  let next = 0
  const worker = async () => {
    while (next < urls.length) {
      const i = next++
      const left = deadline - now()
      if (left < Math.min(MIN_START_MS, timeoutMs)) {
        results[i] = { status: 'skipped', ms: 0 }
        continue
      }
      const cut = left < timeoutMs
      const r = await checkDestination(urls[i], { ...one, timeoutMs: cut ? left : timeoutMs })
      // A timeout on a shortened check says the budget ran out, not that the
      // host is down: report it as not checked rather than as "No answer".
      results[i] = cut && r.status === 'timeout' ? { status: 'skipped', ms: r.ms } : r
    }
  }
  const workers = Math.max(1, Math.min(Math.floor(concurrency) || 1, urls.length))
  await Promise.all(Array.from({ length: workers }, worker))
  return results
}
