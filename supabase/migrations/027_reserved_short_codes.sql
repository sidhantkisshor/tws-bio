-- Migration 027: Refuse reserved short codes in the database (audit sec-3)
--
-- NOT APPLIED as of 2026-10-19. Run the preflight below against the remote
-- database first.
--
-- What changes: adds the CHECK constraint short_code_not_reserved on links. It
-- refuses a short code that is one of the app's own top-level route names,
-- compared lowercased.
--
-- Why: Next.js serves a static route before the [shortCode] route, so a link
-- saved as /dashboard or /login is created and can never be opened. The app
-- checks the same list (RESERVED_SHORT_CODES in src/lib/shortCodes.ts) before
-- it calls the create RPCs; this constraint holds for every other write path.
-- The lists must stay equal: src/lib/__tests__/reservedCodesSql.test.ts
-- compares every list of codes in the latest migration that adds this
-- constraint with RESERVED_SHORT_CODES, and fails when one differs. A new
-- route goes into shortCodes.ts and into a new migration that drops and
-- re-adds this constraint, with its own preflight copy of the list.
--
-- Resource Drop rows ('r/<slug>') contain a slash, so they never match.
--
-- NOT VALID only skips the one-time scan of existing rows. Postgres checks a
-- CHECK constraint on every new row version, so once this is in place ANY
-- update of an old row with a reserved code fails: the click counter in
-- record_click_and_increment, a dashboard edit, and the bulk activate or
-- deactivate (one such row fails the whole batch). Some reserved codes still
-- open today and would silently stop counting clicks: 'r' and 'auth' (no page
-- of their own) and any mixed-case code such as 'Login' (Next.js routes are
-- case-sensitive, this check is not). So preflight 1 must come back empty.
--
-- PREFLIGHT (read-only)
--
-- 1. Existing rows with a reserved code. Safe when it returns no rows. Give a
--    listed row a new code first (UPDATE public.links SET short_code =
--    '<new code>' WHERE id = '<id>'), or delete it.
--      SELECT id, short_code, user_id, is_active, total_clicks, created_at
--      FROM public.links
--      WHERE lower(short_code) = ANY (ARRAY['auth', 'dashboard', 'login', 'r', 'resources',
--        'signup', 'apple-icon', 'icon', 'manifest', 'opengraph-image', 'robots', 'sitemap',
--        'twitter-image', 'admin', 'api', 'settings'])
--      ORDER BY created_at;
--
-- 2. The CHECK constraints already on links. Safe when short_code_not_reserved
--    is not among them (the DROP below would replace it).
--      SELECT conname, convalidated, pg_get_constraintdef(oid) FROM pg_constraint
--      WHERE conrelid = 'public.links'::regclass AND contype = 'c' ORDER BY 1;
--
-- AFTER applying, with preflight 1 still empty, mark it validated:
--   ALTER TABLE public.links VALIDATE CONSTRAINT short_code_not_reserved;
--
-- ROLLBACK:
--   ALTER TABLE public.links DROP CONSTRAINT IF EXISTS short_code_not_reserved;

BEGIN;

ALTER TABLE public.links
  DROP CONSTRAINT IF EXISTS short_code_not_reserved;
ALTER TABLE public.links
  ADD CONSTRAINT short_code_not_reserved
  CHECK (lower(short_code) <> ALL (ARRAY[
    -- Routes in src/app
    'auth', 'dashboard', 'login', 'r', 'resources', 'signup',
    -- Next.js metadata routes
    'apple-icon', 'icon', 'manifest', 'opengraph-image', 'robots', 'sitemap', 'twitter-image',
    -- Names an app route may want later
    'admin', 'api', 'settings'
  ]))
  NOT VALID;

COMMIT;
