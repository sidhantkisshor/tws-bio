import { describe, it, expect } from 'vitest'
import { clientIp, shouldRecordClick } from '../clickContext'

const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36'
const CUBOT =
  'Mozilla/5.0 (Linux; Android 11; CUBOT KINGKONG 5 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36'

describe('shouldRecordClick', () => {
  it('records a GET from a real browser', () => {
    expect(shouldRecordClick('GET', CHROME_ANDROID)).toBe(true)
  })

  it('does not record HEAD, which Next.js answers by running the GET handler', () => {
    expect(shouldRecordClick('HEAD', CHROME_ANDROID)).toBe(false)
  })

  it('does not record any other method', () => {
    for (const method of ['POST', 'OPTIONS', 'PUT']) {
      expect(shouldRecordClick(method, CHROME_ANDROID), method).toBe(false)
    }
  })

  it('does not record link previews and crawlers, even on GET', () => {
    expect(shouldRecordClick('GET', 'WhatsApp/2.23.20.0 A')).toBe(false)
    expect(shouldRecordClick('GET', 'TelegramBot (like TwitterBot)')).toBe(false)
    expect(shouldRecordClick('GET', 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)')).toBe(false)
    expect(shouldRecordClick('GET', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(false)
  })

  it('does not record a request with no user agent, since no real browser sends one', () => {
    expect(shouldRecordClick('GET', '')).toBe(false)
  })

  it('records a CUBOT phone, a real visitor whose brand name contains "bot"', () => {
    expect(shouldRecordClick('GET', CUBOT)).toBe(true)
  })
})

describe('clientIp', () => {
  const headers = (init: Record<string, string>) => new Headers(init)

  it('prefers x-real-ip over x-forwarded-for', () => {
    expect(clientIp(headers({ 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '198.51.100.1' }))).toBe('203.0.113.7')
  })

  it('takes the first x-forwarded-for entry when x-real-ip is absent', () => {
    expect(clientIp(headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7')
  })

  it('never takes the last x-forwarded-for entry, which is the nearest proxy, not the visitor', () => {
    const ip = clientIp(headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1, 198.51.100.9' }))
    expect(ip).toBe('203.0.113.7')
    expect(ip).not.toBe('198.51.100.9')
  })

  it('trims whitespace around either header', () => {
    expect(clientIp(headers({ 'x-real-ip': '  203.0.113.7  ' }))).toBe('203.0.113.7')
    expect(clientIp(headers({ 'x-forwarded-for': '  203.0.113.7  ,10.0.0.1' }))).toBe('203.0.113.7')
  })

  it('falls back to x-forwarded-for when x-real-ip is blank', () => {
    expect(clientIp(headers({ 'x-real-ip': '   ', 'x-forwarded-for': '203.0.113.7' }))).toBe('203.0.113.7')
  })

  it('returns null when the first x-forwarded-for entry is empty, rather than reaching for a later one', () => {
    expect(clientIp(headers({ 'x-forwarded-for': ', 198.51.100.9' }))).toBeNull()
  })

  it('returns null when neither header is present', () => {
    expect(clientIp(headers({}))).toBeNull()
  })

  it('passes an IPv6 address through untouched', () => {
    expect(clientIp(headers({ 'x-real-ip': '2001:db8::1' }))).toBe('2001:db8::1')
  })
})
