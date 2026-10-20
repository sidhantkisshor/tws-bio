import { describe, expect, it } from 'vitest'
import { getBrowser, getDevice, getOS, isAndroid, isIOS } from '../userAgent'

// Real user agents, as these browsers and apps send them.
const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1'
const IPHONE_FIREFOX =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15'
// iPadOS 12 and earlier, or Safari set to request the mobile site.
const IPAD_SAFARI_OLD =
  'Mozilla/5.0 (iPad; CPU OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1'
const MAC_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
// iPadOS 13+ Safari asks for desktop sites and sends the Mac UA, byte for byte.
const IPADOS_SAFARI = MAC_SAFARI
const MAC_CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
// Chrome's reduced UA: the model is always "K", and tablets drop "Mobile".
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
const ANDROID_TABLET_CHROME =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const ANDROID_EDGE =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 EdgA/126.0.0.0'
const ANDROID_FIREFOX_TABLET = 'Mozilla/5.0 (Android 14; Tablet; rv:127.0) Gecko/127.0 Firefox/127.0'
const SAMSUNG_INTERNET =
  'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36'
const INSTAGRAM_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 337.0.3.23.54 (iPhone15,2; iOS 17_5; en_IN; en; scale=3.00; 1179x2556; 612488152)'
const INSTAGRAM_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.82 Mobile Safari/537.36 Instagram 330.0.0.40.92 Android (34/14; 480dpi; 1080x2340; samsung; SM-S918B; dm3q; qcom; en_IN; 597319284)'
const FACEBOOK_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.37.104;FBBV/612345678;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/en_GB;FBOP/5]'
const FACEBOOK_ANDROID =
  'Mozilla/5.0 (Linux; Android 13; RMX3085 Build/TP1A.220905.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.82 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/460.0.0.48.109;]'
const WINDOWS_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const WINDOWS_EDGE =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0'
const WINDOWS_OPERA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 OPR/112.0.0.0'
const WINDOWS_FIREFOX = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0'
const LINUX_FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0'
const CHROMEOS =
  'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
// Meta's link-preview crawler, which fetches a link when it is pasted into a post.
const FACEBOOK_CRAWLER = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'

interface Classified {
  ios: boolean
  android: boolean
  browser: string
  os: string
  device: 'desktop' | 'mobile' | 'tablet'
}

function classify(userAgent: string): Classified {
  return {
    ios: isIOS(userAgent),
    android: isAndroid(userAgent),
    browser: getBrowser(userAgent),
    os: getOS(userAgent),
    device: getDevice(userAgent),
  }
}

