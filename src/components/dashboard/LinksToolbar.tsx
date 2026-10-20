'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { chip, chipCount } from '@/components/ui/segmented'
import { parseKind, type ChipCounts } from '@/lib/linkFilters'
import { cn } from '@/lib/utils'

// "Most clicks" orders by the all-time total, while the Clicks column shows
// the last 30 days, so the labels say which one they sort by.
const SORT_OPTIONS = [
  { value: 'created_desc', label: 'Newest first' },
  { value: 'created_asc', label: 'Oldest first' },
  { value: 'clicks_desc', label: 'Most clicks, all time' },
  { value: 'clicks_asc', label: 'Fewest clicks, all time' },
]

// The view chips. One at a time: each sets its own param and clears the
// others. `type` and `status` are the params the page has always read, so old
// bookmarks (?status=inactive, ?type=deep_link) keep working.
type ViewChip = {
  key: string
  label: string
  param: 'status' | 'type' | 'show' | null
  value: string | null
  count: (c: ChipCounts) => number
  /** Hidden when its count is 0, unless it is the selected one. */
  hideWhenEmpty?: boolean
}

const VIEW_CHIPS: ViewChip[] = [
  { key: 'all', label: 'All', param: null, value: null, count: (c) => c.all },
  { key: 'live', label: 'Live', param: 'status', value: 'active', count: (c) => c.live },
  { key: 'paused', label: 'Paused', param: 'status', value: 'inactive', count: (c) => c.paused, hideWhenEmpty: true },
  { key: 'app', label: 'App links', param: 'type', value: 'deep_link', count: (c) => c.app, hideWhenEmpty: true },
  { key: 'drops', label: 'Resource drops', param: 'show', value: 'drops', count: (c) => c.drops, hideWhenEmpty: true },
  { key: 'expiring', label: 'Expiring', param: 'show', value: 'expiring', count: (c) => c.expiring, hideWhenEmpty: true },
  { key: 'attention', label: 'Needs a look', param: 'show', value: 'attention', count: (c) => c.attention, hideWhenEmpty: true },
]

const VIEW_PARAMS = ['status', 'type', 'show'] as const

const CLEAR_CLASS =
  'focus-ring h-11 shrink-0 items-center rounded-ctl px-2.5 text-[13px] font-medium text-accent-text underline decoration-accent-text/40 underline-offset-[3px] transition-colors duration-150 hover:decoration-current disabled:pointer-events-none md:h-8'

