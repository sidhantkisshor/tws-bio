"use client";

import { useEffect, useState } from 'react';

export default function TestPage() {
  const [status, setStatus] = useState('Checking environment...');
  const [envVars, setEnvVars] = useState<any>({});

  useEffect(() => {
    // Check environment variables
    const vars = {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET',
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET',
      appUrl: process.env.NEXT_PUBLIC_APP_URL || 'NOT SET',
      shortDomain: process.env.NEXT_PUBLIC_SHORT_DOMAIN || 'NOT SET',
    };
    setEnvVars(vars);

    // Check if Supabase variables are missing
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setStatus('ERROR: Supabase environment variables are not set!');
    } else {
      setStatus('Environment variables loaded');
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Test Page - No Auth Required</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Status</h2>
          <p className={status.includes('ERROR') ? 'text-red-600 font-bold' : 'text-green-600'}>
            {status}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Environment Variables</h2>
          <div className="space-y-2 font-mono text-sm">
            <p className={envVars.supabaseUrl === 'NOT SET' ? 'text-red-600' : ''}>
              <strong>NEXT_PUBLIC_SUPABASE_URL:</strong> {envVars.supabaseUrl}
            </p>
            <p className={envVars.supabaseKey === 'NOT SET' ? 'text-red-600' : ''}>
              <strong>NEXT_PUBLIC_SUPABASE_ANON_KEY:</strong> {envVars.supabaseKey}
            </p>
            <p className={envVars.appUrl === 'NOT SET' ? 'text-red-600' : ''}>
              <strong>NEXT_PUBLIC_APP_URL:</strong> {envVars.appUrl}
            </p>
            <p className={envVars.shortDomain === 'NOT SET' ? 'text-red-600' : ''}>
              <strong>NEXT_PUBLIC_SHORT_DOMAIN:</strong> {envVars.shortDomain}
            </p>
          </div>
        </div>

        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 p-4 rounded">
          <h3 className="font-bold mb-2">If stuck on loading:</h3>
          <ol className="list-decimal list-inside space-y-1">
            <li>Check if environment variables are set in Vercel</li>
            <li>Verify Supabase project is running</li>
            <li>Check browser console for errors (F12)</li>
            <li>Try clearing browser cache and cookies</li>
          </ol>
        </div>

        <div className="mt-6 space-y-4">
          <a 
            href="/" 
            className="block w-full text-center bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Go to Homepage (might load)
          </a>
          
          <button
            onClick={() => {
              // Clear all localStorage and sessionStorage
              localStorage.clear();
              sessionStorage.clear();
              // Clear cookies
              document.cookie.split(";").forEach((c) => {
                document.cookie = c
                  .replace(/^ +/, "")
                  .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
              });
              alert('Cleared all local data. Refreshing...');
              window.location.href = '/';
            }}
            className="block w-full bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Clear All Data & Refresh
          </button>
        </div>
      </div>
    </div>
  );
}