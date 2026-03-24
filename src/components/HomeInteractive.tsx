'use client'

import { CreateLinkForm } from '@/components/CreateLinkForm'
import { LinksList } from '@/components/LinksList'

export function HomeInteractive() {
  return (
    <div className="space-y-8">
      <CreateLinkForm />
      <LinksList />
    </div>
  )
}
