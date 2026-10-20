import { describe, it, expect } from 'vitest'
import { hasSupabaseSessionCookie } from '../useAuth'

// A realistic value: @supabase/ssr writes base64url-encoded JSON behind a
// "base64-" prefix, which can itself contain '='.
const TOKEN = 'base64-eyJhY2Nlc3NfdG9rZW4iOiJhYmMifQ=='

describe('hasSupabaseSessionCookie', () => {
  it('is false for an empty cookie string', () => {
    expect(hasSupabaseSessionCookie('')).toBe(false)
  })

  it('is false when only unrelated cookies are set', () => {
    expect(hasSupabaseSessionCookie('theme=dark; _ga=GA1.1.123')).toBe(false)
  })

  it('finds a single, unchunked session cookie', () => {
    expect(hasSupabaseSessionCookie(`sb-abcdefghij-auth-token=${TOKEN}`)).toBe(true)
  })

  it('finds the session cookie among others, with or without a space after ;', () => {
    expect(hasSupabaseSessionCookie(`a=1; sb-abcdefghij-auth-token=${TOKEN}; b=2`)).toBe(true)
    expect(hasSupabaseSessionCookie(`a=1;sb-abcdefghij-auth-token=${TOKEN};b=2`)).toBe(true)
    expect(hasSupabaseSessionCookie(` sb-abcdefghij-auth-token=${TOKEN}`)).toBe(true)
  })

  it('finds a session split into .0 and .1 chunks', () => {
    expect(
      hasSupabaseSessionCookie('sb-abcdefghij-auth-token.0=base64-eyJh; sb-abcdefghij-auth-token.1=Y2Nlc3Mi')
    ).toBe(true)
  })

  it('treats any numbered chunk as a session cookie', () => {
    expect(hasSupabaseSessionCookie('sb-abcdefghij-auth-token.1=Y2Nlc3Mi')).toBe(true)
  })

  it('accepts any project ref, including one taken from a custom domain', () => {
    expect(hasSupabaseSessionCookie(`sb-auth-auth-token=${TOKEN}`)).toBe(true)
  })

  it('ignores the PKCE code-verifier cookie, which exists before any session', () => {
    expect(hasSupabaseSessionCookie('sb-abcdefghij-auth-token-code-verifier=abc123')).toBe(false)
  })

  it('ignores a session cookie name with an empty value', () => {
    expect(hasSupabaseSessionCookie('sb-abcdefghij-auth-token=')).toBe(false)
    expect(hasSupabaseSessionCookie('sb-abcdefghij-auth-token=; a=1')).toBe(false)
  })

  it('ignores names that only contain the pattern', () => {
    expect(hasSupabaseSessionCookie(`xsb-abcdefghij-auth-token=${TOKEN}`)).toBe(false)
    expect(hasSupabaseSessionCookie(`sb-abcdefghij-auth-tokens=${TOKEN}`)).toBe(false)
    expect(hasSupabaseSessionCookie(`sb-abcdefghij-auth-token.x=${TOKEN}`)).toBe(false)
    expect(hasSupabaseSessionCookie(`sb--auth-token=${TOKEN}`)).toBe(false)
  })

  it('ignores the token name when it appears inside another cookie value', () => {
    expect(hasSupabaseSessionCookie(`foo=sb-abcdefghij-auth-token=${TOKEN}`)).toBe(false)
  })
})
