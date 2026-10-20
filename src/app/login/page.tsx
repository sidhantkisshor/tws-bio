import type { Metadata } from 'next'
import { AuthShell } from '@/components/auth/AuthShell'
import { LoginForm } from '@/components/auth/LoginForm'
import { Toaster } from '@/components/ui/sonner'

export const metadata: Metadata = {
  title: 'Sign in - tws.bio',
  description: 'Sign in to manage your short links and analytics.',
}

export default function LoginPage() {
  return (
    <>
      <AuthShell title="Sign in" description="Welcome back. Manage your links and analytics.">
        <LoginForm />
      </AuthShell>
      {/* LoginForm and its Google button toast. The Toaster lives on this page,
          not in AuthShell, because /signup (the other AuthShell page) never
          toasts and should not ship sonner. */}
      <Toaster />
    </>
  )
}
