import { Badge } from '@/components/ui/badge'
import type { Database } from '@/types/database'

type LinkRow = Database['public']['Tables']['links']['Row']

// Shared across the Links table, the Overview's links table, the link detail
// page and the home page's link list, so link type reads the same everywhere.
// A Day Book badge: hairline border, secondary text, no fill and no icon.
// No "use client" here: Badge renders safely on the server, so this stays
// usable from both server and client components.
export function TypeBadge({
  type,
  className,
}: {
  type: LinkRow['link_type']
  className?: string
}) {
  return <Badge className={className}>{type === 'deep_link' ? 'App link' : 'Web link'}</Badge>
}
