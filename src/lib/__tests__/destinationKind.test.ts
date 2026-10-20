import { describe, expect, it } from 'vitest'
import { DESTINATION_KINDS, destinationKind } from '../destinationKind'

describe('destinationKind', () => {
  it.each([
    ['https://twsgurukulx.com/ai-trading-masterclass', 'Course'],
    ['https://www.twsgurukulx.com/r/10k-to-10l', 'Course'],
    ['https://hitpoint.app/course', 'App'],
    ['https://www.youtube.com/watch?v=abc', 'Video'],
    ['https://m.youtube.com/@tradingwithsidhant', 'Video'],
    ['https://youtu.be/abc', 'Video'],
    ['https://t.me/tradingwithsidhant', 'Community'],
    ['https://discord.gg/abc', 'Community'],
    ['https://chat.whatsapp.com/xyz', 'Community'],
    ['https://www.instagram.com/tradingwithsidhant', 'Social'],
    ['https://x.com/sidhant', 'Social'],
    ['https://facebook.com/page', 'Social'],
    ['https://invite.dhan.co/?invite=TWS', 'Broker partner'],
    ['https://invite.coinswitch.co/TWS2026', 'Broker partner'],
    ['https://zerodha.com/open-account', 'Broker partner'],
    ['https://rzp.io/l/tws-kit', 'Payment'],
    ['https://pages.razorpay.com/tws', 'Payment'],
    ['https://razorpay.me/@tws', 'Payment'],
    ['https://tradingwithsidhant.com/tools', 'Website'],
    ['https://edge.tradingwithsidhant.com/', 'Website'],
    ['https://tws.notion.site/Guide-123', 'Doc'],
  ])('%s is %s', (url, kind) => {
    expect(destinationKind(url)).toBe(kind)
  })

  it('reads a host with no scheme and ignores case and a trailing dot', () => {
    expect(destinationKind('YOUTU.BE/abc')).toBe('Video')
    expect(destinationKind('https://www.YouTube.com./watch')).toBe('Video')
  })

  it('matches on a dot boundary only', () => {
    expect(destinationKind('https://notyoutube.com/x')).toBeNull()
    expect(destinationKind('https://faketwsgurukulx.com/')).toBeNull()
    expect(destinationKind('https://youtube.com.evil.example/')).toBeNull()
  })

  it('returns null for unknown hosts, app schemes and junk', () => {
    expect(destinationKind('https://example.com/')).toBeNull()
    expect(destinationKind('tg://resolve?domain=x')).toBeNull()
    expect(destinationKind('mailto:a@b.c')).toBeNull()
    expect(destinationKind('')).toBeNull()
    expect(destinationKind(null)).toBeNull()
    expect(destinationKind(undefined)).toBeNull()
    expect(destinationKind('http://')).toBeNull()
  })

  it('lists every kind once', () => {
    expect(new Set(DESTINATION_KINDS).size).toBe(DESTINATION_KINDS.length)
    expect(DESTINATION_KINDS).toHaveLength(9)
  })
})
