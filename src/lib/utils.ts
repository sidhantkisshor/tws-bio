import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { customAlphabet } from "nanoid"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateShortCode(length: number = 6): string {
  // Use nanoid with custom alphabet for URL-safe characters
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
  const customNanoid = customAlphabet(alphabet, length)
  return customNanoid()
}

export function getAbsoluteUrl(path: string = ""): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  return `${baseUrl}${path}`
}

export function getShortUrl(shortCode: string): string {
  const domain = process.env.NEXT_PUBLIC_SHORT_DOMAIN || "localhost:3000"
  const protocol = domain.includes("localhost") ? "http://" : "https://"
  return `${protocol}${domain}/${shortCode}`
}

export function parseUserAgent(userAgent: string | null) {
  if (!userAgent) return {
    device_type: 'unknown' as const,
    browser_name: null,
    os_name: null
  }

  // Simple device type detection
  let device_type: 'mobile' | 'tablet' | 'desktop' | 'bot' | 'unknown' = 'desktop'
  
  if (/bot|crawler|spider|crawling/i.test(userAgent)) {
    device_type = 'bot'
  } else if (/mobile/i.test(userAgent)) {
    device_type = 'mobile'
  } else if (/tablet|ipad/i.test(userAgent)) {
    device_type = 'tablet'
  }

  // Simple browser detection
  let browser_name = null
  if (/chrome/i.test(userAgent) && !/edge/i.test(userAgent)) {
    browser_name = 'Chrome'
  } else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) {
    browser_name = 'Safari'
  } else if (/firefox/i.test(userAgent)) {
    browser_name = 'Firefox'
  } else if (/edge/i.test(userAgent)) {
    browser_name = 'Edge'
  }

  // Simple OS detection
  let os_name = null
  if (/windows/i.test(userAgent)) {
    os_name = 'Windows'
  } else if (/mac os|macintosh/i.test(userAgent)) {
    os_name = 'macOS'
  } else if (/linux/i.test(userAgent)) {
    os_name = 'Linux'
  } else if (/android/i.test(userAgent)) {
    os_name = 'Android'
  } else if (/ios|iphone|ipad/i.test(userAgent)) {
    os_name = 'iOS'
  }

  return { device_type, browser_name, os_name }
}

export function extractUtmParams(url: string): Record<string, string | null> {
  try {
    const urlObj = new URL(url)
    return {
      utm_source: urlObj.searchParams.get('utm_source'),
      utm_medium: urlObj.searchParams.get('utm_medium'),
      utm_campaign: urlObj.searchParams.get('utm_campaign'),
      utm_term: urlObj.searchParams.get('utm_term'),
      utm_content: urlObj.searchParams.get('utm_content'),
    }
  } catch {
    return {
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_term: null,
      utm_content: null,
    }
  }
} 