import type { Metadata } from 'next'
import { AuthShell } from '@/components/auth/AuthShell'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata: Metadata = {
  title: 'Sign in - tws.bio',
  description: 'Sign in to manage your short links and analytics.',
}

export default function LoginPage() {
  return (
    <AuthShell title="Sign in" description="Welcome back — manage your links and analytics.">
      <LoginForm />
    </AuthShell>
  )
}
