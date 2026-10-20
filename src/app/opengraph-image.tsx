import { ImageResponse } from 'next/og'

export const alt = 'tws.bio: the link desk for Trading with Sidhant'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Day Book light tokens (src/app/globals.css).
const PAGE = '#F3F0EA'
const INK = '#1E2528'
const INK_2 = '#2C3539'
const TEXT_3 = '#5E6569'
const BAR = '#566166'
const BAR_MARK = '#C87533'

// A small ledger chart for the corner: slate bars with one marked day, the
// way the dashboard marks a launch. Fixed data, it is decoration only.
const BARS = [38, 52, 44, 61, 47, 58, 112, 72, 64, 69, 57, 74]

/**
 * Generated OG image: a Day Book page. Warm paper, the wordmark over a 2px
 * slate rule, the headline, and a double rule under it. Deliberately
 * self-contained: no external fetches or custom font loading, so it can never
 * fail a social-card render.
 */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: PAGE,
          padding: '72px 80px',
          color: INK,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 20,
            paddingBottom: 28,
            borderBottom: `3px solid ${INK_2}`,
          }}
        >
          <div style={{ display: 'flex', fontSize: 44, fontWeight: 700, letterSpacing: '-0.01em' }}>tws.bio</div>
          <div style={{ display: 'flex', fontSize: 28, color: TEXT_3 }}>by Trading with Sidhant</div>
        </div>

        <div
          style={{
            display: 'flex',
            flex: 1,
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 48,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                display: 'flex',
                fontSize: 76,
                fontWeight: 500,
                lineHeight: 1.06,
                letterSpacing: '-0.02em',
                maxWidth: 760,
                paddingBottom: 24,
              }}
            >
              The link desk for Trading with Sidhant.
            </div>
            {/* The double rule, drawn as two lines: satori has no double border. */}
            <div
              style={{
                display: 'flex',
                height: 7,
                borderTop: `2px solid ${INK_2}`,
                borderBottom: `2px solid ${INK_2}`,
              }}
            />
            <div style={{ display: 'flex', fontSize: 28, color: TEXT_3, marginTop: 24 }}>
              Short links, click counts and app deep links.
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 8,
              height: 140,
              borderBottom: `2px solid ${INK_2}`,
            }}
          >
            {BARS.map((h, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  width: 16,
                  height: h,
                  backgroundColor: i === 6 ? BAR_MARK : BAR,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    ),
    size,
  )
}
