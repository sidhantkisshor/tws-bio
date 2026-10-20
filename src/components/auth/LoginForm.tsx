'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { GoogleAuthButton } from '@/components/auth/GoogleAuthButton'

const ALERT_CLASS = 'rounded-ctl border border-neg px-3 py-2.5 text-[13px] leading-normal text-neg'

/**
 * Surfaces ?error=auth_failed set by src/app/auth/callback/route.ts when the
 * PKCE code exchange fails. The query key is a contract with that route:
 * change both together or neither. useSearchParams must render inside a
 * Suspense boundary so the page stays statically prerenderable.
 *
 * Signups are disabled on the project, so a Google account with no
 * provisioned user also lands here. Retrying cannot fix that, hence the
 * invite-only hint instead of "Try again".
 */
function CallbackErrorAlert() {
  const searchParams = useSearchParams()

  if (searchParams.get('error') !== 'auth_failed') return null

  return (
    <div role="alert" className={ALERT_CLASS}>
      Google sign-in did not complete. Sidhant creates each account, so if you do not have one
      yet, ask him for it.
    </div>
  )
}

/**
 * The sign-in form: Google first, then email and password, then the one amber
 * Sign in. Each pending action disables the other, so a visitor cannot start
 * both at once.
 */
export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googlePending, setGooglePending] = useState(false)
  // Shown inline, next to the fields, until the visitor edits one: a toast
  // vanishes before a failed sign-in can be read and fixed.
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Lazy import keeps @supabase/* out of this static page's first-load JS.
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) throw signInError

      // Success: stay disabled through the redirect. Loading resets only on failure.
      router.push('/dashboard')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to log in')
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-4">
      <Suspense fallback={null}>
        <CallbackErrorAlert />
      </Suspense>

      <GoogleAuthButton
        disabled={loading}
        errorMessage="Failed to log in with Google"
        onPendingChange={setGooglePending}
      />

      <div className="flex items-center gap-3 text-xs text-text-3 before:flex-1 before:border-t before:border-rule before:content-[''] after:flex-1 after:border-t after:border-rule after:content-['']">
        or with email
      </div>

      <form onSubmit={handleLogin} className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@tradingwithsidhant.com"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError(null)
            }}
            aria-invalid={!!error}
            aria-describedby={error ? 'login-error' : undefined}
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError(null)
            }}
            aria-invalid={!!error}
            aria-describedby={error ? 'login-error' : undefined}
          />
        </div>

        {error && (
          <div id="login-error" role="alert" className={ALERT_CLASS}>
            {error}
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={loading || googlePending}
          aria-busy={loading}
          className="w-full"
        >
          {loading && <Loader2 aria-hidden className="size-4 animate-spin" />}
          {loading ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
    </div>
  )
}
