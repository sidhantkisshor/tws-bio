"use client";

import Link from "next/link";
import { useAuth } from "../hooks/useAuth";
import { useLinks } from "../hooks/useLinks";
import { CreateLinkForm } from "../components/CreateLinkForm";
import { LinksList } from "../components/LinksList";

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const { links, loading: linksLoading, addLink } = useLinks(user);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">tws.bio</h1>
          <nav className="flex gap-4">
            {authLoading ? (
              <div className="h-8 w-24 bg-gray-200 rounded animate-pulse"></div>
            ) : user ? (
              <>
                <Link href="/dashboard" className="text-blue-600 hover:text-blue-700">
                  Dashboard
                </Link>
                <form action="/auth/signout" method="post" className="inline">
                  <button type="submit" className="text-gray-600 hover:text-gray-800">
                    Sign Out
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login" className="text-blue-600 hover:text-blue-700">
                  Login
                </Link>
                <Link href="/signup" className="text-gray-600 hover:text-gray-800">
                  Sign Up
                </Link>
              </>
            )}
          </nav>
        </header>
        
        <main>
          <CreateLinkForm user={user} onLinkCreated={addLink} />
          <LinksList 
            user={user} 
            links={links} 
            loading={linksLoading || authLoading} 
          />
        </main>
      </div>
    </div>
  );
}