import { LinkIcon, Smartphone } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Database } from '@/types/database'

type LinkRow = Database['public']['Tables']['links']['Row']

// Shared across the Links table and the Overview's Recent Links table so
// link type reads identically everywhere — a neutral outline+icon chip,
// reserving the solid brand-green fill exclusively for the Active signal
// (finding: links-type-status-badge-differentiation /
// overview-type-badge-off-brand-and-inconsistent). No "use client" here —
// Badge renders safely on the server, so this stays usable from both
// server and client components.
export function TypeBadge({ type }: { type: LinkRow['link_type'] }) {
  const isDeepLink = type === 'deep_link'
  return (
    <Badge variant="outline" className="gap-1">
      {isDeepLink ? <Smartphone className="size-3" /> : <LinkIcon className="size-3" />}
      {isDeepLink ? 'Deep Link' : 'URL'}
    </Badge>
  )
}
