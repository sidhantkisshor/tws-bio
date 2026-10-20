import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { fromDateTimeLocalValue, toDateTimeLocalValue } from '@/lib/datetime'

describe('datetime-local conversion for a viewer in India (UTC+5:30)', () => {
  const originalTz = process.env.TZ

  beforeAll(() => {
    process.env.TZ = 'Asia/Kolkata'
  })

  afterAll(() => {
    process.env.TZ = originalTz
  })

  it('saves the wall-clock time the viewer picked as the right instant', () => {
    expect(fromDateTimeLocalValue('2026-10-20T18:00')).toBe('2026-10-20T12:30:00.000Z')
  })

  it('shows a stored instant in the viewer\'s wall-clock time', () => {
    expect(toDateTimeLocalValue('2026-10-20T12:30:00+00:00')).toBe('2026-10-20T18:00')
  })

  it('round-trips without drifting', () => {
    const picked = '2026-12-31T23:45'
    expect(toDateTimeLocalValue(fromDateTimeLocalValue(picked))).toBe(picked)
  })

  it('treats empty and invalid values as no expiry', () => {
    expect(fromDateTimeLocalValue('')).toBeNull()
    expect(fromDateTimeLocalValue('not a date')).toBeNull()
    expect(toDateTimeLocalValue(null)).toBe('')
    expect(toDateTimeLocalValue(undefined)).toBe('')
    expect(toDateTimeLocalValue('garbage')).toBe('')
  })
})
