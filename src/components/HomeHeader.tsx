'use client'

import { useAuth } from '@/hooks/useAuth'
import Link from 'next/link'

export function HomeHeader() {
  const { user, loading: authLoading } = useAuth()

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-gray-900">tws.bio</h1>
          </div>

          <nav className="flex items-center gap-4">
            {authLoading ? (
              <div className="h-10 w-24 bg-gray-200 rounded animate-pulse"></div>
            ) : user ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-gray-700 hover:text-gray-900 font-medium"
                >
                  Dashboard
                </Link>
                <form action="/auth/signout" method="post">
                  <button
                    type="submit"
                    className="text-gray-600 hover:text-gray-800"
                  >
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-gray-700 hover:text-gray-900 font-medium"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
                >
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  )
}
