import { describe, it, expect } from 'vitest'
import { mergeAnonLinkId } from '../useLinks'

describe('mergeAnonLinkId', () => {
  it('prepends a new id (newest first)', () => {
    expect(mergeAnonLinkId(['a', 'b'], 'c', 50)).toEqual(['c', 'a', 'b'])
  })

  it('dedupes: an existing id is not duplicated and moves to the front', () => {
    expect(mergeAnonLinkId(['a', 'b', 'c'], 'b', 50)).toEqual(['b', 'a', 'c'])
  })

  it('starts from an empty list', () => {
    expect(mergeAnonLinkId([], 'a', 50)).toEqual(['a'])
  })

  it('caps at max, keeping the newest entries', () => {
    const existing = ['a', 'b', 'c']
    expect(mergeAnonLinkId(existing, 'd', 3)).toEqual(['d', 'a', 'b'])
  })

  it('re-adding an existing id at cap does not grow the list', () => {
    const existing = ['a', 'b', 'c']
    const result = mergeAnonLinkId(existing, 'c', 3)
    expect(result).toEqual(['c', 'a', 'b'])
    expect(result).toHaveLength(3)
  })
})
