// User-agent classification shared by the short-link redirect routes.

export function isIOS(userAgent: string): boolean {
  // iPadOS 13+ reports as Macintosh, detect via touch support hint in UA
  return /iPhone|iPod/i.test(userAgent) ||
    (/iPad/i.test(userAgent)) ||
    (/Macintosh/i.test(userAgent) && /Mobile/i.test(userAgent))
}

export function isAndroid(userAgent: string): boolean {
  return /Android/i.test(userAgent)
}

// Browser detection - order matters: check specific browsers before generic ones
export function getBrowser(userAgent: string): string {
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
