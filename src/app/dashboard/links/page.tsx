import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getShortUrl } from '@/lib/utils'
import { LinkActions } from '@/components/dashboard/LinkActions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { LinkIcon } from 'lucide-react'

const PAGE_SIZE = 20

export default async function LinksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { page: pageParam } = await searchParams
  const requestedPage = Math.max(1, parseInt(pageParam || '1', 10) || 1)

  // Cheap count-only query to determine the valid page range up front.
  const { count } = await supabase
    .from('links')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user!.id)

  const totalPages = Math.ceil((count || 0) / PAGE_SIZE)
  // Clamp so an over-range ?page=9999 doesn't render the empty state.
  const page = Math.min(requestedPage, Math.max(1, totalPages))
  const offset = (page - 1) * PAGE_SIZE

  const { data: links } = await supabase
    .from('links')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Links</h1>
        <Link href="/dashboard/create">
          <Button>Create Link</Button>
        </Link>
      </div>

      {links && links.length > 0 ? (
        <Card className="bg-card border-border">
          {/* Desktop / tablet: full table, scoped horizontal scroll only if needed */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">Short Code</TableHead>
                  <TableHead className="px-4">Original URL</TableHead>
                  <TableHead className="px-4">Type</TableHead>
                  <TableHead className="px-4">Clicks</TableHead>
                  <TableHead className="px-4">Status</TableHead>
                  <TableHead className="px-4">Created</TableHead>
                  <TableHead className="px-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((link) => (
                  <TableRow key={link.id}>
                    <TableCell className="px-4 py-3">
                      <a
                        href={getShortUrl(link.short_code)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-primary-text hover:text-primary-text/80 hover:underline"
                      >
                        {link.short_code}
                      </a>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span className="text-sm text-muted-foreground truncate max-w-xs block">
                        {link.original_url}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {link.link_type === 'deep_link' ? (
                        <Badge variant="default">Deep Link</Badge>
                      ) : (
                        <Badge variant="secondary">URL</Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 font-mono">
                      {link.total_clicks || 0}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge variant={link.is_active ? 'default' : 'secondary'}>
                        {link.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                      {link.created_at
                        ? new Date(link.created_at).toLocaleDateString()
                        : '---'}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <LinkActions link={link} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: stacked card-per-link layout so every field and action stays on-screen */}
          <div className="md:hidden divide-y divide-border">
            {links.map((link) => (
              <div key={link.id} className="p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <a
                      href={getShortUrl(link.short_code)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-primary-text hover:text-primary-text/80 hover:underline block truncate"
                    >
                      {link.short_code}
                    </a>
                    <span className="text-sm text-muted-foreground truncate block mt-0.5">
                      {link.original_url}
                    </span>
                  </div>
                  <Badge
                    variant={link.is_active ? 'default' : 'secondary'}
                    className="shrink-0"
                  >
                    {link.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  {link.link_type === 'deep_link' ? (
                    <Badge variant="default">Deep Link</Badge>
                  ) : (
                    <Badge variant="secondary">URL</Badge>
                  )}
                  <span className="font-mono">{link.total_clicks || 0} clicks</span>
                  <span className="ml-auto">
                    {link.created_at
                      ? new Date(link.created_at).toLocaleDateString()
                      : '---'}
                  </span>
                </div>

                <div className="flex items-center justify-end -mx-1">
                  <LinkActions link={link} />
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="px-4 py-4 border-t border-border flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages} ({count} links)
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link href={`/dashboard/links?page=${page - 1}`}>
                    <Button variant="outline" size="sm">
                      Previous
                    </Button>
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={`/dashboard/links?page=${page + 1}`}>
                    <Button variant="outline" size="sm">
                      Next
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          )}
        </Card>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="rounded-full bg-muted p-3">
              <LinkIcon className="size-6 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-foreground font-medium">No links yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create your first link to get started.
              </p>
            </div>
            <Link href="/dashboard/create">
              <Button>Create Link</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
