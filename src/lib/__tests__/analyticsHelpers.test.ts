import { describe, expect, it, vi } from 'vitest'
import { isUuid, priorWindowTotal } from '@/lib/analytics'

// analytics.ts also holds the RPC helpers, which import the request-scoped
// Supabase client. These specs only cover the pure helpers.
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  getAuthenticatedUser: vi.fn(),
}))

describe('isUuid', () => {
  it('accepts the ids Postgres hands out, in either case', () => {
    expect(isUuid('6f1c2e9a-3b4d-4c5e-8f60-718293a4b5c6')).toBe(true)
    expect(isUuid('6F1C2E9A-3B4D-4C5E-8F60-718293A4B5C6')).toBe(true)
  })

  it('accepts any version, not only the v4 ids gen_random_uuid() makes', () => {
    expect(isUuid('00000000-0000-0000-0000-000000000000')).toBe(true)
    expect(isUuid('01890a5d-ac96-774b-bcce-b302099a8057')).toBe(true)
  })

  it('refuses anything a uuid column would reject or a route could carry by mistake', () => {
    const malformed = [
      '',
      'abc',
      'undefined',
      '6f1c2e9a3b4d4c5e8f60718293a4b5c6',
      '{6f1c2e9a-3b4d-4c5e-8f60-718293a4b5c6}',
      '6f1c2e9a-3b4d-4c5e-8f60-718293a4b5c',
      '6f1c2e9a-3b4d-4c5e-8f60-718293a4b5c6a',
      '6f1c2e9g-3b4d-4c5e-8f60-718293a4b5c6',
      ' 6f1c2e9a-3b4d-4c5e-8f60-718293a4b5c6',
      '6f1c2e9a-3b4d-4c5e-8f60-718293a4b5c6\n',
      '6f1c2e9a-3b4d-4c5e-8f60-718293a4b5c6/edit',
    ]
    for (const value of malformed) {
      expect(isUuid(value)).toBe(false)
    }
  })
})

describe('priorWindowTotal', () => {
  const ok = (data: number) => ({ data, error: false })
  const failed = { data: 0, error: true }

  it('is the combined count minus the current one', () => {
    expect(priorWindowTotal(ok(15), ok(5))).toBe(10)
    expect(priorWindowTotal(ok(5), ok(5))).toBe(0)
    expect(priorWindowTotal(ok(0), ok(0))).toBe(0)
  })

  it('never goes below zero when a click lands between the two counts', () => {
    expect(priorWindowTotal(ok(5), ok(6))).toBe(0)
  })

  it('is null when either count failed, so no trend uses a fake zero', () => {
    expect(priorWindowTotal(failed, ok(5))).toBeNull()
    expect(priorWindowTotal(ok(15), failed)).toBeNull()
    expect(priorWindowTotal(failed, failed)).toBeNull()
  })

  it('is null when there is no prior window (all time)', () => {
    expect(priorWindowTotal(null, ok(5))).toBeNull()
  })
})
