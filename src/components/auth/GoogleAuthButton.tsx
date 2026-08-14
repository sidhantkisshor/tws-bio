'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

interface GoogleAuthButtonProps {
  /** Toast text when the OAuth call itself fails (before navigation). */
  errorMessage: string
  /** Disable while another auth action on the page is pending. */
  disabled?: boolean
  /** Reports this button's own pending state so the page can lock its form. */
  onPendingChange?: (pending: boolean) => void
}

/**
 * Shared "Or continue with" divider + Google OAuth button for login/signup.
 * signInWithOAuth navigates the whole page on success, so pending state is
 * only reset on failure — otherwise the button flickers before the redirect.
 */
export function GoogleAuthButton({ errorMessage, disabled, onPendingChange }: GoogleAuthButtonProps) {
  const [pending, setPending] = useState(false)

  const handleClick = async () => {
    setPending(true)
    onPendingChange?.(true)

    try {
      // Lazy import keeps @supabase/* out of the static auth pages' first-load JS.
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) throw error
      // Success: the browser is navigating to Google — stay pending.
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : errorMessage)
      setPending(false)
      onPendingChange?.(false)
    }
  }

  return (
    <>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <Separator />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-card text-muted-foreground">Or continue with</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={handleClick}
        disabled={disabled || pending}
        aria-busy={pending}
        className="w-full"
      >
        {pending ? (
          <Loader2 aria-hidden className="w-5 h-5 mr-2 animate-spin" />
        ) : (
          <svg aria-hidden className="w-5 h-5 mr-2" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        )}
        Continue with Google
      </Button>
    </>
  )
}
