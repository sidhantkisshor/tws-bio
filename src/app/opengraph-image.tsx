import { ImageResponse } from 'next/og'

export const alt = 'tws.bio — Short links, big impact'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * Generated OG image: dark brand canvas, tws.bio wordmark, green tick,
 * thin hairline. Deliberately self-contained — no external fetches or
 * custom font loading, so it can never fail a social-card render.
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
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0a',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <svg width="64" height="64" viewBox="0 0 24 24">
            <path d="M12 5.5l7.5 13h-15z" fill="#00B03B" />
          </svg>
          <div
            style={{
              display: 'flex',
              color: '#FAFAFA',
              fontSize: 128,
              fontWeight: 700,
              letterSpacing: '-0.03em',
            }}
          >
            tws.bio
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            width: 560,
            height: 1,
            backgroundColor: '#1f1f1f',
            marginTop: 48,
          }}
        />
        <div
          style={{
            display: 'flex',
            color: '#A1A1A1',
            fontSize: 34,
            marginTop: 48,
          }}
        >
          Short links, big impact
        </div>
      </div>
    ),
    size,
  )
}
