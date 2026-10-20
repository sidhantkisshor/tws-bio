import { describe, expect, it } from 'vitest'
import { effectiveSelection, isResourceDropRow, selectableLinkIds } from '@/lib/linkRows'

describe('isResourceDropRow', () => {
  it('marks r/{slug} rows only', () => {
    expect(isResourceDropRow('r/options-basics')).toBe(true)
    expect(isResourceDropRow('r/a')).toBe(true)
    expect(isResourceDropRow('abc123')).toBe(false)
    expect(isResourceDropRow('r')).toBe(false)
    expect(isResourceDropRow('rr-video')).toBe(false)
    expect(isResourceDropRow('R-promo')).toBe(false)
  })
})

describe('bulk selection', () => {
  const page = [
    { id: 'a', short_code: 'abc123' },
    { id: 'drop', short_code: 'r/options-basics' },
    { id: 'b', short_code: 'webinar' },
  ]

  it('leaves Resource Drop rows out of what can be selected', () => {
    expect(selectableLinkIds(page)).toEqual(['a', 'b'])
  })

  it('acts only on selected rows that are on screen', () => {
    // 'old' was selected on another page and is no longer visible.
    const selected = new Set(['old', 'b', 'a'])
    expect(effectiveSelection(selected, selectableLinkIds(page))).toEqual(['a', 'b'])
  })

  it('never includes a Resource Drop row, even when its id is in the set', () => {
    expect(effectiveSelection(new Set(['drop']), selectableLinkIds(page))).toEqual([])
  })

  it('is empty when nothing on screen is selected', () => {
    expect(effectiveSelection(new Set(['x', 'y']), selectableLinkIds(page))).toEqual([])
    expect(effectiveSelection(new Set(), [])).toEqual([])
  })
})
