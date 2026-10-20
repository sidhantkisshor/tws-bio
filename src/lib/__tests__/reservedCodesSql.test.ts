import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { RESERVED_SHORT_CODES } from '@/lib/shortCodes'

const MIGRATIONS_DIR = path.resolve(__dirname, '../../../supabase/migrations')
const ADD_CONSTRAINT = 'ADD CONSTRAINT short_code_not_reserved'
const EXPECTED = [...RESERVED_SHORT_CODES].sort()

const withoutComments = (sql: string) => sql.replace(/--[^\n]*/g, '')

// A new route means a new migration that drops and re-adds the constraint
// (027 says so), so the list that counts is the one in the last migration, in
// apply order, that adds it. Today that is 027.
function latestConstraintMigration(): string {
  const sources = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8'))
    .filter((sql) => withoutComments(sql).includes(ADD_CONSTRAINT))
  expect(sources.length).toBeGreaterThan(0)
  return sources[sources.length - 1]
}

function quotedValues(list: string): string[] {
  return Array.from(list.matchAll(/'([^']*)'/g), (match) => match[1])
}

describe('short_code_not_reserved check constraint', () => {
  it('refuses exactly RESERVED_SHORT_CODES, compared lowercased', () => {
    // Only the statement decides what the database refuses, so read it with
    // the comments stripped.
    const match = withoutComments(latestConstraintMigration()).match(
      /ADD CONSTRAINT short_code_not_reserved\s+CHECK \(lower\(short_code\) <> ALL \(ARRAY\[([^\]]*)\]\)\)/
    )
    expect(match).not.toBeNull()
    expect(quotedValues(match?.[1] ?? '').sort()).toEqual(EXPECTED)
  })

  it('repeats the same codes in every list in that migration', () => {
    // The preflight query in the header has its own copy. If that one drifts,
    // the owner can apply the constraint over a row it then blocks on every
    // update, the click counter included.
    const lists = Array.from(latestConstraintMigration().matchAll(/ARRAY\[([^\]]*)\]/g), (match) =>
      quotedValues(match[1])
    )
    expect(lists.length).toBeGreaterThanOrEqual(2)
    for (const codes of lists) {
      expect(new Set(codes).size).toBe(codes.length)
      expect([...codes].sort()).toEqual(EXPECTED)
    }
  })
})
