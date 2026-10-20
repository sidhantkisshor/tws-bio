'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { applyLinkFilters } from '@/lib/linkFilters'
import { getShortUrl, cn } from '@/lib/utils'

// "Find a link" in the dashboard masthead. Press "/" anywhere (outside a
// field) to focus it. It searches the owner's links by short code and
// destination (RLS keeps it to the owner), up to 8 results. Arrow keys move,
// Enter opens the link's page, Shift+Enter copies its short URL. The browser
// Supabase client loads on first use, and only in the dashboard, so anonymous
// visitors never download it.

const SHORT_DOMAIN = process.env.NEXT_PUBLIC_SHORT_DOMAIN || 'tws.bio'
const MAX_RESULTS = 8

interface Result {
  id: string
  short_code: string
  original_url: string
}

const MAX_QUERY_CHARS = 32

/**
 * Host, path and query, with no protocol or "www.". The query is kept (cut to
 * 32 characters) so two links to the same page with different params look
 * different; the row's CSS truncation handles the rest.
 */
function hostAndPath(url: string): string {
  try {
    const u = new URL(url)
    const query =
      u.search.length > MAX_QUERY_CHARS + 1 ? `${u.search.slice(0, MAX_QUERY_CHARS + 1)}…` : u.search
    return `${u.hostname.replace(/^www\./, '')}${u.pathname === '/' ? '' : u.pathname}${query}`
  } catch {
    return url
  }
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

export function FindLink({ className }: { className?: string }) {
  const router = useRouter()
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const requestRef = useRef(0)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  // The trimmed query `results` answer. While a newer query is still in its
  // debounce or on the wire, the list on screen belongs to an older one.
  const [resultsFor, setResultsFor] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'done'>('idle')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // "/" focuses the search from anywhere that is not a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(e.target)) return
      const input = inputRef.current
      if (!input || input.offsetParent === null) return
      e.preventDefault()
      input.focus()
      input.select()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current)
  }, [])

  /** Runs a search; returns its rows, or null when it failed or a newer one replaced it. */
  const search = useCallback(async (q: string): Promise<Result[] | null> => {
    const id = ++requestRef.current
    const trimmed = q.trim()
    if (!trimmed) {
      setResults([])
      setResultsFor('')
      setStatus('idle')
      return []
    }
    setStatus('loading')
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const base = supabase
        .from('links')
        .select('id, short_code, original_url')
        .order('total_clicks', { ascending: false })
        .limit(MAX_RESULTS)
      const { data, error } = await applyLinkFilters(base, { q: trimmed.slice(0, 200), type: 'all', status: 'all' })
      if (id !== requestRef.current) return null
      if (error) throw error
      const rows = (data ?? []) as Result[]
      setResults(rows)
      setResultsFor(trimmed)
      setActive(0)
      setStatus('done')
      return rows
    } catch (err) {
      if (id !== requestRef.current) return null
      console.error('[FindLink] search failed:', err)
      setResults([])
      setResultsFor('')
      setStatus('error')
      return null
    }
  }, [])

  // Debounced search as the owner types.
  useEffect(() => {
    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null
      void search(query)
    }, 150)
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      debounceTimer.current = null
    }
  }, [query, search])

  const openResult = (r: Result) => {
    setOpen(false)
    setQuery('')
    inputRef.current?.blur()
    router.push(`/dashboard/links/${r.id}`)
  }

  const copyResult = async (r: Result) => {
    try {
      await navigator.clipboard.writeText(getShortUrl(r.short_code))
      setCopiedId(r.id)
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopiedId(null), 1600)
    } catch {
      setCopiedId(null)
    }
  }

  const act = (r: Result, copy: boolean) => {
    if (copy) void copyResult(r)
    else openResult(r)
  }

  const showList = open && query.trim().length > 0

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (open && query) {
        setQuery('')
      } else {
        inputRef.current?.blur()
      }
      setOpen(false)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      // Enter acts only on the list on screen, and only on the answer to the
      // text in the box: never on the hits of an older query.
      if (!showList) return
      const copy = e.shiftKey
      const q = query.trim()
      if (status === 'done' && resultsFor === q) {
        const r = results[active]
        if (r) act(r, copy)
        return
      }
      // Still debouncing or loading: search now and act on the top hit.
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      debounceTimer.current = null
      void search(query).then((rows) => {
        // Skip it if the owner typed on while it ran.
        if (rows?.[0] && inputRef.current?.value.trim() === q) act(rows[0], copy)
      })
      return
    }
    if (!results.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (i - 1 + results.length) % results.length)
    }
  }
  const activeId = showList && results[active] ? `${listId}-opt-${active}` : undefined
  // Announced politely: the result count once a search lands, or the copy.
  const announcement = copiedId
    ? 'Short link copied'
    : !showList
      ? ''
      : status === 'error'
        ? 'Search failed'
        : status === 'done'
          ? results.length === 0
            ? 'No links match'
            : `${results.length} ${results.length === 1 ? 'result' : 'results'}`
          : ''

  return (
    <div className={cn('relative', className)}>
      <label className="relative block">
        <span className="sr-only">Find a link</span>
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={showList ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-describedby={`${listId}-help`}
          autoComplete="off"
          spellCheck={false}
          placeholder="Find a link"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className="peer h-9 w-[220px] rounded-ctl border border-edge bg-surface pr-8 pl-3 text-sm text-ink transition-[border-color] duration-150 outline-none placeholder:text-text-3 focus-visible:border-focus focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-focus [&::-webkit-search-cancel-button]:hidden"
        />
        {/* The "/" hint goes away once the field has focus or text. */}
        <kbd
          aria-hidden
          className="pointer-events-none absolute peer-focus:hidden peer-[:not(:placeholder-shown)]:hidden top-1/2 right-2 -translate-y-1/2 rounded-[2px] border border-rule px-1.5 font-mono text-[11px] leading-[18px] text-text-3"
        >
          /
        </kbd>
      </label>
      <span id={`${listId}-help`} className="sr-only">
        Enter opens a link. Shift+Enter copies it.
      </span>
      {/* Always mounted, so the first result count is announced too. */}
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>

      {showList && (
        <div
          // Keep focus in the input while clicking inside the list.
          onMouseDown={(e) => e.preventDefault()}
          className="absolute top-[calc(100%+6px)] right-0 z-50 w-[360px] max-w-[calc(100vw-2rem)] rounded-ctl border border-edge bg-surface p-1 shadow-overlay"
        >
          {status === 'loading' && results.length === 0 && (
            <p className="px-2.5 py-2 text-[13px] text-text-3">Searching</p>
          )}
          {status === 'error' && (
            <p className="px-2.5 py-2 text-[13px] text-neg">Search failed. Try again.</p>
          )}
          {status === 'done' && results.length === 0 && (
            <p className="px-2.5 py-2 text-[13px] text-text-2">No links match.</p>
          )}
          <ul id={listId} role="listbox" aria-label="Links" className={cn(results.length === 0 && 'hidden')}>
            {results.map((r, i) => (
              <li
                key={r.id}
                role="presentation"
                className={cn(
                  'flex items-center gap-2 rounded-[2px] pr-1 transition-colors duration-[120ms]',
                  i === active && 'bg-hover',
                )}
                onMouseEnter={() => setActive(i)}
              >
                <div
                  id={`${listId}-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onClick={() => openResult(r)}
                  className="min-w-0 flex-1 cursor-pointer px-2.5 py-2"
                >
                  <span className="block truncate font-mono text-[13.5px] text-ink">
                    {SHORT_DOMAIN}/{r.short_code}
                  </span>
                  <span className="block truncate text-xs text-text-3" title={r.original_url}>
                    {hostAndPath(r.original_url)}
                  </span>
                </div>
                {/* A listbox may only hold options, so this mouse shortcut is
                    hidden from screen readers; Shift+Enter is the keyboard way. */}
                <button
                  type="button"
                  tabIndex={-1}
                  aria-hidden
                  onClick={() => void copyResult(r)}
                  className="h-8 shrink-0 rounded-ctl px-2 text-[13px] font-medium text-text-2 transition-colors duration-150 hover:bg-page hover:text-ink"
                >
                  {copiedId === r.id ? 'Copied' : 'Copy'}
                </button>
              </li>
            ))}
          </ul>
          {results.length > 0 && (
            <p className="border-t border-rule px-2.5 pt-1.5 pb-1 text-[11.5px] text-text-3">
              Enter opens. Shift+Enter copies.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
