'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { buttonVariants } from '@/components/ui/button-variants'
import { displayUrl } from '@/components/dashboard/displayUrl'
import { cn, formatCount } from '@/lib/utils'
import type { DestinationStatus } from '@/lib/destinationCheck'
import { checkDestinationsNow, type DestinationCheckResult, type DestinationCheckRow } from './actions'

const SHORT_DOMAIN = process.env.NEXT_PUBLIC_SHORT_DOMAIN || 'tws.bio'

const ORDER: DestinationStatus[] = ['broken', 'timeout', 'error', 'redirect', 'blocked', 'ok']

const FLAG: Record<DestinationStatus, string> = {
  broken: 'Broken',
  timeout: 'No answer',
  error: 'Failed',
  redirect: 'Redirects',
  blocked: 'Not checked',
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
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1.5 border-b border-rule py-3 last:border-b-0 md:grid-cols-[104px_minmax(0,14rem)_minmax(0,1fr)_auto]">
      <span className="col-span-2 md:col-span-1">
        <Flag status={row.status} />
      </span>
      <span className="min-w-0 truncate font-mono text-[13.5px] text-ink" title={`${SHORT_DOMAIN}/${row.shortCode}`}>
        {SHORT_DOMAIN}/{row.shortCode}
      </span>
      <span className="col-span-2 row-start-3 min-w-0 text-sm text-text-2 md:col-span-1 md:row-start-auto">
        <span className="block truncate text-ink" title={row.url}>
          {displayUrl(row.url)}
        </span>
        <span className="block">{detail(row)}</span>
      </span>
      <Link
        href={`/dashboard/links/${row.id}`}
        className="focus-ring row-start-2 justify-self-end rounded-[2px] text-sm text-accent-text underline decoration-accent-text/40 decoration-1 underline-offset-[3px] hover:decoration-current md:row-start-auto"
      >
        Edit
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
  const counts = ORDER.map((s) => [s, rows.filter((r) => r.status === s).length] as const).filter(
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
        <p className="text-[13px] text-text-3" aria-live="polite">
          {pending
            ? 'This can take up to a minute.'
            : activeCount === 0
              ? 'No active links to check.'
              : `Opens the destination of each of your ${formatCount(activeCount, 'active link')} once. Runs only when you press it.`}
        </p>
      </div>

      {result && !pending && !result.ok && (
        <p role="status" className="mt-4 text-sm text-neg">
          {result.error}
        </p>
      )}

      {result?.ok && !pending && (
        <div className="mt-5">
          <p role="status" className="text-sm text-text-2">
            Checked {formatCount(rows.length, 'link')} at {TIME.format(new Date(result.checkedAt))}:{' '}
            {counts.map(([s, n]) => `${n} ${s === 'ok' ? 'OK' : FLAG[s].toLowerCase()}`).join(', ')}.
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
                Show the {formatCount(fine.length, 'link')} that answered OK
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
