import { describe, it, expect, afterEach, vi } from 'vitest'
import { gtmEvent, ensureDataLayer, TWS_EVENTS } from '../gtm'

describe('gtmEvent on the server (no window)', () => {
  it('does not throw when window is undefined', () => {
    expect(typeof window).toBe('undefined')
    expect(() => gtmEvent('x', { foo: 1 })).not.toThrow()
  })
})

describe('ensureDataLayer on the server (no window)', () => {
  it('returns undefined', () => {
    expect(ensureDataLayer()).toBeUndefined()
  })
})

describe('TWS_EVENTS', () => {
  it('prefixes every event name with tws_', () => {
    for (const value of Object.values(TWS_EVENTS)) {
      expect(value.startsWith('tws_')).toBe(true)
    }
  })

  it('never collides with the server container Meta CAPI trigger whitelist', () => {
    // Mirrors the shared server container's trigger config: these are the
    // standard GA4/Meta event names it forwards to the Meta Conversions
    // API as business conversions. tws_ event names must stay out of this
    // set, or internal tool activity would get counted as a conversion.
    const CAPI_WHITELIST = new Set([
      'PageView', 'ViewContent', 'Lead', 'Contact', 'InitiateCheckout',
      'AddToCart', 'AddPaymentInfo', 'AddToWishlist', 'Search',
      'CompleteRegistration', 'Purchase',
      'page_view', 'view_item', 'generate_lead', 'begin_checkout',
      'add_to_cart', 'add_payment_info', 'add_to_wishlist', 'search',
      'sign_up', 'purchase',
      'checkout_click', 'quiz_result_enroll', 'footprint_cta_click',
      'playbook_cta_click', 'quiz_lead_submit', 'propscanner_lead',
      'newsletter_signup', 'purchase_thank_you_view',
      'hitpoint_referral_click', 'lead_sheet_whatsapp_click',
    ])

    for (const value of Object.values(TWS_EVENTS)) {
      expect(CAPI_WHITELIST.has(value)).toBe(false)
    }
  })
})

describe('gtmEvent in the browser', () => {
  const originalWindow = globalThis.window

  afterEach(() => {
    if (originalWindow === undefined) {
      // @ts-expect-error -- restoring the node test environment's lack of `window`
      delete globalThis.window
    } else {
      globalThis.window = originalWindow
    }
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('pushes { event, ...params } onto dataLayer when GTM is enabled', async () => {
    // GTM_ID is read at module load, so it must be stubbed before a fresh
    // import picks it up.
    vi.stubEnv('NEXT_PUBLIC_GTM_ID', 'GTM-TEST123')
    vi.resetModules()

    const fakeDataLayer: unknown[] = []
    // @ts-expect-error -- minimal fake window, enough for gtmEvent's needs
    globalThis.window = { dataLayer: fakeDataLayer }

    const freshGtm = await import('../gtm')
    freshGtm.gtmEvent('x', { foo: 1 })

    expect(fakeDataLayer).toEqual([{ event: 'x', foo: 1 }])
  })
})
