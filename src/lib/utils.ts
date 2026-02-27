import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateShortCode(length: number = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export function getShortUrl(shortCode: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')
  return `${baseUrl}/${shortCode}`
}

const BLOCKED_HOSTNAMES = /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|0\.0\.0\.0|\[::1\]|\[::0\])$/i

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    // Only allow http and https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false
    }
    // Block internal/private network targets (SSRF prevention)
    if (BLOCKED_HOSTNAMES.test(parsed.hostname)) {
      return false
    }
    // Length limit
    if (url.length > 2048) {
      return false
    }
    return true
  } catch {
    return false
  }
}