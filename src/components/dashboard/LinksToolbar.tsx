'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'url', label: 'URL' },
  { value: 'deep_link', label: 'Deep Link' },
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

const SORT_OPTIONS = [
  { value: 'created_desc', label: 'Newest first' },
  { value: 'created_asc', label: 'Oldest first' },
  { value: 'clicks_desc', label: 'Most clicks' },
  { value: 'clicks_asc', label: 'Fewest clicks' },
]

// Search + type/status filter + sort for the Links table, driven entirely by
// URL search params so the server-rendered page.tsx query stays the single
// source of truth (finding: links-search-filter-sort-bulk). Kept as its own
// small client island rather than converting the data-fetching page itself.
export function LinksToolbar() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const [search, setSearch] = useState(searchParams.get('q') || '')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  function pushParams(next: URLSearchParams) {
    next.delete('page')
    const qs = next.toString()
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname)
    })
  }

  function updateParam(key: string, value: string, defaultValue = 'all') {
    const params = new URLSearchParams(searchParams.toString())
    if (!value || value === defaultValue) {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    pushParams(params)
  }

  function handleSearchChange(value: string) {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      const trimmed = value.trim()
      if (trimmed) {
        params.set('q', trimmed)
      } else {
        params.delete('q')
      }
      pushParams(params)
    }, 350)
  }

  const currentType = searchParams.get('type') || 'all'
  const currentStatus = searchParams.get('status') || 'all'
  const currentSort = searchParams.get('sort') || 'created_desc'
  const hasFilters = Boolean(searchParams.get('q') || currentType !== 'all' || currentStatus !== 'all' || currentSort !== 'created_desc')

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
      <div className="relative flex-1 min-w-0 sm:max-w-xs">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search short code or URL…"
          className="pl-8"
          aria-label="Search links"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={currentType} onValueChange={(v) => v && updateParam('type', v)}>
          <SelectTrigger size="sm" className="w-[130px]" aria-label="Filter by type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={currentStatus} onValueChange={(v) => v && updateParam('status', v)}>
          <SelectTrigger size="sm" className="w-[130px]" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={currentSort} onValueChange={(v) => v && updateParam('sort', v, 'created_desc')}>
          <SelectTrigger size="sm" className="w-[150px]" aria-label="Sort links">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch('')
              startTransition(() => router.push(pathname))
            }}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-3.5" />
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
