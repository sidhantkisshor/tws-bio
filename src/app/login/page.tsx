import type { Metadata } from 'next'
import { AuthShell } from '@/components/auth/AuthShell'
import { SignInPanel } from '@/components/auth/SignInPanel'
import { Toaster } from '@/components/ui/sonner'

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to tws.bio, the link tool of the Trading with Sidhant team.',
}

export default function LoginPage() {
  return (
    <>
      <AuthShell>
        <SignInPanel headingLevel={1} />
      </AuthShell>
      {/* LoginForm and its Google button toast. The Toaster lives on this page,
          not in AuthShell, because /signup (the other AuthShell page) never
          toasts and should not ship sonner. */}
      <Toaster />
    </>
  )
}
