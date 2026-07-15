import { describe, it, expect } from 'vitest'
import { detectDeepLinks } from '../deeplinks'

describe('detectDeepLinks - Amazon ASIN resolution', () => {
  it('extracts ASIN from /dp/<ASIN>', () => {
    const config = detectDeepLinks('https://www.amazon.com/dp/B08N5WRWNW')
    expect(config).not.toBeNull()
    expect(config!.platform).toBe('Amazon')
    expect(config!.ios).toContain('B08N5WRWNW')
    expect(config!.android).toContain('B08N5WRWNW')
  })

  it('extracts ASIN from /gp/product/<ASIN>', () => {
    const config = detectDeepLinks('https://www.amazon.com/gp/product/B07XYZ1234')
    expect(config).not.toBeNull()
    expect(config!.platform).toBe('Amazon')
    expect(config!.ios).toContain('B07XYZ1234')
    expect(config!.android).toContain('B07XYZ1234')
  })

  it('falls back gracefully when dp is the last segment (no ASIN)', () => {
    const config = detectDeepLinks('https://www.amazon.com/dp')
    expect(config).not.toBeNull()
    expect(config!.platform).toBe('Amazon')
    // Must NOT emit a bogus product URI built from a wrong arbitrary segment.
    // The graceful fallback is the generic Amazon app scheme with no /dp/<...> path.
    expect(config!.ios).toBe('com.amazon.mobile.shopping://')
    expect(config!.android).toBe('com.amazon.mobile.shopping://')
    expect(config!.ios).not.toContain('/dp/')
    expect(config!.android).not.toContain('/dp/')
  })

  it('extracts ASIN from a slug + /dp/<ASIN>/ref path', () => {
    const config = detectDeepLinks(
      'https://www.amazon.com/Some-Product-Name/dp/B012345678/ref=xx'
    )
    expect(config).not.toBeNull()
    expect(config!.platform).toBe('Amazon')
    expect(config!.ios).toContain('B012345678')
    expect(config!.android).toContain('B012345678')
  })
})
