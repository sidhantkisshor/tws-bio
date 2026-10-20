import { describe, expect, it } from 'vitest'
import {
  effectiveSelection,
  formatChange,
  isResourceDropRow,
  rowIssue,
  selectableLinkIds,
} from '@/lib/linkRows'

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

describe('formatChange', () => {
  it('signs a gain and puts a loss in parentheses', () => {
    expect(formatChange(3321, 1846)).toEqual({ text: '+79.9%', tone: 'up' })
    expect(formatChange(1214, 1529)).toEqual({ text: '(20.6%)', tone: 'down' })
  })

  it('says New when the prior window had no clicks', () => {
    expect(formatChange(796, 0)).toEqual({ text: 'New', tone: 'new' })
  })

  it('reads - when both windows are empty and 0.0% for no change', () => {
    expect(formatChange(0, 0)).toEqual({ text: '-', tone: 'none' })
    expect(formatChange(50, 50)).toEqual({ text: '0.0%', tone: 'flat' })
  })

  it('drops the decimal at 100% or more, and groups digits', () => {
    expect(formatChange(0, 12)).toEqual({ text: '(100%)', tone: 'down' })
    expect(formatChange(151, 8)).toEqual({ text: '+1,788%', tone: 'up' })
    expect(formatChange(244, 82)).toEqual({ text: '+198%', tone: 'up' })
    // 99.96% rounds to 100.0 at one decimal, so it is set as 100%.
    expect(formatChange(49_998, 25_000)).toEqual({ text: '+100%', tone: 'up' })
    expect(formatChange(1999, 1000)).toEqual({ text: '+99.9%', tone: 'up' })
  })
})

describe('rowIssue', () => {
  it('shows nothing for no issues, or only paused and quiet', () => {
    expect(rowIssue([])).toBeNull()
    expect(
      rowIssue([
        { kind: 'inactive', severity: 'low', message: 'off' },
        { kind: 'quiet', severity: 'low', message: 'quiet' },
      ])
    ).toBeNull()
  })

  it('picks the most severe issue, red for high', () => {
    expect(
      rowIssue([
        { kind: 'expiring_soon', severity: 'medium', message: 'This link expires in 2 days.' },
        { kind: 'at_cap', severity: 'high', message: 'The click limit (100) is reached.' },
      ])
    ).toEqual({ label: 'Click limit reached', message: 'The click limit (100) is reached.', tone: 'neg' })
  })

  it('keeps a medium issue neutral', () => {
    expect(
      rowIssue([{ kind: 'expiring_soon', severity: 'medium', message: 'This link expires in 2 days.' }])
    ).toEqual({ label: 'Expires soon', message: 'This link expires in 2 days.', tone: 'neutral' })
  })

  it('names a self loop apart from a link to another short link', () => {
    expect(rowIssue([{ kind: 'loop', severity: 'high', message: 'x' }])?.label).toBe('Points at itself')
    expect(rowIssue([{ kind: 'loop', severity: 'medium', message: 'x' }])?.label).toBe('Points at tws.bio')
  })
})
