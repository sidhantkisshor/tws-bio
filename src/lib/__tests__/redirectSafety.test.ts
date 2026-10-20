import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SAFE_DEEP_LINK_SCHEMES,
  htmlEscape,
  isSafeUrl,
  jsonEscapeForHtml,
  pointsAtShortCode,
  resolveDestination,
  supportsIntentRedirect,
} from '../redirectSafety'

const qs = (s: string) => new URLSearchParams(s)

// One stored deep link per allowlisted app scheme. The allowlist is a security
// boundary, so adding or dropping a scheme should mean touching this list too.
const APP_LINK_EXAMPLES: Record<string, string> = {
  'youtube:': 'youtube://watch?v=dQw4w9WgXcQ',
  'vnd.youtube:': 'vnd.youtube:dQw4w9WgXcQ',
  'instagram:': 'instagram://user?username=example',
  'twitter:': 'twitter://user?screen_name=example',
  'tiktok:': 'tiktok://user?username=example',
  'spotify:': 'spotify:track:4uLU6hMCjMI75M1A2tKUQC',
  'linkedin:': 'linkedin://in/example',
  'fb:': 'fb://profile/100000000000000',
  'reddit:': 'reddit://r/india',
  'whatsapp:': 'whatsapp://send?phone=919999999999',
  'tg:': 'tg://resolve?domain=example',
  'discord:': 'discord://discord.com/invite/example',
  'slack:': 'slack://open?team=T00000000',
  'pinterest:': 'pinterest://user/example',
  'snapchat:': 'snapchat://add/example',
  'twitch:': 'twitch://stream/example',
  'nflx:': 'nflx://www.netflix.com/title/80057281',
  'soundcloud:': 'soundcloud://users/example',
  'comgooglemaps:': 'comgooglemaps://?q=Mumbai',
  'google.navigation:': 'google.navigation:q=Mumbai',
  'maps:': 'maps://?q=Mumbai',
  'geo:': 'geo:19.0760,72.8777?q=Mumbai',
  'com.amazon.mobile.shopping:': 'com.amazon.mobile.shopping://www.amazon.in/dp/B0EXAMPLE1',
  'ebay:': 'ebay://launch?itm=123456789012',
  'airbnb:': 'airbnb://rooms/12345',
  'uber:': 'uber://?action=setPickup&pickup=my_location',
  'venmo:': 'venmo://paycharge?txn=pay&recipients=example',
  'cashapp:': 'cashapp://cash.app/$example',
  'paypal:': 'paypal://paypalme/example',
  'medium:': 'medium://@example',
  'github:': 'github://github.com/vercel/next.js',
  'zoomus:': 'zoomus://zoom.us/join?confno=1234567890',
}

