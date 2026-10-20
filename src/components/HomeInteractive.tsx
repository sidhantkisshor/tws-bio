'use client'

import { useAuth } from '@/hooks/useAuth'
import { useLinks } from '@/hooks/useLinks'
import { CreateLinkForm } from '@/components/CreateLinkForm'
import { LinksList } from '@/components/LinksList'
import { Toaster } from '@/components/ui/sonner'

export function HomeInteractive() {
  const { user, loading: authLoading } = useAuth()
  // Single links fetch for the page, gated on auth resolution; the form
  // prepends newly created links so the list updates without a refetch.
  const {
    links,
    loading: linksLoading,
    error: linksError,
    addLink,
    retry: retryLinks,
  } = useLinks(user?.id, authLoading)

  return (
    <>
      <div className="space-y-8">
        <CreateLinkForm onCreated={addLink} />
        <LinksList
          user={user}
          authLoading={authLoading}
          links={links}
          linksLoading={linksLoading}
          linksError={linksError}
          onRetry={retryLinks}
        />
      </div>
      {/* CreateLinkForm toasts. Kept outside the space-y stack: sonner always
          renders a (possibly empty) section, which would add a gap there. */}
      <Toaster />
    </>
  )
}
