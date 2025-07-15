import { NextRequest } from 'next/server'

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

const store: RateLimitStore = {}

export function rateLimit(options: {
  interval: number // Time window in ms
  limit: number // Max requests per interval
}) {
  return {
    check: (request: NextRequest, identifier?: string): boolean => {
      const now = Date.now()
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                 request.headers.get('x-real-ip') || 
                 'anonymous'
      const key = identifier || ip
      
      // Clean up old entries
      Object.keys(store).forEach(k => {
        if (store[k].resetTime < now) {
          delete store[k]
        }
      })
      
      if (!store[key] || store[key].resetTime < now) {
        store[key] = {
          count: 1,
          resetTime: now + options.interval
        }
        return true
      }
      
      if (store[key].count >= options.limit) {
        return false
      }
      
      store[key].count++
      return true
    }
  }
}