const CASES: Array<[name: string, userAgent: string, expected: Classified]> = [
  ['iPhone Safari', IPHONE_SAFARI, { ios: true, android: false, browser: 'Safari', os: 'iOS', device: 'mobile' }],
  ['iPhone Chrome (CriOS)', IPHONE_CHROME, { ios: true, android: false, browser: 'Chrome', os: 'iOS', device: 'mobile' }],
  ['iPhone Firefox (FxiOS)', IPHONE_FIREFOX, { ios: true, android: false, browser: 'Firefox', os: 'iOS', device: 'mobile' }],
  ['iPad with the old iPad UA', IPAD_SAFARI_OLD, { ios: true, android: false, browser: 'Safari', os: 'iOS', device: 'tablet' }],
  ['iPadOS 13+ Safari (desktop UA)', IPADOS_SAFARI, { ios: false, android: false, browser: 'Safari', os: 'macOS', device: 'desktop' }],
  ['macOS Safari', MAC_SAFARI, { ios: false, android: false, browser: 'Safari', os: 'macOS', device: 'desktop' }],
  ['macOS Chrome', MAC_CHROME, { ios: false, android: false, browser: 'Chrome', os: 'macOS', device: 'desktop' }],
  ['Android Chrome', ANDROID_CHROME, { ios: false, android: true, browser: 'Chrome', os: 'Android', device: 'mobile' }],
  ['Android tablet Chrome', ANDROID_TABLET_CHROME, { ios: false, android: true, browser: 'Chrome', os: 'Android', device: 'tablet' }],
  ['Android Edge', ANDROID_EDGE, { ios: false, android: true, browser: 'Edge', os: 'Android', device: 'mobile' }],
  ['Android tablet Firefox', ANDROID_FIREFOX_TABLET, { ios: false, android: true, browser: 'Firefox', os: 'Android', device: 'tablet' }],
  ['Samsung Internet', SAMSUNG_INTERNET, { ios: false, android: true, browser: 'Samsung Internet', os: 'Android', device: 'mobile' }],
  ['Instagram in-app on iOS', INSTAGRAM_IOS, { ios: true, android: false, browser: 'Instagram', os: 'iOS', device: 'mobile' }],
  ['Instagram in-app on Android', INSTAGRAM_ANDROID, { ios: false, android: true, browser: 'Instagram', os: 'Android', device: 'mobile' }],
  ['Facebook in-app on iOS', FACEBOOK_IOS, { ios: true, android: false, browser: 'Facebook', os: 'iOS', device: 'mobile' }],
  ['Facebook in-app on Android', FACEBOOK_ANDROID, { ios: false, android: true, browser: 'Facebook', os: 'Android', device: 'mobile' }],
  ['Windows Chrome', WINDOWS_CHROME, { ios: false, android: false, browser: 'Chrome', os: 'Windows', device: 'desktop' }],
  ['Windows Edge', WINDOWS_EDGE, { ios: false, android: false, browser: 'Edge', os: 'Windows', device: 'desktop' }],
  ['Windows Opera', WINDOWS_OPERA, { ios: false, android: false, browser: 'Opera', os: 'Windows', device: 'desktop' }],
  ['Windows Firefox', WINDOWS_FIREFOX, { ios: false, android: false, browser: 'Firefox', os: 'Windows', device: 'desktop' }],
  ['Linux Firefox', LINUX_FIREFOX, { ios: false, android: false, browser: 'Firefox', os: 'Linux', device: 'desktop' }],
  ['ChromeOS', CHROMEOS, { ios: false, android: false, browser: 'Chrome', os: 'ChromeOS', device: 'desktop' }],
  ['Googlebot', GOOGLEBOT, { ios: false, android: false, browser: 'Other', os: 'Other', device: 'desktop' }],
  ['Meta link-preview crawler', FACEBOOK_CRAWLER, { ios: false, android: false, browser: 'Other', os: 'Other', device: 'desktop' }],
  ['an empty user agent', '', { ios: false, android: false, browser: 'Other', os: 'Other', device: 'desktop' }],
]

describe('user-agent classification', () => {
  it.each(CASES)('%s', (_name, userAgent, expected) => {
    expect(classify(userAgent)).toEqual(expected)
  })
})

describe('getBrowser', () => {
  it('names the in-app browser rather than the Chrome or WebKit engine it wraps', () => {
    expect(getBrowser(INSTAGRAM_ANDROID)).toBe('Instagram')
    expect(getBrowser(FACEBOOK_ANDROID)).toBe('Facebook')
    expect(getBrowser(INSTAGRAM_IOS)).toBe('Instagram')
    expect(getBrowser(FACEBOOK_IOS)).toBe('Facebook')
  })

  it('counts a Facebook UA that carries only one of FBAN, FBAV or FB_IAB', () => {
    expect(getBrowser('Mozilla/5.0 (iPhone) Mobile/15E148 [FBAN/FBIOS;FBLC/en_GB]')).toBe('Facebook')
    expect(getBrowser('Mozilla/5.0 (iPhone) Mobile/15E148 [FBAV/470.0.0.37.104]')).toBe('Facebook')
    expect(getBrowser('Mozilla/5.0 (Linux; Android 13; wv) Chrome/124.0.0.0 [FB_IAB/FB4A]')).toBe('Facebook')
  })

  it("does not count Meta's link-preview crawler as the Facebook in-app browser", () => {
    expect(getBrowser(FACEBOOK_CRAWLER)).toBe('Other')
  })

  it('tells Samsung Internet apart from the Chrome it is built on', () => {
    expect(getBrowser(SAMSUNG_INTERNET)).toBe('Samsung Internet')
  })
})

describe('iPad', () => {
  it('reads iPadOS 13+ Safari as macOS desktop, a known limitation: it sends the Mac UA unchanged', () => {
    expect(classify(IPADOS_SAFARI)).toEqual(classify(MAC_SAFARI))
    expect(getOS(IPADOS_SAFARI)).toBe('macOS')
    expect(getDevice(IPADOS_SAFARI)).toBe('desktop')
  })

  it('reads a Macintosh UA with a Mobile token as an iPad, since a Mac browser never sends Mobile', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
    expect(isIOS(ua)).toBe(true)
    expect(getOS(ua)).toBe('iOS')
    expect(getDevice(ua)).toBe('tablet')
  })
})
