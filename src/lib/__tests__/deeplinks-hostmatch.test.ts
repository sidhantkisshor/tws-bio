import { describe, it, expect } from 'vitest'
import { detectDeepLinks, hostMatches } from '../deeplinks'

describe('detectDeepLinks - host matching', () => {
  it('does not treat look-alike domains as Twitter/X', () => {
    expect(detectDeepLinks('https://twsgurukulx.com/r/ai-10-lakh-trade')).toBeNull()
    expect(detectDeepLinks('https://netflix.com.evil.io/x')).toBeNull()
    expect(detectDeepLinks('https://notyoutu.be/abc')).toBeNull()
  })

  it('still detects real hosts and their subdomains', () => {
    expect(detectDeepLinks('https://x.com/jack')?.platform).toBe('Twitter/X')
    expect(detectDeepLinks('https://www.x.com/jack')?.platform).toBe('Twitter/X')
    expect(detectDeepLinks('https://mobile.twitter.com/jack')?.platform).toBe('Twitter/X')
    expect(detectDeepLinks('https://m.youtube.com/watch?v=abc')).not.toBeNull()
    expect(detectDeepLinks('https://t.me/tradingwsidhant')).not.toBeNull()
  })

  it('hostMatches is case-insensitive', () => {
    expect(hostMatches('WWW.X.COM', 'x.com')).toBe(true)
    expect(hostMatches('twsgurukulx.com', 'x.com')).toBe(false)
  })
})
