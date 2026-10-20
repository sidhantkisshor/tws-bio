'use server'

import { createClient, getAuthenticatedUser } from '@/lib/supabase/server'
import { checkDestinations, type DestinationStatus } from '@/lib/destinationCheck'
import { SHORT_DOMAIN, loadOwnerLinks } from './data'

// "Check destinations now" on the Health page. It runs only when the owner
// presses the button, never on page load. The action checks the session
// again and reads the owner's own active links on the server: it takes no
// input from the browser, so it can only ever check that user's links.

export interface DestinationCheckRow {
  id: string
  shortCode: string
  url: string
  status: DestinationStatus
  httpStatus: number | null
  finalUrl: string | null
  ms: number
}

export type DestinationCheckResult =
  | { ok: true; checkedAt: string; rows: DestinationCheckRow[] }
  | { ok: false; error: string }

export async function checkDestinationsNow(): Promise<DestinationCheckResult> {
  const user = await getAuthenticatedUser()
  if (!user) return { ok: false, error: 'Your session ended. Sign in again, then run the check.' }

  const supabase = await createClient()
  const links = await loadOwnerLinks(supabase, user.id, { activeOnly: true })
  if (links.error) return { ok: false, error: 'Your links could not load. Try again in a minute.' }

  // Many links can share a destination: ask each address once.
  const urls = [...new Set(links.data.map((l) => l.original_url))]
  const results = await checkDestinations(urls, 10, { timeoutMs: 5000, shortDomain: SHORT_DOMAIN })
  const byUrl = new Map(urls.map((u, i) => [u, results[i]]))

  const rows: DestinationCheckRow[] = links.data.map((l) => {
    const r = byUrl.get(l.original_url) ?? { status: 'error' as const, ms: 0 }
    return {
      id: l.id,
      shortCode: l.short_code,
      url: l.original_url,
      status: r.status,
      httpStatus: r.httpStatus ?? null,
      finalUrl: r.finalUrl ?? null,
      ms: r.ms,
    }
  })
  return { ok: true, checkedAt: new Date().toISOString(), rows }
}
