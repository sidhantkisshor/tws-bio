import { describe, expect, it } from 'vitest'
import {
  direction,
  formatNumber,
  formatShare,
  formatSignedCount,
  formatPeriodChange,
  formatSignedPercent,
  NO_CHANGE,
  sharesToHundred,
} from '../ledgerFormat'

describe('formatSignedCount', () => {
  it('signs a gain and puts a loss in parentheses', () => {
    expect(formatSignedCount(1475)).toBe('+1,475')
    expect(formatSignedCount(-486)).toBe('(486)')
    expect(formatSignedCount(0)).toBe('0')
  })
  it('rounds before choosing the sign', () => {
    expect(formatSignedCount(0.4)).toBe('0')
    expect(formatSignedCount(-1.26, 1)).toBe('(1.3)')
  })
})

describe('formatSignedPercent', () => {
  it('formats a fraction with one decimal', () => {
    expect(formatSignedPercent(0.124)).toBe('+12.4%')
    expect(formatSignedPercent(-0.206)).toBe('(20.6%)')
    expect(formatSignedPercent(0)).toBe('0.0%')
    expect(formatSignedPercent(0.00001)).toBe('0.0%')
  })
  it('takes a digit count', () => {
    expect(formatSignedPercent(0.5, 0)).toBe('+50%')
  })
  it('drops the decimal at or above 100% and groups the digits', () => {
    expect(formatSignedPercent(17.875)).toBe('+1,788%')
    expect(formatSignedPercent(1)).toBe('+100%')
    expect(formatSignedPercent(0.9996)).toBe('+100%')
    expect(formatSignedPercent(0.9994)).toBe('+99.9%')
    expect(formatSignedPercent(-1)).toBe('(100%)')
    expect(formatSignedPercent(123.456, 0)).toBe('+12,346%')
  })
})

describe('formatPeriodChange', () => {
  it('shows "-" when both periods are empty', () => {
    expect(NO_CHANGE).toBe('-')
    expect(formatPeriodChange(0, 0)).toEqual({ text: '-', tone: 'none' })
    expect(formatPeriodChange(0, 0, 'count')).toEqual({ text: '-', tone: 'none' })
  })
  it('gives a percent by default', () => {
    expect(formatPeriodChange(151, 8)).toEqual({ text: '+1,788%', tone: 'up' })
    expect(formatPeriodChange(80, 100)).toEqual({ text: '(20.0%)', tone: 'down' })
    expect(formatPeriodChange(10, 10)).toEqual({ text: '0.0%', tone: 'flat' })
    expect(formatPeriodChange(5, 0)).toEqual({ text: 'New', tone: 'new' })
    expect(formatPeriodChange(0, 5)).toEqual({ text: '(100%)', tone: 'down' })
  })
  it('gives a count when asked', () => {
    expect(formatPeriodChange(1500, 25, 'count')).toEqual({ text: '+1,475', tone: 'up' })
    expect(formatPeriodChange(14, 500, 'count')).toEqual({ text: '(486)', tone: 'down' })
    expect(formatPeriodChange(5, 0, 'count')).toEqual({ text: '+5', tone: 'up' })
    expect(formatPeriodChange(7, 7, 'count')).toEqual({ text: '0', tone: 'flat' })
  })
})

describe('formatNumber, formatShare, direction', () => {
  it('groups with en-US separators', () => {
    expect(formatNumber(15184)).toBe('15,184')
    expect(formatShare(0.463)).toBe('46.3%')
  })
  it('reads the direction', () => {
    expect(direction(3)).toBe('up')
    expect(direction(-1)).toBe('down')
    expect(direction(0)).toBe('flat')
  })
})

describe('sharesToHundred', () => {
  it('adds up to exactly 100.0', () => {
    const shares = sharesToHundred([11481, 9675, 2335, 640, 339, 154, 125, 48])
    const sum = Math.round(shares.reduce((s, v) => s + v, 0) * 1000)
    expect(sum).toBe(1000)
    expect(shares[0]).toBeCloseTo(0.463, 3)
  })
  it('handles a third each', () => {
    const shares = sharesToHundred([1, 1, 1])
    expect(shares.map((s) => Math.round(s * 1000))).toEqual([334, 333, 333])
  })
  it('returns zeros for an empty total', () => {
    expect(sharesToHundred([0, 0])).toEqual([0, 0])
    expect(sharesToHundred([])).toEqual([])
  })
})
