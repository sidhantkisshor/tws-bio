import { LinkIcon, Smartphone } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Database } from '@/types/database'

type LinkRow = Database['public']['Tables']['links']['Row']

// Shared across the Links table, the Overview's Recent Links table and the
// home page's link list, so link type reads identically everywhere: a neutral
// outline+icon chip in the muted text color, since type is secondary metadata.
// No "use client" here: Badge renders safely on the server, so this stays
// usable from both server and client components.
export function TypeBadge({ type }: { type: LinkRow['link_type'] }) {
  const isDeepLink = type === 'deep_link'
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      {isDeepLink ? <Smartphone className="size-3" /> : <LinkIcon className="size-3" />}
      {isDeepLink ? 'Deep Link' : 'URL'}
    </Badge>
  )
}
