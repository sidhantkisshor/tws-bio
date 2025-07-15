"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";
import { Button } from "../../../components/ui/button";
import { generateShortCode, getShortUrl } from "../../../lib/utils";
import QRCode from "react-qr-code";

export default function CreateLinkPage() {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [linkType, setLinkType] = useState<"url" | "deep_link">("url");
  const [iosDeepLink, setIosDeepLink] = useState("");
  const [androidDeepLink, setAndroidDeepLink] = useState("");
  const [fallbackUrl, setFallbackUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<any>(null);
  
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate URL
      new URL(url);

      // Generate or use custom short code
      const shortCode = customCode || generateShortCode();

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("You must be logged in to create links");
      }

      // Create the link
      const { data, error: createError } = await supabase
        .from("links")
        .insert({
          user_id: user.id,
          short_code: shortCode,
          original_url: url,
          title: title || null,
          description: description || null,
          link_type: linkType,
          ios_deep_link: iosDeepLink || null,
          android_deep_link: androidDeepLink || null,
          fallback_url: fallbackUrl || null,
        })
        .select()
        .single();

      if (createError) {
        if (createError.code === "23505") {
          throw new Error("This short code is already taken. Please try another.");
        }
        throw createError;
      }

      setCreatedLink(data);
    } catch (err: any) {
      setError(err.message || "Failed to create link");
    } finally {
      setLoading(false);
    }
  };

  if (createdLink) {
    const shortUrl = getShortUrl(createdLink.short_code);
    
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-100">
        <nav className="border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
          <div className="container flex h-16 items-center justify-between px-4">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
                tws.bio
              </span>
            </Link>
          </div>
        </nav>

        <main className="container max-w-2xl px-4 py-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Link Created Successfully!</h1>
            
            <div className="bg-white border rounded-lg p-6 mb-6">
              <p className="text-lg font-semibold text-blue-600 mb-2">{shortUrl}</p>
              <p className="text-sm text-gray-500">{createdLink.original_url}</p>
            </div>

            <div className="bg-white p-4 rounded-lg inline-block mb-6">
              <QRCode value={shortUrl} size={200} />
            </div>

            <div className="flex gap-4 justify-center">
              <Button onClick={() => navigator.clipboard.writeText(shortUrl)}>
                Copy Link
              </Button>
              <Link href="/dashboard">
                <Button variant="outline">Back to Dashboard</Button>
              </Link>
              <Button
                variant="ghost"
                onClick={() => {
                  setCreatedLink(null);
                  setUrl("");
                  setTitle("");
                  setDescription("");
                  setCustomCode("");
                  setLinkType("url");
                  setIosDeepLink("");
                  setAndroidDeepLink("");
                  setFallbackUrl("");
                }}
              >
                Create Another
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-100">
      <nav className="border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
              tws.bio
            </span>
          </Link>
        </div>
      </nav>

      <main className="container max-w-2xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Create New Link</h1>
          <p className="text-gray-500 mt-2">
            Shorten your URL and track its performance
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="url" className="block text-sm font-medium mb-2">
              Destination URL *
            </label>
            <input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://example.com"
            />
          </div>

          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-2">
              Title (optional)
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="My awesome link"
            />
          </div>

          <div>
            <label htmlFor="customCode" className="block text-sm font-medium mb-2">
              Custom Short Code (optional)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                {process.env.NEXT_PUBLIC_SHORT_DOMAIN}/
              </span>
              <input
                id="customCode"
                type="text"
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="my-custom-link"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Leave blank to generate automatically
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Link Type
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="url"
                  checked={linkType === "url"}
                  onChange={(e) => setLinkType(e.target.value as "url")}
                  className="mr-2"
                />
                Standard URL
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="deep_link"
                  checked={linkType === "deep_link"}
                  onChange={(e) => setLinkType(e.target.value as "deep_link")}
                  className="mr-2"
                />
                Mobile Deep Link
              </label>
            </div>
          </div>

          {linkType === "deep_link" && (
            <>
              <div>
                <label htmlFor="iosDeepLink" className="block text-sm font-medium mb-2">
                  iOS Deep Link
                </label>
                <input
                  id="iosDeepLink"
                  type="text"
                  value={iosDeepLink}
                  onChange={(e) => setIosDeepLink(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="myapp://path/to/content"
                />
              </div>

              <div>
                <label htmlFor="androidDeepLink" className="block text-sm font-medium mb-2">
                  Android Deep Link
                </label>
                <input
                  id="androidDeepLink"
                  type="text"
                  value={androidDeepLink}
                  onChange={(e) => setAndroidDeepLink(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="myapp://path/to/content"
                />
              </div>

              <div>
                <label htmlFor="fallbackUrl" className="block text-sm font-medium mb-2">
                  Fallback URL (if app not installed)
                </label>
                <input
                  id="fallbackUrl"
                  type="url"
                  value={fallbackUrl}
                  onChange={(e) => setFallbackUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://app-store-link.com"
                />
              </div>
            </>
          )}

          <div className="flex gap-4">
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Link"}
            </Button>
            <Link href="/dashboard">
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
} 