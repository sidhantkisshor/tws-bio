'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { buttonVariants } from '@/components/ui/button-variants'
import { displayUrl } from '@/components/dashboard/displayUrl'
import { fixLinkClass } from './styles'
import { cn, formatCount } from '@/lib/utils'
import type { DestinationStatus } from '@/lib/destinationCheck'
import { checkDestinationsNow, type DestinationCheckResult, type DestinationCheckRow } from './actions'

const SHORT_DOMAIN = process.env.NEXT_PUBLIC_SHORT_DOMAIN || 'tws.bio'

const ORDER: DestinationStatus[] = ['broken', 'timeout', 'error', 'redirect', 'blocked', 'skipped', 'ok']

const FLAG: Record<DestinationStatus, string> = {
  broken: 'Broken',
  timeout: 'No answer',
  error: 'Failed',
  redirect: 'Redirects',
  blocked: 'Not checked',
  skipped: 'Skipped',
  ok: 'OK',
}

const HTTP_WORDS: Record<number, string> = {
  200: 'OK',
  201: 'created',
  204: 'no content',
  400: 'bad request',
  401: 'needs a sign-in',
  402: 'payment required',
  403: 'access denied',
  404: 'page not found',
  405: 'method not allowed',
  408: 'request timed out',
  410: 'page removed',
  429: 'too many requests',
  451: 'blocked for legal reasons',
  500: 'server error',
  502: 'bad gateway',
  503: 'service unavailable',
  504: 'gateway timed out',
}

/** 404 gives "404, page not found". */
export function httpInWords(code: number): string {
  const words =
    HTTP_WORDS[code] ??
    (code >= 500 ? 'server error' : code >= 400 ? 'request refused' : code >= 300 ? 'redirect' : 'OK')
  return `${code}, ${words}`
}

function detail(row: DestinationCheckRow): string {
  switch (row.status) {
    case 'broken':
      return row.httpStatus ? `Returned ${httpInWords(row.httpStatus)}.` : 'Returned an error.'
    case 'timeout':
      return 'No answer within 5 seconds.'
    case 'error':
      return row.httpStatus
        ? `Answered ${row.httpStatus}, then redirected too many times or without saying where to.`
        : 'Could not reach it: the address did not answer or is not a web page.'
    case 'redirect':
      return row.finalUrl ? `Ends at ${displayUrl(row.finalUrl)}.` : 'Redirects, then loads.'
    case 'blocked':
      return 'Points at tws.bio or a private address, so it was not called.'
    case 'skipped':
      return 'Not checked: the check ran out of time first. Run it again to check it.'
    case 'ok':
      return row.httpStatus ? `Answered ${httpInWords(row.httpStatus)}.` : 'Answered.'
  }
}

const isProblem = (s: DestinationStatus) => s === 'broken' || s === 'timeout' || s === 'error'

const TIME = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Kolkata',
  hour: 'numeric',
  minute: '2-digit',
})

function Flag({ status }: { status: DestinationStatus }) {
  return (
    <span
      className={cn(
        'inline-block min-w-[5.5rem] rounded-[2px] border px-1.5 text-center text-[11px] leading-5 font-bold tracking-[0.06em] whitespace-nowrap uppercase',
        isProblem(status)
          ? 'border-neg text-neg'
          : status === 'ok'
            ? 'border-pos text-pos'
            : 'border-edge text-text-2',
      )}
    >
      {FLAG[status]}
    </span>
  )
}

function Row({ row }: { row: DestinationCheckRow }) {
  // Phones: the flag alone, then the short code with Open at the right, then
  // the destination. From md up: one line, four columns.
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1.5 border-b border-rule py-3 last:border-b-0 md:grid-cols-[104px_minmax(0,14rem)_minmax(0,1fr)_auto]">
      <span className="col-span-2 md:col-span-1">
        <Flag status={row.status} />
      </span>
      <span
        className="col-start-1 row-start-2 min-w-0 truncate font-mono text-[13.5px] text-ink md:col-start-auto md:row-start-auto"
        title={`${SHORT_DOMAIN}/${row.shortCode}`}
      >
        {SHORT_DOMAIN}/{row.shortCode}
      </span>
      <span className="col-span-2 row-start-3 min-w-0 text-sm text-text-2 md:col-span-1 md:row-start-auto">
        <span className="block truncate text-ink" title={row.url}>
          {displayUrl(row.url)}
        </span>
        <span className="block">{detail(row)}</span>
      </span>
      {/* Nothing opens the Edit dialog from a URL, so this opens the link's
          page, where Edit is. */}
      <Link
        href={`/dashboard/links/${row.id}`}
        className={cn(fixLinkClass, 'col-start-2 row-start-2 justify-self-end md:col-start-auto md:row-start-auto')}
      >
        Open
        <span className="sr-only">
          {' '}
          {SHORT_DOMAIN}/{row.shortCode}
        </span>
      </Link>
    </li>
  )
}

