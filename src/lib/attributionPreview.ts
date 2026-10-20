import { attributionSource, isAutoTagEnabled, withShortLinkAttribution } from './shortLinkAttribution'

export interface AttributionPreview {
  willTag: boolean
  reason: string
  params: { utm_source: string; utm_medium: string; utm_campaign: string } | null
  exampleUrl: string | null
}

const SHORT_DOMAIN = process.env.NEXT_PUBLIC_SHORT_DOMAIN || 'tws.bio'

/**
 * What the redirect will stamp on a destination, for the create and edit forms.
 * It runs the real functions (`attributionSource`, `withShortLinkAttribution`),
 * so the answer cannot drift from the redirect. The example click arrives from
 * `exampleReferrer` (default YouTube) with no query of its own.
 */
export function previewAttribution(
  shortCode: string,
  destination: string,
  opts: { exampleReferrer?: string } = {},
): AttributionPreview {
  const none = (reason: string): AttributionPreview => ({
    willTag: false,
    reason,
    params: null,
    exampleUrl: null,
  })

  const code = shortCode.trim()
  const dest = destination.trim()
  if (!code) return none('Add a short code to see the tags.')
  let url: URL
  try {
    url = new URL(dest)
  } catch {
    return none('Enter a full destination URL to see the tags.')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return none('App links are sent as they are, with no tags.')
  }

  if (!isAutoTagEnabled()) return none('Default tagging is switched off (SHORTLINK_AUTOTAG=off).')

  const referrer = opts.exampleReferrer ?? 'https://www.youtube.com/'
  const source = attributionSource(referrer, SHORT_DOMAIN)
  if (source === null) {
    return none('A click from one of your own sites is not tagged, so it keeps the source that brought the visitor.')
  }

  const tagged = withShortLinkAttribution(dest, new URLSearchParams(), code, source)
  if (tagged === dest) {
    return none('The destination already has its own utm tags, which win over the default ones.')
  }

  const stamped = new URL(tagged).searchParams
  return {
    willTag: true,
    reason: 'Clicks with no tags of their own get the source, medium and campaign below.',
    params: {
      utm_source: stamped.get('utm_source') ?? source,
      utm_medium: stamped.get('utm_medium') ?? 'short_link',
      utm_campaign: stamped.get('utm_campaign') ?? code,
    },
    exampleUrl: tagged,
  }
}
