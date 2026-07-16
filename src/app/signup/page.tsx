'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AuthShell } from '@/components/auth/AuthShell'
import { SignupForm } from '@/components/auth/SignupForm'
import { CardContent } from '@/components/ui/card'

export default function SignupPage() {
  const [success, setSuccess] = useState(false)

  if (success) {
    return (
      <AuthShell>
        <CardContent className="text-center">
          <div className="mb-4">
            <svg
              aria-hidden
              className="mx-auto h-12 w-12 text-primary-text"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Check your email</h2>
          <p className="text-muted-foreground mb-6">
            We&apos;ve sent you a confirmation link. Please check your email to verify your account.
          </p>
          <Link
            href="/login"
            className="font-medium text-primary-text hover:text-primary-text/80"
          >
            Return to login
          </Link>
        </CardContent>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Create account"
      description="Free short links with analytics and deep linking."
    >
      <SignupForm onSuccess={() => setSuccess(true)} />
    </AuthShell>
  )
}