describe('isSafeUrl', () => {
  it('accepts a normal web destination', () => {
    expect(isSafeUrl('https://twsgurukulx.com/course?ref=yt#pricing')).toBe(true)
    expect(isSafeUrl('http://example.com')).toBe(true)
    expect(isSafeUrl('https://8.8.8.8/')).toBe(true)
  })

  it('matches the scheme case-insensitively', () => {
    expect(isSafeUrl('HTTPS://EXAMPLE.COM/Path')).toBe(true)
    expect(isSafeUrl('Spotify:track:4uLU6hMCjMI75M1A2tKUQC')).toBe(true)
  })

  it('refuses javascript:, data: and vbscript: in any case and behind leading whitespace', () => {
    for (const url of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      '   javascript:alert(1)',
      '\t\njavascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      ' DATA:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      'vbscript:msgbox(1)',
      '  VBScript:MsgBox(1)',
    ]) {
      expect(isSafeUrl(url), url).toBe(false)
    }
  })

  it('refuses a scheme that browsers would repair into javascript:', () => {
    // URL parsers drop tabs and newlines inside a URL and C0 control characters
    // before it, so each of these is javascript: to a browser.
    expect(isSafeUrl('java\tscript:alert(1)')).toBe(false)
    expect(isSafeUrl('java\nscript:alert(1)')).toBe(false)
    expect(isSafeUrl('\u0000javascript:alert(1)')).toBe(false)
  })

  it('refuses a scheme that is not on the allowlist', () => {
    for (const url of [
      'intent://scan/#Intent;scheme=zxing;package=com.google.zxing.client.android;end',
      'ftp://example.com/file.zip',
      'file:///etc/passwd',
      'mailto:hello@example.com',
      'chrome://settings',
      'about:blank',
    ]) {
      expect(isSafeUrl(url), url).toBe(false)
    }
  })

  it('refuses a value with no scheme', () => {
    for (const url of ['example.com/page', '//example.com/page', '/relative/path', '']) {
      expect(isSafeUrl(url), url).toBe(false)
    }
  })

  it('refuses web URLs that point at a private or loopback host, in any notation', () => {
    for (const url of [
      'http://127.1/',
      'http://[::1]/',
      'http://0177.0.0.1/',
      'http://2130706433/',
      'http://0x7f.0.0.1/',
      'http://[::ffff:127.0.0.1]/',
      'http://localhost:3000/',
      'http://localhost./',
      'https://10.0.0.5/admin',
      'http://192.168.1.1/',
      'http://169.254.169.254/latest/meta-data/',
    ]) {
      expect(isSafeUrl(url), url).toBe(false)
    }
  })

  it('cannot be fooled by userinfo in front of a blocked host', () => {
    expect(isSafeUrl('http://example.com@127.0.0.1/')).toBe(false)
  })

  it('refuses a web URL that does not parse', () => {
    expect(isSafeUrl('https://')).toBe(false)
    expect(isSafeUrl('https://[::1')).toBe(false)
  })

  it('has an example for every app scheme on the allowlist', () => {
    const appSchemes = [...SAFE_DEEP_LINK_SCHEMES].filter((s) => s !== 'http:' && s !== 'https:')
    expect(Object.keys(APP_LINK_EXAMPLES).sort()).toEqual(appSchemes.sort())
  })

  it('accepts a deep link on every allowlisted app scheme', () => {
    for (const url of Object.values(APP_LINK_EXAMPLES)) {
      expect(isSafeUrl(url), url).toBe(true)
    }
  })
})

describe('pointsAtShortCode', () => {
  it('is true for the same code on the short domain', () => {
    expect(pointsAtShortCode('https://tws.bio/course', 'course', 'tws.bio')).toBe(true)
    expect(pointsAtShortCode('https://tws.bio/course/', 'course', 'tws.bio')).toBe(true)
    expect(pointsAtShortCode('https://tws.bio/course?utm_source=yt#top', 'course', 'tws.bio')).toBe(true)
  })

  it('is false for another code on the same domain', () => {
    expect(pointsAtShortCode('https://tws.bio/other', 'course', 'tws.bio')).toBe(false)
    expect(pointsAtShortCode('https://tws.bio/', 'course', 'tws.bio')).toBe(false)
  })

  it('is false for a deeper path, which another route serves', () => {
    expect(pointsAtShortCode('https://tws.bio/r/some-slug', 'r', 'tws.bio')).toBe(false)
    expect(pointsAtShortCode('https://tws.bio/auth/callback', 'auth', 'tws.bio')).toBe(false)
    expect(pointsAtShortCode('https://tws.bio/course/x', 'course', 'tws.bio')).toBe(false)
  })

  it('ignores a www prefix and host case on either side', () => {
    expect(pointsAtShortCode('https://www.tws.bio/course', 'course', 'tws.bio')).toBe(true)
    expect(pointsAtShortCode('https://tws.bio/course', 'course', 'www.tws.bio')).toBe(true)
    expect(pointsAtShortCode('https://TWS.BIO/course', 'course', 'tws.bio')).toBe(true)
  })

  it('is false for the same path on another host', () => {
    expect(pointsAtShortCode('https://example.com/course', 'course', 'tws.bio')).toBe(false)
    expect(pointsAtShortCode('https://go.tws.bio/course', 'course', 'tws.bio')).toBe(false)
    expect(pointsAtShortCode('https://tws.bio.example.com/course', 'course', 'tws.bio')).toBe(false)
  })

  it('decodes a percent-encoded path segment before comparing', () => {
    expect(pointsAtShortCode('https://tws.bio/%63ourse', 'course', 'tws.bio')).toBe(true)
    expect(pointsAtShortCode('https://tws.bio/%63%6F%75%72%73%65', 'course', 'tws.bio')).toBe(true)
  })

  it('is false, without throwing, for a malformed escape or an unparseable URL', () => {
    expect(pointsAtShortCode('https://tws.bio/%E0%A4%A', 'course', 'tws.bio')).toBe(false)
    expect(pointsAtShortCode('not a url', 'course', 'tws.bio')).toBe(false)
  })
})

