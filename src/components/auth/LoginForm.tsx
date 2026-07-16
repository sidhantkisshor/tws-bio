'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { CircleAlert, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { GoogleAuthButton } from '@/components/auth/GoogleAuthButton'

/**
 * Surfaces ?error=auth_failed set by src/app/auth/callback/route.ts when the
 * PKCE code exchange fails. The query key is a contract with that route —
 * change both together or neither. useSearchParams must render inside a
 * Suspense boundary so the page stays statically prerenderable.
 */
function CallbackErrorAlert() {
  const searchParams = useSearchParams()

  if (searchParams.get('error') !== 'auth_failed') return null

  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
    >
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>Google sign-in didn&apos;t complete. Try again.</span>
    </div>
  )
}

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googlePending, setGooglePending] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Lazy import keeps @supabase/* out of this static page's first-load JS.
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      // Success: stay disabled through the redirect — loading resets only on failure.
      router.push('/dashboard')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to log in')
      setLoading(false)
    }
  }

  return (
    <>
      <Suspense fallback={null}>
        <CallbackErrorAlert />
      </Suspense>

      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-muted"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-muted"
          />
        </div>

        <Button
          type="submit"
          disabled={loading || googlePending}
          aria-busy={loading}
          className="w-full"
        >
          {loading && <Loader2 aria-hidden className="size-4 animate-spin" />}
          {loading ? 'Signing in...' : 'Sign in'}
        </Button>

        <GoogleAuthButton
          disabled={loading}
          errorMessage="Failed to log in with Google"
          onPendingChange={setGooglePending}
        />

        <div className="text-center text-sm">
          <span className="text-muted-foreground">Don&apos;t have an account? </span>
          <Link href="/signup" className="font-medium text-primary-text hover:text-primary-text/80">
            Sign up
          </Link>
        </div>
      </form>
    </>
  )
}
