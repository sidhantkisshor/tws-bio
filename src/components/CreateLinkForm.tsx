'use client';

import { useState } from 'react';
import { createClient } from '../lib/supabase/client';
import { generateShortCode } from '../lib/utils';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';

type CreateLinkFormProps = {
  user: User | null;
  onLinkCreated: (newLink: any) => void;
};

export function CreateLinkForm({ user, onLinkCreated }: CreateLinkFormProps) {
  const [url, setUrl] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!url) {
      setError('Please enter a URL to shorten.');
      return;
    }
    try {
      new URL(url);
    } catch (err) {
      setError('Please enter a valid URL.');
      return;
    }

    setLoading(true);

    try {
      const shortCode = customCode || generateShortCode();
      
      const { data, error: rpcError } = await supabase.rpc('create_link', {
        p_short_code: shortCode,
        p_original_url: url,
        p_user_id: user?.id,
      });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      const newLink = { ...data, short_code: shortCode, original_url: url, created_at: new Date().toISOString() };
      onLinkCreated(newLink);

      setUrl('');
      setCustomCode('');
      setSuccessMessage(`Link created! Copied to clipboard.`);
      navigator.clipboard.writeText(`${window.location.origin}/${shortCode}`);
      
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      console.error('Error creating link:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-8 mb-8 border border-gray-100">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Create a Short Link</h2>
      <p className="text-gray-500 mb-6">Enter your long URL to get started.</p>

      {!user && (
        <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-400 text-blue-800">
          <p className="font-semibold">You are not logged in.</p>
          <p className="text-sm mt-1">
            <Link href="/login" className="font-bold underline hover:text-blue-600">Login</Link> or{' '}
            <Link href="/signup" className="font-bold underline hover:text-blue-600">Sign Up</Link> to save, track, and manage your links.
          </p>
        </div>
      )}
      {error && <div className="mb-4 p-3 bg-red-50 text-red-600 font-medium rounded-lg">{error}</div>}
      {successMessage && <div className="mb-4 p-3 bg-green-50 text-green-600 font-medium rounded-lg">{successMessage}</div>}
      
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">
            Destination URL
          </label>
          <input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/my-long-url-to-shorten"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            required
          />
        </div>
        <div>
          <label htmlFor="customCode" className="block text-sm font-medium text-gray-700 mb-1">
            Custom back-half (optional)
          </label>
          <div className="flex items-center">
            <span className="text-gray-500 bg-gray-100 px-4 py-2.5 rounded-l-lg border border-r-0 border-gray-300">tws.bio/</span>
            <input
              id="customCode"
              type="text"
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="my-cool-link"
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span className="ml-2">Creating...</span>
            </div>
          ) : 'Create Link'}
        </button>
      </form>
    </div>
  );
} 