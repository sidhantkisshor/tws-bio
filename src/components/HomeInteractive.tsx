'use client'

import { useAuth } from '@/hooks/useAuth'
import { useLinks } from '@/hooks/useLinks'
import { CreateLinkForm } from '@/components/CreateLinkForm'
import { LinksList } from '@/components/LinksList'

export function HomeInteractive() {
  const { user, loading: authLoading } = useAuth()
  const { links, loading: linksLoading, addLink } = useLinks(user)

  return (
    <>
      <CreateLinkForm user={user} onLinkCreated={addLink} />
      <LinksList user={user} links={links} loading={linksLoading || authLoading} />
    </>
  )
}
