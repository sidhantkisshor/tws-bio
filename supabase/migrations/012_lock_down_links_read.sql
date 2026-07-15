-- Migration 012: Lock down anonymous reads of the links table (fixes H-2 / G-3)
--
-- ============================================================================
-- WARNING: APPLY THIS MIGRATION BEFORE DEPLOYING THE PAIRED route.ts CHANGE.
-- ============================================================================
-- The live "Combined view policy" on links
--   USING (is_active = true OR auth.uid() = user_id)
-- lets ANY holder of the public anon key SELECT the entire links table
-- (every active link, its original_url, deep links, etc.). This migration
-- replaces that broad anon table-read with a single-row SECURITY DEFINER
-- lookup used by the redirect handler.
--
-- AFTER this migration, anonymous clients can NO LONGER enumerate links via a
-- direct SELECT. The redirect path MUST call public.get_link_by_short_code()
-- instead of selecting from the table. Deploy order:
--   1) apply this migration, 2) deploy the route.ts change that uses the RPC.
-- If code is deployed first, redirects will break (owner-only SELECT policy).

-- ============================================================================
-- 1. Single-row lookup RPC for the (anonymous) redirect path
-- ============================================================================
-- NOTE: RETURNS SETOF (not scalar `RETURNS links`). A scalar composite-returning
-- function yields a single all-NULL row on no match, which PostgREST surfaces as a
-- truthy object with null fields — that would defeat the redirect handler's
-- `if (!link) return 404` guard. SETOF yields zero rows (an empty array) on no
-- match, so a missing/inactive short code correctly 404s.
CREATE OR REPLACE FUNCTION public.get_link_by_short_code(p_short_code text)
RETURNS SETOF public.links
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
STABLE
AS $$
  SELECT * FROM public.links
  WHERE short_code = p_short_code AND is_active = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_link_by_short_code(text) TO anon, authenticated;

-- ============================================================================
-- 2. Replace the broad SELECT policy with an owner-only policy
-- ============================================================================
-- Current live SELECT policy is "Combined view policy" (migrations 003 + 005).
-- The original "Users can view own links" (migration 001) was dropped in 003/005
-- but is dropped again here defensively in case an environment still has it.
DROP POLICY IF EXISTS "Combined view policy" ON public.links;
DROP POLICY IF EXISTS "Users can view own links" ON public.links;

CREATE POLICY "Owners can view their links" ON public.links
  FOR SELECT USING (auth.uid() = user_id);
