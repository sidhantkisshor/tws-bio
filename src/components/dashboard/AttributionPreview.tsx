import { previewAttribution } from '@/lib/attributionPreview'
import { cn } from '@/lib/utils'

// What GA4 receives for a short link, per platform, from the same functions
// the redirect runs (previewAttribution -> shortLinkAttribution.ts), so the
// preview cannot drift from what actually happens. Presentational and
// hook-free: safe in a client form (Create, Edit Link) and on the server.

const PLATFORMS: { label: string; referrer: string }[] = [
  { label: 'YouTube', referrer: 'https://www.youtube.com/' },
  { label: 'Instagram', referrer: 'https://l.instagram.com/' },
  { label: 'WhatsApp, typed, QR', referrer: '' },
  { label: 'Your sites', referrer: 'https://tradingwithsidhant.com/' },
]

const YOUR_SITES = 'tradingwithsidhant.com, twsgurukulx.com, hitpoint.app'

function splitUrl(tagged: string, destination: string) {
  let url: URL
  try {
    url = new URL(tagged)
  } catch {
    return null
  }
  let before = new Set<string>()
  try {
    before = new Set(new URL(destination.trim()).searchParams.keys())
  } catch {
    // keep empty: every param counts as added
  }
  const params = [...url.searchParams.entries()].map(([k, v]) => ({
    text: new URLSearchParams([[k, v]]).toString(),
    added: !before.has(k),
  }))
  return { base: `${url.origin}${url.pathname}`, params, hash: url.hash }
}

export interface AttributionPreviewProps {
  /** The short code as typed (no domain). */
  shortCode: string
  /** The destination URL as typed. */
  destination: string
  className?: string
}

export function AttributionPreview({ shortCode, destination, className }: AttributionPreviewProps) {
  const youtube = previewAttribution(shortCode, destination, { exampleReferrer: PLATFORMS[0].referrer })

  if (!youtube.willTag || !youtube.params || !youtube.exampleUrl) {
    return <p className={cn('text-sm leading-relaxed text-text-2', className)}>{youtube.reason}</p>
  }

  const rows = PLATFORMS.map((p) => {
    const r = previewAttribution(shortCode, destination, { exampleReferrer: p.referrer })
    return { ...p, source: r.willTag && r.params ? r.params.utm_source : null }
  })
  const split = splitUrl(youtube.exampleUrl, destination)

  return (
    <div className={cn('min-w-0', className)}>
      <p className="mb-4 text-sm leading-relaxed text-text-2">
        Each click gets these tags before it reaches the page, so GA4 can name the link and the
        platform it was clicked on.
      </p>
      <table className="w-full border-collapse text-[13.5px]">
        <thead>
          <tr className="border-b border-ink-2">
            <th scope="col" className="type-label pb-2 text-left">Clicked from</th>
            <th scope="col" className="type-label pb-2 text-right">utm_source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-rule last:border-b-0">
              <th scope="row" className="py-2 pr-3 text-left align-top font-normal text-ink">
                {r.label}
                {r.label === 'Your sites' && (
                  <span className="block text-[12.5px] text-text-3">{YOUR_SITES}</span>
                )}
              </th>
              <td className="py-2 text-right align-top">
                {r.source ? (
                  <span className="font-mono text-[13px] text-ink [overflow-wrap:anywhere]">{r.source}</span>
                ) : (
                  <span className="text-[13px] text-text-2">Nothing added</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-4 mb-5 grid gap-0">
        {(
          [
            ['utm_medium', youtube.params.utm_medium],
            ['utm_campaign', youtube.params.utm_campaign],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 border-b border-rule py-1.5 text-[13px]">
            <dt className="font-mono text-text-2">{k}</dt>
            <dd className="m-0 min-w-0 text-right font-mono text-ink [overflow-wrap:anywhere]">{v}</dd>
          </div>
        ))}
      </dl>

      <p className="type-label">Example, clicked from YouTube</p>
      {split ? (
        <p className="mt-2 rounded-ctl bg-page p-3 font-mono text-[12.5px] leading-[1.7] text-text-2 [overflow-wrap:anywhere]">
          {split.base}
          {split.params.map((p, i) => (
            <span key={`${p.text}-${i}`}>
              {i === 0 ? '?' : '&'}
              {p.added ? (
                <mark className="rounded-[2px] bg-accent-soft px-0.5 text-ink">{p.text}</mark>
              ) : (
                p.text
              )}
            </span>
          ))}
          {split.hash}
        </p>
      ) : (
        <p className="mt-2 font-mono text-[12.5px] text-text-2 [overflow-wrap:anywhere]">{youtube.exampleUrl}</p>
      )}
      <p className="mt-2 text-[12.5px] text-text-3">Highlighted: the tags tws.bio adds.</p>
    </div>
  )
}
