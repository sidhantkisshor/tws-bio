import { describe, it, expect } from 'vitest'
import { isResourceDropSlug, resourceDropDestination, RESOURCE_DROP_BASE } from '../resourceDrop'

const qs = (s: string) => new URLSearchParams(s)

describe('isResourceDropSlug', () => {
  it('accepts the slugs the desk makes', () => {
    expect(isResourceDropSlug('10k-to-10l')).toBe(true)
    expect(isResourceDropSlug('ab')).toBe(true)
  })

  it('rejects anything that could change the path or look odd', () => {
    for (const bad of ['', 'a', '-x', 'x-', 'a--b', 'A-b', 'a/b', '..', 'a b', 'a.b', 'x'.repeat(61)]) {
      expect(isResourceDropSlug(bad), bad).toBe(false)
    }
  })
})

describe('resourceDropDestination', () => {
  it('sends a bare click to the drop page with the video named as the campaign', () => {
    const url = new URL(resourceDropDestination('10k-to-10l', qs(''))!)
    expect(url.origin + url.pathname).toBe(RESOURCE_DROP_BASE + '10k-to-10l')
    expect(url.searchParams.get('utm_source')).toBe('youtube')
    expect(url.searchParams.get('utm_medium')).toBe('tws_bio')
    expect(url.searchParams.get('utm_campaign')).toBe('10k-to-10l')
  })

  it('keeps the campaign a click arrived with instead of stamping defaults', () => {
    const url = new URL(resourceDropDestination('10k-to-10l', qs('utm_source=instagram&utm_medium=story'))!)
    expect(url.searchParams.get('utm_source')).toBe('instagram')
    expect(url.searchParams.get('utm_medium')).toBe('story')
    expect(url.searchParams.get('utm_campaign')).toBeNull()
  })

  it('carries ad click IDs and drops everything else', () => {
    const url = new URL(resourceDropDestination('10k-to-10l', qs('fbclid=abc&next=https://evil.example'))!)
    expect(url.searchParams.get('fbclid')).toBe('abc')
    expect(url.searchParams.get('next')).toBeNull()
  })

  it('never leaves the drop host, whatever the slug', () => {
    expect(resourceDropDestination('..', qs(''))).toBeNull()
    expect(resourceDropDestination('evil.example', qs(''))).toBeNull()
    const url = new URL(resourceDropDestination('x-y', qs(''))!)
    expect(url.host).toBe('twsgurukulx.com')
  })
})
