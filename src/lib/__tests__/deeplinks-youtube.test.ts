import { describe, it, expect } from 'vitest'
import { detectDeepLinks } from '../deeplinks'

describe('detectDeepLinks - YouTube', () => {
  it('maps watch URLs to the native video scheme', () => {
    const config = detectDeepLinks('https://www.youtube.com/watch?v=avYo84KuLLk')
    expect(config).not.toBeNull()
    expect(config!.platform).toBe('YouTube')
    expect(config!.ios).toBe('youtube://www.youtube.com/watch?v=avYo84KuLLk')
    expect(config!.android).toBe('vnd.youtube:avYo84KuLLk')
  })

  it('maps youtu.be short URLs to the native video scheme', () => {
    const config = detectDeepLinks('https://youtu.be/qnqfi_Lp7fo')
    expect(config).not.toBeNull()
    expect(config!.ios).toBe('youtube://www.youtube.com/watch?v=qnqfi_Lp7fo')
    expect(config!.android).toBe('vnd.youtube:qnqfi_Lp7fo')
  })

  it('maps channel handle URLs with the full host, never an empty authority', () => {
    const config = detectDeepLinks('https://www.youtube.com/@tradingwithsidhant')
    expect(config).not.toBeNull()
    expect(config!.platform).toBe('YouTube')
    // Regression guard: `youtube://${pathname}` produced youtube:///@handle
    // (empty authority), which the iOS app cannot route to the channel.
    expect(config!.ios).toBe('youtube://www.youtube.com/@tradingwithsidhant')
    expect(config!.ios).not.toContain(':///')
  })

  it('maps playlist URLs with the full host', () => {
    const config = detectDeepLinks('https://www.youtube.com/playlist?list=PL123abc')
    expect(config).not.toBeNull()
    expect(config!.ios).toBe('youtube://www.youtube.com/playlist?list=PL123abc')
    expect(config!.ios).not.toContain(':///')
  })
})
