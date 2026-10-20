import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { previewAttribution } from '../attributionPreview'

describe('previewAttribution', () => {
  beforeEach(() => vi.stubEnv('SHORTLINK_AUTOTAG', ''))
  afterEach(() => vi.unstubAllEnvs())

  it('stamps a bare destination with the YouTube example by default', () => {
    const p = previewAttribution('ai-trade', 'https://edge.tradingwithsidhant.com/x')
    expect(p.willTag).toBe(true)
    expect(p.params).toEqual({
      utm_source: 'youtube.com',
      utm_medium: 'short_link',
      utm_campaign: 'ai-trade',
    })
    expect(p.exampleUrl).toBe(
      'https://edge.tradingwithsidhant.com/x?utm_source=youtube.com&utm_medium=short_link&utm_campaign=ai-trade',
    )
  })

  it('uses the given example referrer', () => {
    const p = previewAttribution('tg', 'https://t.me/x', { exampleReferrer: 'https://l.instagram.com/?u=1' })
    expect(p.params?.utm_source).toBe('l.instagram.com')
  })

  it('uses the short domain when the referrer is on tws.bio', () => {
    const p = previewAttribution('tg', 'https://t.me/x', { exampleReferrer: 'https://tws.bio/dash' })
    expect(p.params?.utm_source).toBe('tws.bio')
  })

  it('does not tag when the destination carries utm tags', () => {
    const p = previewAttribution('tg', 'https://t.me/x?utm_source=yt')
    expect(p).toMatchObject({ willTag: false, params: null, exampleUrl: null })
    expect(p.reason).toMatch(/utm/)
  })

  it('does not tag a click that comes from one of the business sites', () => {
    const p = previewAttribution('tg', 'https://t.me/x', { exampleReferrer: 'https://twsgurukulx.com/' })
    expect(p.willTag).toBe(false)
    expect(p.reason).toMatch(/own sites/)
  })

  it('does not tag app schemes, bad URLs, or an empty code', () => {
    expect(previewAttribution('x', 'spotify:track:1').willTag).toBe(false)
    expect(previewAttribution('x', 'nope').willTag).toBe(false)
    expect(previewAttribution('', 'https://t.me/x').willTag).toBe(false)
    expect(previewAttribution('x', '').willTag).toBe(false)
  })

  it('respects the kill switch', () => {
    vi.stubEnv('SHORTLINK_AUTOTAG', 'off')
    const p = previewAttribution('x', 'https://t.me/x')
    expect(p.willTag).toBe(false)
    expect(p.reason).toMatch(/off/)
  })

  it('keeps an existing query and hash intact', () => {
    const p = previewAttribution('k', 'https://dhan.co/a?ref=1#top')
    expect(p.exampleUrl).toBe(
      'https://dhan.co/a?ref=1&utm_source=youtube.com&utm_medium=short_link&utm_campaign=k#top',
    )
  })
})
