import { describe, it, expect } from 'vitest'
import { toAndroidLaunchUri } from '../deeplinks'

const FALLBACK = 'https://www.youtube.com/@tradingwithsidhant'
const ENC = encodeURIComponent(FALLBACK)

describe('toAndroidLaunchUri - gesture-preserving Android launch URIs', () => {
  it('converts vnd.youtube video URIs to a packaged https intent', () => {
    const uri = toAndroidLaunchUri('vnd.youtube:avYo84KuLLk', 'https://www.youtube.com/watch?v=avYo84KuLLk')
    expect(uri).toBe(
      'intent://www.youtube.com/watch?v=avYo84KuLLk#Intent;scheme=https;package=com.google.android.youtube;S.browser_fallback_url=' +
        encodeURIComponent('https://www.youtube.com/watch?v=avYo84KuLLk') +
        ';end'
    )
  })

  it('converts youtube.com https links (channels) to a packaged https intent', () => {
    const uri = toAndroidLaunchUri('https://www.youtube.com/@tradingwithsidhant', FALLBACK)
    expect(uri).toBe(
      `intent://www.youtube.com/@tradingwithsidhant#Intent;scheme=https;package=com.google.android.youtube;S.browser_fallback_url=${ENC};end`
    )
  })

  it('converts tg:// URIs to an intent with the Telegram package', () => {
    const uri = toAndroidLaunchUri('tg://resolve?domain=tradingwsidhant', 'https://t.me/tradingwsidhant')
    expect(uri).toBe(
      'intent://resolve?domain=tradingwsidhant#Intent;scheme=tg;package=org.telegram.messenger;S.browser_fallback_url=' +
        encodeURIComponent('https://t.me/tradingwsidhant') +
        ';end'
    )
  })

  it('converts instagram:// URIs to an intent with the Instagram package', () => {
    const uri = toAndroidLaunchUri('instagram://user?username=tradingwithsidhant', 'https://instagram.com/tradingwithsidhant')
    expect(uri).toBe(
      'intent://user?username=tradingwithsidhant#Intent;scheme=instagram;package=com.instagram.android;S.browser_fallback_url=' +
        encodeURIComponent('https://instagram.com/tradingwithsidhant') +
        ';end'
    )
  })

  it('wraps mapped custom schemes with their package', () => {
    const uri = toAndroidLaunchUri('spotify://track/abc', 'https://open.spotify.com/track/abc')
    expect(uri).toBe(
      'intent://track/abc#Intent;scheme=spotify;package=com.spotify.music;S.browser_fallback_url=' +
        encodeURIComponent('https://open.spotify.com/track/abc') +
        ';end'
    )
  })

  it('wraps unmapped custom schemes generically, letting Android resolve by scheme', () => {
    const uri = toAndroidLaunchUri('discord://invite/xyz', 'https://discord.gg/xyz')
    expect(uri).toBe(
      'intent://invite/xyz#Intent;scheme=discord;S.browser_fallback_url=' +
        encodeURIComponent('https://discord.gg/xyz') +
        ';end'
    )
  })

  it('passes through already-built intent URIs untouched', () => {
    const intent = `intent://www.youtube.com/@x#Intent;scheme=https;package=com.google.android.youtube;S.browser_fallback_url=${ENC};end`
    expect(toAndroidLaunchUri(intent, FALLBACK)).toBe(intent)
  })

  it('passes through non-YouTube https URLs untouched (no package is known)', () => {
    expect(toAndroidLaunchUri('https://example.com/page', 'https://example.com/page')).toBe(
      'https://example.com/page'
    )
  })

  it('handles authority-form scheme URIs', () => {
    const uri = toAndroidLaunchUri('twitter://user?screen_name=x', 'https://twitter.com/x')
    expect(uri).toBe(
      'intent://user?screen_name=x#Intent;scheme=twitter;package=com.twitter.android;S.browser_fallback_url=' +
        encodeURIComponent('https://twitter.com/x') +
        ';end'
    )
  })

  it('neutralizes intent-delimiter injection in the deep link', () => {
    // A crafted stored value must not smuggle its own Intent params.
    const uri = toAndroidLaunchUri(
      'tg://resolve?domain=x#Intent;package=com.evil.app;end',
      'https://t.me/x'
    )
    // The only structural '#' and ';' characters are the ones we emit.
    expect(uri.indexOf('#')).toBe(uri.lastIndexOf('#'))
    expect(uri).toContain('package=org.telegram.messenger')
    expect(uri).not.toContain('package=com.evil.app;')
    expect(uri.endsWith(';end')).toBe(true)
  })

  it('degrades opaque single-colon URIs to the web fallback instead of crashing', () => {
    expect(toAndroidLaunchUri('spotify:track:abc123', 'https://open.spotify.com/track/abc123')).toBe(
      'https://open.spotify.com/track/abc123'
    )
    expect(toAndroidLaunchUri('geo:0,0?q=Paris', 'https://maps.google.com/?q=Paris')).toBe(
      'https://maps.google.com/?q=Paris'
    )
  })

  it('degrades an invalid scheme to the web fallback', () => {
    expect(toAndroidLaunchUri('we#ird://x', 'https://example.com/')).toBe('https://example.com/')
  })

  it('routes music.youtube.com to the YouTube Music package', () => {
    const uri = toAndroidLaunchUri('https://music.youtube.com/playlist?list=PL1', 'https://music.youtube.com/playlist?list=PL1')
    expect(uri).toContain('package=com.google.android.apps.youtube.music')
    expect(uri).not.toContain('package=com.google.android.youtube;')
  })

  it('normalizes uppercase schemes so the package map still applies', () => {
    const uri = toAndroidLaunchUri('TG://resolve?domain=x', 'https://t.me/x')
    expect(uri).toContain('scheme=tg;')
    expect(uri).toContain('package=org.telegram.messenger')
  })

  it('does not resolve Object.prototype members as packages', () => {
    const uri = toAndroidLaunchUri('constructor://x', 'https://example.com/')
    expect(uri).not.toContain('package=')
  })

  it('always emits a parseable URL', () => {
    for (const v of [
      'vnd.youtube:avYo84KuLLk',
      'https://www.youtube.com/@handle',
      'tg://resolve?domain=x',
      'instagram://user?username=x',
      'spotify:track:abc',
      'discord://invite/xyz',
    ]) {
      expect(() => new URL(toAndroidLaunchUri(v, 'https://example.com/'))).not.toThrow()
    }
  })
})