// Search, filter chips and sort for the Links ledger, driven entirely by URL
// search params so the server-rendered page.tsx query stays the single source
// of truth. Counts come from the server (they follow the search, not the
// chips), so this island never loads supabase-js.
export function LinksToolbar({ counts }: { counts: ChipCounts }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const urlQuery = searchParams.get('q') || ''
  const [search, setSearch] = useState(urlQuery)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  // The q this toolbar last pushed. The page is not remounted when its search
  // params change, so `search` would keep stale text after Back, the empty
  // state's "Clear the search" link or the masthead's Links tab. A q that
  // differs from this one came from outside and replaces the box; our own
  // pushes do not, so text typed while a search loads is never overwritten.
  const lastPushedQuery = useRef(urlQuery)

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  useEffect(() => {
    if (urlQuery === lastPushedQuery.current) return
    lastPushedQuery.current = urlQuery
    // A search still waiting on its debounce would push the old text back.
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSearch(urlQuery)
  }, [urlQuery])

  function pushParams(next: URLSearchParams) {
    next.delete('page')
    const qs = next.toString()
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    })
  }

  function selectView(view: ViewChip) {
    const params = new URLSearchParams(searchParams.toString())
    for (const key of VIEW_PARAMS) params.delete(key)
    if (view.param && view.value) params.set(view.param, view.value)
    pushParams(params)
  }

  function toggleKind(slug: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (params.get('kind') === slug) params.delete('kind')
    else params.set('kind', slug)
    pushParams(params)
  }

  function setSort(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'created_desc') params.delete('sort')
    else params.set('sort', value)
    pushParams(params)
  }

  function handleSearchChange(value: string) {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      // The URL as it is now, not as it was at the keystroke: a chip or sort
      // picked during the debounce must survive this push.
      const params = new URLSearchParams(window.location.search)
      const trimmed = value.trim()
      if (trimmed) {
        params.set('q', trimmed)
      } else {
        params.delete('q')
      }
      // Trimmed, like the URL value, so a trailing space being typed is not
      // read as an outside change.
      lastPushedQuery.current = trimmed
      pushParams(params)
    }, 350)
  }

  function clearAll() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    lastPushedQuery.current = ''
    setSearch('')
    startTransition(() => router.push(pathname, { scroll: false }))
  }

  const isViewOn = (view: ViewChip) =>
    view.param === null
      ? VIEW_PARAMS.every((key) => !searchParams.get(key))
      : searchParams.get(view.param) === view.value
  const currentKind = searchParams.get('kind')
  const currentSort = searchParams.get('sort') || 'created_desc'
  const hasFilters = Boolean(
    searchParams.get('q') ||
      VIEW_PARAMS.some((key) => searchParams.get(key)) ||
      currentKind ||
      currentSort !== 'created_desc'
  )

  // Phones: the chip row scrolls sideways and starts at its left end after
  // every navigation, which can leave the selected chip off screen, so the
  // filter looks like links vanished. Bring the selected chip into view (the
  // kind chip when one is set). Skipped when the row does not overflow (md
  // and up, where the chips wrap).
  const paramsKey = searchParams.toString()
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth) return
    const pressed = scroller.querySelectorAll<HTMLElement>('[aria-pressed="true"]')
    const target = pressed[pressed.length - 1]
    if (!target) return
    const gutter = 16
    const left = target.offsetLeft - gutter
    const right = target.offsetLeft + target.offsetWidth + gutter
    if (left < scroller.scrollLeft) scroller.scrollLeft = left
    else if (right > scroller.scrollLeft + scroller.clientWidth) {
      scroller.scrollLeft = right - scroller.clientWidth
    }
  }, [paramsKey])

  const views = VIEW_CHIPS.filter((v) => !v.hideWhenEmpty || v.count(counts) > 0 || isViewOn(v))
  // A selected kind stays on screen at 0 (a search can leave none of it), so
  // it can always be clicked off.
  const selectedKind = parseKind(currentKind)
  const kinds =
    selectedKind && currentKind && !counts.kinds.some((k) => k.slug === currentKind)
      ? [...counts.kinds, { kind: selectedKind, slug: currentKind, count: 0 }]
      : counts.kinds

  return (
    <div className="rule-open pt-4 pb-4 md:pb-5">
      {/* Announces loading to screen readers without a layout shift. The
          dimmed chips and the "Updating" note cover sighted users. */}
      <span className="sr-only" role="status" aria-live="polite">
        {isPending ? 'Updating links' : ''}
      </span>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative min-w-0 flex-1">
          <Input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search codes, destinations, campaigns"
            className={cn(isPending && 'pr-24')}
            aria-label="Search links by code, destination or campaign"
            aria-busy={isPending}
            type="search"
            enterKeyHint="search"
          />
          {isPending && (
            <span
              aria-hidden
              className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[13px] text-text-3"
            >
              Updating
            </span>
          )}
        </div>

        <Select value={currentSort} onValueChange={(v) => v && setSort(v)}>
          <SelectTrigger className="w-full md:w-[200px]" aria-label="Sort links">
            <SelectValue options={SORT_OPTIONS} />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Phones: one row that scrolls sideways inside itself, bled to the
          screen edge. From md up the chips wrap. */}
      <div
        ref={scrollerRef}
        className={cn(
          'scrollbar-none relative -mx-4 mt-3 flex items-center gap-1 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:overflow-visible md:px-0',
          isPending && 'opacity-60'
        )}
      >
        <div role="group" aria-label="Show" className="flex shrink-0 items-center gap-1 md:flex-wrap">
          {views.map((view) => {
            const on = isViewOn(view)
            return (
              <button
                key={view.key}
                type="button"
                aria-pressed={on}
                onClick={() => selectView(view)}
                className={chip(on)}
              >
                {view.label}
                <span className={chipCount(on)}>{view.count(counts).toLocaleString('en-US')}</span>
              </button>
            )
          })}
        </div>

        {kinds.length > 0 && (
          <>
            <span aria-hidden className="mx-2 h-5 w-px shrink-0 bg-rule" />
            <div
              role="group"
              aria-label="Destination kind"
              className="flex shrink-0 items-center gap-1 md:flex-wrap"
            >
              {kinds.map((k) => {
                const on = currentKind === k.slug
                return (
                  <button
                    key={k.slug}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleKind(k.slug)}
                    className={chip(on)}
                  >
                    {k.kind}
                    <span className={chipCount(on)}>{k.count.toLocaleString('en-US')}</span>
                  </button>
                )
              })}
            </div>
          </>
        )}

        {hasFilters && (
          <button
            type="button"
            onClick={clearAll}
            disabled={isPending}
            className={cn(CLEAR_CLASS, 'ml-1 hidden md:inline-flex')}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Phones: on its own line under the chip row, so it is never scrolled
          out of sight with the chips. */}
      {hasFilters && (
        <button
          type="button"
          onClick={clearAll}
          disabled={isPending}
          className={cn(CLEAR_CLASS, '-ml-2.5 mt-1 inline-flex md:hidden')}
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
