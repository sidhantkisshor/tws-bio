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

function hostAndPath(url: string): string {
  try {
    const u = new URL(url)
    return `${u.hostname.replace(/^www\./, '')}${u.pathname === '/' ? '' : u.pathname}`
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
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
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

  const search = useCallback(async (q: string) => {
    const id = ++requestRef.current
    if (!q.trim()) {
      setResults([])
      setStatus('idle')
      return
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
      const { data, error } = await applyLinkFilters(base, { q: q.trim().slice(0, 200), type: 'all', status: 'all' })
      if (id !== requestRef.current) return
      if (error) throw error
      setResults((data ?? []) as Result[])
      setActive(0)
      setStatus('done')
    } catch (err) {
      if (id !== requestRef.current) return
      console.error('[FindLink] search failed:', err)
      setResults([])
      setStatus('error')
    }
  }, [])

  // Debounced search as the owner types.
  useEffect(() => {
    const t = setTimeout(() => void search(query), 150)
    return () => clearTimeout(t)
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
    if (!results.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (i - 1 + results.length) % results.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const r = results[active]
      if (!r) return
      if (e.shiftKey) void copyResult(r)
      else openResult(r)
    }
  }

  const showList = open && query.trim().length > 0
  const activeId = showList && results[active] ? `${listId}-opt-${active}` : undefined

  return (
    <div className={cn('relative', className)}>
      <label className="relative block">
        <span className="sr-only">Find a link</span>
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
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
          className="h-9 w-[220px] rounded-ctl border border-edge bg-surface pr-8 pl-3 text-sm text-ink transition-[border-color] duration-150 outline-none placeholder:text-text-3 focus-visible:border-focus focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus [&::-webkit-search-cancel-button]:hidden"
        />
        <kbd
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded-[2px] border border-rule px-1.5 font-mono text-[11px] leading-[18px] text-text-3"
        >
          /
        </kbd>
      </label>

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
                <button
                  type="button"
                  tabIndex={-1}
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
          <span className="sr-only" aria-live="polite">
            {copiedId ? 'Short link copied' : status === 'done' ? `${results.length} results` : ''}
          </span>
        </div>
      )}
    </div>
  )
}
