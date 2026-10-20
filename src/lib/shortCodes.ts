/**
 * Short codes share the URL root with the app's own routes: `/dashboard` is a
 * page, `/abc123` is a link. Next.js matches a static route before the
 * `[shortCode]` route, so a link saved under one of these names is created but
 * can never be opened. Every top-level route in src/app must be listed here
 * (src/lib/__tests__/shortCodes.test.ts enforces it), and the database keeps
 * the same list in the `short_code_not_reserved` check constraint.
 */
export const RESERVED_SHORT_CODES: ReadonlySet<string> = new Set([
  // Routes in src/app
  'auth',
  'dashboard',
  'login',
  'r',
  'resources',
  'signup',
  // Next.js metadata routes (opengraph-image.tsx today, the rest if added)
  'apple-icon',
  'icon',
  'manifest',
  'opengraph-image',
  'robots',
  'sitemap',
  'twitter-image',
  // Names an app route may want later
  'admin',
  'api',
  'settings',
])

export function isReservedShortCode(code: string): boolean {
  return RESERVED_SHORT_CODES.has(code.trim().toLowerCase())
}

/**
 * The shape every stored short code has: the create RPCs have only accepted
 * `[a-zA-Z0-9-]` since migration 007, and `chk_short_code_length` caps codes
 * at 50. A path segment outside this shape (`favicon.ico`, `wp-login.php`,
 * `.env`) cannot be a link, so the redirect answers it without a lookup.
 */
export const SHORT_CODE_PATTERN = /^[A-Za-z0-9-]{1,50}$/

export function hasShortCodeShape(code: string): boolean {
  return SHORT_CODE_PATTERN.test(code)
}