/**
 * The "Check destinations now" action and its results: broken first, then no
 * answer, failed, redirects, not checked, and OK last (folded away). Each
 * status is a word, and a broken page gives its HTTP status in words.
 */
export function DestinationCheck({ activeCount }: { activeCount: number }) {
  const [result, setResult] = useState<DestinationCheckResult | null>(null)
  const [pending, startTransition] = useTransition()

  function run() {
    startTransition(async () => {
      try {
        setResult(await checkDestinationsNow())
      } catch {
        setResult({ ok: false, error: 'The check could not finish. Try again in a minute.' })
      }
    })
  }

  const rows = result?.ok
    ? [...result.rows].sort(
        (a, b) =>
          ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || a.shortCode.localeCompare(b.shortCode),
      )
    : []
  const shown = rows.filter((r) => r.status !== 'ok')
  const fine = rows.filter((r) => r.status === 'ok')
  const skipped = rows.filter((r) => r.status === 'skipped').length
  const counts = ORDER.filter((s) => s !== 'skipped').map((s) => [s, rows.filter((r) => r.status === s).length] as const).filter(
    ([, n]) => n > 0,
  )

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <button
          type="button"
          onClick={run}
          disabled={pending || activeCount === 0}
          className={cn(buttonVariants({ variant: 'outline' }), 'w-full sm:w-auto')}
        >
          {pending ? `Checking ${formatCount(activeCount, 'link')}...` : 'Check destinations now'}
        </button>
        <p className="text-[13px] text-text-3">
          {pending
            ? 'This can take up to a minute.'
            : activeCount === 0
              ? 'No active links to check.'
              : `Opens the destination of each of your ${formatCount(activeCount, 'active link')} once. Runs only when you press it.`}
        </p>
      </div>

      {/* Always mounted, so the start and the end of a check are announced. */}
      <span className="sr-only" role="status">
        {pending
          ? 'Checking destinations. This can take up to a minute.'
          : result && !result.ok
            ? result.error
            : result?.ok
              ? `Check finished. ${formatCount(rows.length - skipped, 'link')} checked${
                  counts.length > 0 ? `: ${counts.map(([s, n]) => `${n} ${s === 'ok' ? 'OK' : FLAG[s].toLowerCase()}`).join(', ')}` : ''
                }.`
              : ''}
      </span>

      {result && !pending && !result.ok && (
        <p className="mt-4 text-sm text-neg">
          {result.error}
        </p>
      )}

      {result?.ok && !pending && (
        <div className="mt-5">
          <p className="text-sm text-text-2">
            Checked {formatCount(rows.length - skipped, 'link')} at {TIME.format(new Date(result.checkedAt))}
            {counts.length > 0 && ': '}
            {counts.map(([s, n]) => `${n} ${s === 'ok' ? 'OK' : FLAG[s].toLowerCase()}`).join(', ')}.
            {skipped > 0 &&
              ` Ran out of time before the other ${formatCount(skipped, 'link')}: run the check again to reach them.`}
          </p>
          {shown.length > 0 && (
            <ul className="mt-3 border-t border-ink-2" aria-label="Destinations that need a look">
              {shown.map((r) => (
                <Row key={r.id} row={r} />
              ))}
            </ul>
          )}
          {fine.length > 0 && (
            <details className="group mt-3">
              <summary className="focus-ring inline-flex min-h-11 cursor-pointer items-center rounded-[2px] text-sm text-accent-text underline decoration-accent-text/40 decoration-1 underline-offset-[3px] sm:min-h-8">
                <span>
                  <span className="group-open:hidden">Show</span>
                  <span className="hidden group-open:inline">Hide</span> the{' '}
                  {formatCount(fine.length, 'link')} that answered OK
                </span>
              </summary>
              <ul className="mt-2 border-t border-rule">
                {fine.map((r) => (
                  <Row key={r.id} row={r} />
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
