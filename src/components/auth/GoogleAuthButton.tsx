'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface GoogleAuthButtonProps {
  /** Toast text when the OAuth call itself fails (before navigation). */
  errorMessage: string
  /** Disable while another auth action on the page is pending. */
  disabled?: boolean
  /** Reports this button's own pending state so the page can lock its form. */
  onPendingChange?: (pending: boolean) => void
}

/**
 * Google OAuth button, the first option in the sign-in panel. An outline
 * button: the panel's one amber fill is the email Sign in. Its toasts need a
 * <Toaster /> on the page (home and /login render one). signInWithOAuth
 * navigates the whole page on success, so pending state is only reset on
 * failure: otherwise the button flickers before the redirect.
 */
export function GoogleAuthButton({ errorMessage, disabled, onPendingChange }: GoogleAuthButtonProps) {
  const [pending, setPending] = useState(false)

  const handleClick = async () => {
    setPending(true)
    onPendingChange?.(true)

    try {
      // Lazy import keeps @supabase/* out of the static pages' first-load JS.
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) throw error
      // Success: the browser is navigating to Google, so stay pending.
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : errorMessage)
      setPending(false)
      onPendingChange?.(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      onClick={handleClick}
      disabled={disabled || pending}
      aria-busy={pending}
      className="w-full"
    >
      {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
      {pending ? 'Opening Google...' : 'Continue with Google'}
    </Button>
  )
}
