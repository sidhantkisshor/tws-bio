import Script from 'next/script'
import { GTM_ID } from '@/lib/gtm'

/**
 * Boots the shared "Trading with Sidhant" GTM container.
 *
 * Renders nothing (not even the Script tag) when NEXT_PUBLIC_GTM_ID is
 * unset, so local dev and any preview deploy without the env var stays
 * free of third-party network calls. No client interactivity is needed
 * here, just markup, so this stays a Server Component and ships zero
 * extra client JS of its own: next/script handles the injection.
 */
export function GoogleTagManager() {
  if (!GTM_ID) return null

  return (
    <Script
      id="gtm-init"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`,
      }}
    />
  )
}

/**
 * The GTM `<noscript>` fallback pixel. Google's install instructions call
 * for this to be the very first element inside `<body>`, kept separate
 * from `GoogleTagManager` above so layout.tsx can place each where it
 * belongs (body-start vs. anywhere-in-body).
 */
export function GoogleTagManagerNoScript() {
  if (!GTM_ID) return null

  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        height="0"
        width="0"
        style={{ display: 'none', visibility: 'hidden' }}
      />
    </noscript>
  )
}
