import { describe, it, expect } from 'vitest'
import { REFERRERS_RECORDED_SINCE, groupByPlatform, platformForReferrer, referrerWindowStart } from '../sources'

describe('platformForReferrer', () => {
  it.each([
    ['www.youtube.com', 'youtube', 'YouTube'],
    ['m.youtube.com', 'youtube', 'YouTube'],
    ['youtu.be', 'youtube', 'YouTube'],
    ['music.youtube.com', 'youtube', 'YouTube'],
    ['com.google.android.youtube', 'youtube', 'YouTube'],
    ['l.instagram.com', 'instagram', 'Instagram'],
    ['com.instagram.android', 'instagram', 'Instagram'],
    ['m.facebook.com', 'facebook', 'Facebook'],
    ['lm.facebook.com', 'facebook', 'Facebook'],
    ['com.facebook.orca', 'facebook', 'Facebook'],
    ['web.whatsapp.com', 'whatsapp', 'WhatsApp'],
    ['wa.me', 'whatsapp', 'WhatsApp'],
    ['web.telegram.org', 'telegram', 'Telegram'],
    ['t.me', 'telegram', 'Telegram'],
    ['org.telegram.messenger', 'telegram', 'Telegram'],
    ['t.co', 'x', 'X'],
    ['twitter.com', 'x', 'X'],
    ['lnkd.in', 'linkedin', 'LinkedIn'],
    ['reddit.com', 'reddit', 'Reddit'],
    ['discord.gg', 'discord', 'Discord'],
    ['google.com', 'google', 'Google'],
    ['google.co.in', 'google', 'Google'],
    ['com.google.android.googlequicksearchbox', 'google', 'Google'],
    ['bing.com', 'search', 'Other search'],
    ['search.yahoo.com', 'search', 'Other search'],
    ['mail.google.com', 'email', 'Email'],
    ['outlook.live.com', 'email', 'Email'],
    ['twsgurukulx.com', 'own', 'Your sites'],
    ['edge.tradingwithsidhant.com', 'own', 'Your sites'],
    ['hitpoint.app', 'own', 'Your sites'],
    ['tws.bio', 'tws', 'tws.bio'],
    ['app.tws.bio', 'tws', 'tws.bio'],
    ['com.example.reader', 'app', 'Android apps'],
  ])('%s -> %s', (domain, key, label) => {
    expect(platformForReferrer(domain)).toEqual({ key, label })
  })

  it('treats null, undefined, empty and Direct as no referrer', () => {
    for (const v of [null, undefined, '', '   ', 'Direct', 'direct']) {
      expect(platformForReferrer(v)).toEqual({
        key: 'none',
        label: 'No referrer (apps, chats, direct)',
      })
    }
  })

  it('ignores case and www.', () => {
    expect(platformForReferrer('WWW.YouTube.COM').key).toBe('youtube')
    expect(platformForReferrer('www.Bing.com').key).toBe('search')
  })

  it('does not match look-alike domains', () => {
    expect(platformForReferrer('notyoutube.com').key).toBe('other')
    expect(platformForReferrer('nottradingwithsidhant.com').key).toBe('other')
    expect(platformForReferrer('notgoogle.com').key).toBe('other')
  })

  it('labels an unknown domain with the domain itself', () => {
    expect(platformForReferrer('www.moneycontrol.com')).toEqual({
      key: 'other',
      label: 'moneycontrol.com',
    })
  })
})

describe('groupByPlatform', () => {
  it('merges domains of one platform and sorts by count', () => {
    const out = groupByPlatform([
      { name: 'm.youtube.com', count: 163 },
      { name: 'www.youtube.com', count: 11318 },
      { name: 'Direct', count: 9675 },
      { name: 'l.instagram.com', count: 1966 },
      { name: 'instagram.com', count: 369 },
    ])
    expect(out.map((g) => g.key)).toEqual(['youtube', 'none', 'instagram'])
    expect(out[0].count).toBe(11481)
    expect(out[0].domains).toEqual([
      { name: 'www.youtube.com', count: 11318 },
      { name: 'm.youtube.com', count: 163 },
    ])
    expect(out[2].count).toBe(2335)
  })

  it('computes share from the total', () => {
    const out = groupByPlatform([
      { name: 'youtube.com', count: 75 },
      { name: null, count: 25 },
    ])
    expect(out[0].share).toBeCloseTo(0.75)
    expect(out[1].share).toBeCloseTo(0.25)
    expect(out[1].key).toBe('none')
  })

  it('keeps each unmapped domain in its own row', () => {
    const out = groupByPlatform([
      { name: 'a.example.net', count: 5 },
      { name: 'b.example.net', count: 3 },
    ])
    expect(out).toHaveLength(2)
    expect(out.map((g) => g.label)).toEqual(['a.example.net', 'b.example.net'])
  })

  it('returns share 0 when the total is 0, and [] for no rows', () => {
    const out = groupByPlatform([{ name: 'youtube.com', count: 0 }])
    expect(out[0].share).toBe(0)
    expect(groupByPlatform([])).toEqual([])
  })

  it('merges a null row and a Direct row', () => {
    const out = groupByPlatform([
      { name: null, count: 2 },
      { name: 'Direct', count: 3 },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].count).toBe(5)
  })
})

describe('referrerWindowStart', () => {
  it('keeps a window that starts after referrers were recorded', () => {
    expect(referrerWindowStart('2026-09-01T00:00:00.000Z')).toEqual({
      since: '2026-09-01T00:00:00.000Z',
      clamped: false,
    })
    expect(referrerWindowStart(new Date(REFERRERS_RECORDED_SINCE))).toEqual({
      since: REFERRERS_RECORDED_SINCE,
      clamped: false,
    })
  })

  it('starts all time and earlier windows at the day referrers were first recorded', () => {
    expect(referrerWindowStart(null)).toEqual({ since: REFERRERS_RECORDED_SINCE, clamped: true })
    expect(referrerWindowStart(undefined)).toEqual({ since: REFERRERS_RECORDED_SINCE, clamped: true })
    expect(referrerWindowStart('2026-07-01T00:00:00Z')).toEqual({ since: REFERRERS_RECORDED_SINCE, clamped: true })
    expect(referrerWindowStart('not a date')).toEqual({ since: REFERRERS_RECORDED_SINCE, clamped: true })
  })
})
