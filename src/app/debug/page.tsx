"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function DebugPage() {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<any[]>([]);
  const [error, setError] = useState('');
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Get session
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        
        // Get user
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
        
        // Try to fetch links
        if (user) {
          const { data, error } = await supabase
            .from('links')
            .select('*')
            .eq('user_id', user.id)
            .limit(5);
          
          if (error) {
            setError(`Links fetch error: ${error.message}`);
          } else {
            setLinks(data || []);
          }
        }
      } catch (err: any) {
        setError(`Error: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Debug Information</h1>
        
        {/* Auth Status */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Authentication Status</h2>
          <div className="space-y-2">
            <p><strong>Logged In:</strong> {user ? 'Yes' : 'No'}</p>
            <p><strong>User ID:</strong> {user?.id || 'None'}</p>
            <p><strong>Email:</strong> {user?.email || 'None'}</p>
            <p><strong>Session:</strong> {session ? 'Active' : 'None'}</p>
          </div>
        </div>

        {/* Environment */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Environment Variables</h2>
          <div className="space-y-2 font-mono text-sm">
            <p><strong>NEXT_PUBLIC_SUPABASE_URL:</strong> {process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set ✓' : 'Missing ✗'}</p>
            <p><strong>NEXT_PUBLIC_SUPABASE_ANON_KEY:</strong> {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set ✓' : 'Missing ✗'}</p>
            <p><strong>NEXT_PUBLIC_APP_URL:</strong> {process.env.NEXT_PUBLIC_APP_URL || 'Not set'}</p>
            <p><strong>NEXT_PUBLIC_SHORT_DOMAIN:</strong> {process.env.NEXT_PUBLIC_SHORT_DOMAIN || 'Not set'}</p>
          </div>
        </div>

        {/* Links */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Your Links ({links.length})</h2>
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          )}
          {links.length > 0 ? (
            <ul className="space-y-2">
              {links.map((link) => (
                <li key={link.id} className="border-b pb-2">
                  <p className="font-mono text-blue-600">{link.short_code}</p>
                  <p className="text-sm text-gray-600">{link.original_url}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">No links found</p>
          )}
        </div>

        {/* Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Actions</h2>
          <div className="space-y-4">
            <div className="flex gap-4">
              <Link href="/" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                Go to Homepage
              </Link>
              <Link href="/dashboard" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                Go to Dashboard
              </Link>
              <Link href="/login" className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">
                Go to Login
              </Link>
            </div>
            
            {user && (
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 w-full"
              >
                Force Logout
              </button>
            )}
            
            <button
              onClick={() => window.location.reload()}
              className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 w-full"
            >
              Hard Refresh Page
            </button>
          </div>
        </div>

        {/* Deployment Info */}
        <div className="mt-6 text-sm text-gray-600">
          <p>Page generated at: {new Date().toISOString()}</p>
          <p>If you don't see recent changes, the deployment might not have completed.</p>
        </div>
      </div>
    </div>
  );
}