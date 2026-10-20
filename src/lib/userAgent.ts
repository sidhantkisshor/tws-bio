// User-agent classification shared by the short-link redirect routes.
//
// Known limitation: since iPadOS 13, Safari on an iPad asks for desktop sites
// and sends the same UA as Safari on a Mac, with no iPad or Mobile token. The
// UA alone cannot tell the two apart, so those iPad clicks are stored as macOS
// desktop and the redirect treats them as a Mac (no app hand-off).

export function isIOS(userAgent: string): boolean {
  // Macintosh plus Mobile is read as an iPad, since a Mac browser never sends
  // Mobile. Default iPadOS Safari sends no Mobile token, so it is not caught
  // here: see the limitation above.
  return /iPhone|iPod/i.test(userAgent) ||
    (/iPad/i.test(userAgent)) ||
    (/Macintosh/i.test(userAgent) && /Mobile/i.test(userAgent))
}

export function isAndroid(userAgent: string): boolean {
  return /Android/i.test(userAgent)
}

// Browser detection - order matters: check specific browsers before generic ones.
// Instagram's and Facebook's in-app browsers and Samsung Internet all carry
// Chrome or Safari tokens as well, so they go first. On iOS the in-app browsers
// send no Safari token, so without these checks they would read as 'Other'.
export function getBrowser(userAgent: string): string {
  if (/Instagram/.test(userAgent)) return 'Instagram'
  if (/FBAN|FBAV|FB_IAB/.test(userAgent)) return 'Facebook'
  if (/SamsungBrowser/.test(userAgent)) return 'Samsung Internet'
  if (userAgent.includes('Edg')) return 'Edge'
  if (userAgent.includes('OPR') || userAgent.includes('Opera')) return 'Opera'
  if (userAgent.includes('Chrome') || userAgent.includes('CriOS')) return 'Chrome'
  if (userAgent.includes('Firefox') || userAgent.includes('FxiOS')) return 'Firefox'
  if (userAgent.includes('Safari')) return 'Safari'
  return 'Other'
}

export function getOS(userAgent: string): string {
  if (isIOS(userAgent)) return 'iOS'
  if (isAndroid(userAgent)) return 'Android'
  if (userAgent.includes('Windows')) return 'Windows'
  if (userAgent.includes('Mac')) return 'macOS'
  // ChromeOS sends "X11; CrOS" and no Linux token, so it needs its own check.
  if (userAgent.includes('CrOS')) return 'ChromeOS'
  if (userAgent.includes('Linux')) return 'Linux'
  return 'Other'
}

export function getDevice(userAgent: string): 'desktop' | 'mobile' | 'tablet' {
  // Check tablet patterns first (iPad, Android tablet)
  if (/iPad/i.test(userAgent)) return 'tablet'
  if (/Macintosh/i.test(userAgent) && /Mobile/i.test(userAgent)) return 'tablet'
  if (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent)) return 'tablet'
  if (/Tablet/i.test(userAgent)) return 'tablet'
  // Then mobile
  if (/Mobile|iPhone|iPod|Android.*Mobile/i.test(userAgent)) return 'mobile'
  return 'desktop'
}
