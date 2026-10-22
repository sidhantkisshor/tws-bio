'use client'

import type { ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useLinks } from '@/hooks/useLinks'
import { CreateLinkForm } from '@/components/CreateLinkForm'
import { LinksList } from '@/components/LinksList'
import { Toaster } from '@/components/ui/sonner'

interface HomeInteractiveProps {
  /**
   * The signed-out view, rendered on the server: the closed door and the Unlock access
   * panel. It is the static HTML of the page and shows while auth resolves, so
   * a follower on a slow phone reads it before any script runs.
   */
  children: ReactNode
}

/**
 * The client boundary of the home page. A signed-in owner gets the create
 * form and their recent links; everyone else keeps the server-rendered
 * signed-out view. useAuth reads the session cookie first, so an anonymous
 * visitor settles to signed-out without loading supabase-js. An owner sees the
 * signed-out view for a moment on load, until the session is read.
 */
export function HomeInteractive({ children }: HomeInteractiveProps) {
  const { user, loading: authLoading } = useAuth()
  // Single links fetch for the page, gated on auth resolution; the form
  // prepends newly created links so the list updates without a refetch.
  // Signed out, it still lists links this browser made anonymously before
  // migration 019 (get_links_by_ids), and fetches nothing when there are none.
  const {
    links,
    loading: linksLoading,
    error: linksError,
    addLink,
    retry: retryLinks,
  } = useLinks(user?.id, authLoading)

  const list = (
    <LinksList
      user={user}
      authLoading={authLoading}
      links={links}
      linksLoading={linksLoading}
      linksError={linksError}
      onRetry={retryLinks}
    />
  )

  return (
    <>
      <div
        className={
          user
            ? 'mx-auto w-full max-w-[1280px] px-4 pt-7 pb-12 md:px-10 md:pt-10 md:pb-16'
            : 'mx-auto w-full max-w-[1280px] px-4 pt-10 pb-12 md:px-10 md:pt-14 lg:pt-[88px] lg:pb-[88px]'
        }
      >
        {user ? (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-12">
            <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
              <div className="grid gap-2">
                <h1 className="type-title text-ink">New link</h1>
                <p className="text-sm text-text-2">The link works as soon as you save it.</p>
              </div>
              <CreateLinkForm onCreated={addLink} showHeader={false} />
            </div>
            {list}
          </div>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-12">
            {children}
            {list}
          </div>
        )}
      </div>
      {/* CreateLinkForm and the Google button toast. Kept outside the grid:
          sonner always renders a (possibly empty) section, which would add a
          gap there. */}
      <Toaster />
    </>
  )
}
