'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { GoogleAuthButton } from '@/components/auth/GoogleAuthButton'

interface SignupFormProps {
  /** Called after signUp succeeds — the page swaps to the check-your-email state. */
  onSuccess: () => void
}

export function SignupForm({ onSuccess }: SignupFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googlePending, setGooglePending] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()

    // minLength on the input enforces this natively; guard kept for programmatic submits.
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      // Lazy import keeps @supabase/* out of this static page's first-load JS.
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) throw error

      onSuccess()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to sign up')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSignup} className="space-y-4">
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
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="password-hint"
            className="bg-muted pr-9"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 flex items-center rounded-lg px-2.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {showPassword ? (
              <EyeOff aria-hidden className="size-4" />
            ) : (
              <Eye aria-hidden className="size-4" />
            )}
          </button>
        </div>
        <p id="password-hint" className="font-mono text-xs text-muted-foreground">
          min 6 characters
        </p>
      </div>

      <Button
        type="submit"
        disabled={loading || googlePending}
        aria-busy={loading}
        className="w-full"
      >
        {loading && <Loader2 aria-hidden className="size-4 animate-spin" />}
        {loading ? 'Creating account...' : 'Sign up'}
      </Button>

      <GoogleAuthButton
        disabled={loading}
        errorMessage="Failed to sign up with Google"
        onPendingChange={setGooglePending}
      />

      <div className="text-center text-sm">
        <span className="text-muted-foreground">Already have an account? </span>
        <Link href="/login" className="font-medium text-primary-text hover:text-primary-text/80">
          Sign in
        </Link>
      </div>
    </form>
  )
}