describe('jsonEscapeForHtml', () => {
  it('cannot close the inline <script> it is written into', () => {
    const url = 'https://example.com/?q=</script><script>alert(1)</script><!--'
    const out = jsonEscapeForHtml(url)
    expect(out).not.toMatch(/<\/script/i)
    expect(out).not.toContain('<')
    expect(out).not.toContain('>')
    expect(JSON.parse(out)).toBe(url)
  })

  it('returns a quoted JS string literal with quotes and backslashes escaped', () => {
    expect(jsonEscapeForHtml('a"b\\c')).toBe('"a\\"b\\\\c"')
    expect(JSON.parse(jsonEscapeForHtml('x"; alert(1); "'))).toBe('x"; alert(1); "')
  })
})

describe('htmlEscape', () => {
  it('escapes ampersands and double quotes in a URL bound for an href', () => {
    expect(htmlEscape('https://example.com/?a=1&b="2"')).toBe('https://example.com/?a=1&amp;b=&quot;2&quot;')
  })

  it('escapes angle brackets', () => {
    expect(htmlEscape('<a href="x">')).toBe('&lt;a href=&quot;x&quot;&gt;')
  })

  it('escapes the ampersand of an existing entity, so it shows as literal text', () => {
    expect(htmlEscape('&lt;script&gt;')).toBe('&amp;lt;script&amp;gt;')
    expect(htmlEscape('&quot;')).toBe('&amp;quot;')
  })

  it('leaves percent-encoding alone', () => {
    const url = 'https://example.com/?next=https%3A%2F%2Fpay.example.com%2Fcheckout'
    expect(htmlEscape(url)).toBe(url)
  })
})

describe('supportsIntentRedirect', () => {
  const CHROME_ANDROID =
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
  const SAMSUNG_INTERNET =
    'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36'
  const BARE_WEBVIEW =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240805.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/127.0.6533.103 Mobile Safari/537.36'
  const INSTAGRAM_WEBVIEW =
    'Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.82 Mobile Safari/537.36 Instagram 330.0.0.40.92 Android (34/14; 480dpi; 1080x2340; samsung; SM-S918B; dm3q; qcom; en_IN; 597319284)'
  const FACEBOOK_WEBVIEW =
    'Mozilla/5.0 (Linux; Android 13; RMX3085 Build/TP1A.220905.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.82 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/460.0.0.48.109;]'

  it('is true for full browsers, which parse intent: themselves', () => {
    expect(supportsIntentRedirect(CHROME_ANDROID)).toBe(true)
    expect(supportsIntentRedirect(SAMSUNG_INTERNET)).toBe(true)
  })

  it('is false for a bare Android WebView, marked "; wv)"', () => {
    expect(supportsIntentRedirect(BARE_WEBVIEW)).toBe(false)
    expect(supportsIntentRedirect('Mozilla/5.0 (Linux; Android 14;wv) AppleWebKit/537.36 Chrome/127.0.0.0')).toBe(false)
  })

  it("is true for Meta's in-app WebViews, which intercept intent: URIs", () => {
    expect(supportsIntentRedirect(INSTAGRAM_WEBVIEW)).toBe(true)
    expect(supportsIntentRedirect(FACEBOOK_WEBVIEW)).toBe(true)
    expect(
      supportsIntentRedirect('Mozilla/5.0 (Linux; Android 13; wv) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36 [FBAN/EMA;FBAV/400.0.0.0;]'),
    ).toBe(true)
  })
})

describe('resolveDestination', () => {
  // Pin the kill switch in both directions, so a SHORTLINK_AUTOTAG in the
  // shell running the tests cannot change the results.
  beforeEach(() => {
    vi.stubEnv('SHORTLINK_AUTOTAG', undefined)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('stamps the default campaign when the click brings no params', () => {
    expect(resolveDestination('https://twsgurukulx.com/course', qs(''), 'course', 'tws.bio')).toBe(
      'https://twsgurukulx.com/course?utm_source=tws.bio&utm_medium=short_link&utm_campaign=course',
    )
  })

  it('stamps the source it is given, such as the referring site, as utm_source', () => {
    expect(resolveDestination('https://twsgurukulx.com/course', qs(''), 'course', 'youtube.com')).toBe(
      'https://twsgurukulx.com/course?utm_source=youtube.com&utm_medium=short_link&utm_campaign=course',
    )
  })

  it('stamps nothing when the source is null', () => {
    expect(resolveDestination('https://twsgurukulx.com/course', qs(''), 'course', null)).toBe(
      'https://twsgurukulx.com/course',
    )
  })

  it("still forwards the click's own params when the source is null", () => {
    expect(
      resolveDestination('https://twsgurukulx.com/course', qs('gclid=abc123&utm_source=instagram'), 'course', null),
    ).toBe('https://twsgurukulx.com/course?gclid=abc123&utm_source=instagram')
  })

  it("keeps the click's own utm tags and adds no default", () => {
    const out = resolveDestination(
      'https://twsgurukulx.com/course',
      qs('utm_source=instagram&utm_medium=social&utm_campaign=diwali'),
      'course',
      'tws.bio',
    )
    expect(out).toContain('utm_source=instagram')
    expect(out).toContain('utm_medium=social')
    expect(out).toContain('utm_campaign=diwali')
    expect(out).not.toContain('utm_source=tws.bio')
    expect(out).not.toContain('short_link')
  })

  it('keeps inbound utm tags whatever their key casing', () => {
    const out = resolveDestination('https://twsgurukulx.com/course', qs('UTM_SOURCE=instagram'), 'course', 'tws.bio')
    expect(out).toContain('utm_source=instagram')
    expect(out).not.toContain('utm_source=tws.bio')
  })

  it('forwards a click ID and still stamps the default campaign when the click has no utm', () => {
    const out = resolveDestination('https://twsgurukulx.com/course', qs('gclid=abc123'), 'course', 'tws.bio')
    expect(out).toContain('gclid=abc123')
    expect(out).toContain('utm_source=tws.bio')
    expect(out).toContain('utm_medium=short_link')
    expect(out).toContain('utm_campaign=course')
  })

  it("keeps the destination's own campaign over the click's", () => {
    const out = resolveDestination(
      'https://twsgurukulx.com/course?utm_source=newsletter',
      qs('utm_source=instagram'),
      'course',
      'tws.bio',
    )
    expect(out).toContain('utm_source=newsletter')
    expect(out).not.toContain('utm_source=instagram')
    expect(out).not.toContain('utm_source=tws.bio')
  })

  it('only forwards when SHORTLINK_AUTOTAG=off', () => {
    vi.stubEnv('SHORTLINK_AUTOTAG', 'off')
    expect(resolveDestination('https://twsgurukulx.com/course', qs(''), 'course', 'tws.bio')).toBe(
      'https://twsgurukulx.com/course',
    )
    const out = resolveDestination('https://twsgurukulx.com/course', qs('gclid=abc123'), 'course', 'tws.bio')
    expect(out).toContain('gclid=abc123')
    expect(out).not.toContain('utm_')
  })

  it('leaves an app-scheme destination untouched', () => {
    const spotify = 'spotify:track:4uLU6hMCjMI75M1A2tKUQC'
    expect(resolveDestination(spotify, qs('gclid=abc123'), 'course', 'tws.bio')).toBe(spotify)
  })

  it('never changes scheme, host or path, so a destination that passed isSafeUrl still passes', () => {
    for (const destination of [
      'https://twsgurukulx.com/course',
      'https://twsgurukulx.com/course?ref=yt#pricing',
      'http://example.com/a/b/',
    ]) {
      const out = resolveDestination(destination, qs('gclid=abc123&utm_content=bio'), 'course', 'tws.bio')
      const before = new URL(destination)
      const after = new URL(out)
      expect(after.protocol).toBe(before.protocol)
      expect(after.host).toBe(before.host)
      expect(after.pathname).toBe(before.pathname)
      expect(isSafeUrl(out)).toBe(true)
    }
  })
})
