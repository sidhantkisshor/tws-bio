-- Migration 030: Link insight RPCs (click heatmap and period-over-period counts)
--
-- APPLIED to production on 2026-10-20 through the Supabase MCP (preflight and verify passed: invoker, search_path=public, anon cannot execute, authenticated can).
-- Before re-running anywhere else, run the preflight below: the remote has drifted from these files before (CLAUDE.md).
--
-- What changes: two new read-only functions. Nothing existing is touched.
--   1. get_click_heatmap(p_link_ids, p_since): clicks grouped by India weekday
--      (0 = Monday ... 6 = Sunday) and hour (0..23). Feeds the "best time to
--      post" grid (src/lib/heatmap.ts).
--   2. get_link_click_windows(p_link_ids, p_prior_since, p_since): per link,
--      clicks in the current window [p_since, now()] and in the prior window
--      [p_prior_since, p_since). Feeds the gainers, decliners and quiet links
--      lists (src/lib/movers.ts). Only links with a click in either window
--      appear; the app treats a missing link as 0 and 0.
--
-- Both follow 022: SECURITY INVOKER (the default, so the clicks RLS policy
-- still applies), STABLE, SET search_path = 'public', and a plain range on
-- clicked_at so the (link_id, clicked_at DESC) index serves it. Days and
-- hours use 'Asia/Kolkata' (IST, UTC+5:30, no daylight saving), the same zone
-- as every other chart. Naming the zone makes the result independent of the
-- session TimeZone.
--
-- Weekday: extract(isodow ...) gives 1 (Monday) to 7 (Sunday). One is
-- subtracted so the app's grid row 0 is Monday.
--
-- Grants: authenticated only. PUBLIC and anon are revoked, because a new
-- function is executable by PUBLIC by default.
--
-- PREFLIGHT (read-only)
--
-- 1. Neither function exists yet. Safe when this returns 0 rows. A row means
--    CREATE OR REPLACE would replace a different definition or add an overload
--    (PGRST203, see 010): stop and reconcile first.
--      SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
--      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--      WHERE n.nspname = 'public'
--        AND p.proname IN ('get_click_heatmap', 'get_link_click_windows');
--
-- 2. The index the windows use. Safe when idx_clicks_created_at_link_id is
--    listed as "USING btree (link_id, clicked_at DESC)".
--      SELECT indexname, indexdef FROM pg_indexes
--      WHERE schemaname = 'public' AND tablename = 'clicks' ORDER BY 1;
--
-- VERIFY after applying (run as an authenticated user, not the postgres role,
-- so RLS applies):
--   1. Two rows, prosecdef false, proconfig {search_path=public}, and no
--      EXECUTE for anon or PUBLIC:
--        SELECT p.proname, p.prosecdef, p.proconfig, p.proacl
--        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--        WHERE n.nspname = 'public'
--          AND p.proname IN ('get_click_heatmap', 'get_link_click_windows');
--   2. The heatmap adds up to the total for the same window (true):
--        SELECT COALESCE((SELECT sum(clicks) FROM public.get_click_heatmap(
--                 ARRAY(SELECT id FROM public.links), now() - interval '30 days')), 0)
--             = public.get_total_clicks(ARRAY(SELECT id FROM public.links),
--                                       now() - interval '30 days') AS heatmap_adds_up;
--   3. The windows add up to two totals (true):
--        SELECT COALESCE((SELECT sum(clicks_current) FROM public.get_link_click_windows(
--                 ARRAY(SELECT id FROM public.links),
--                 now() - interval '60 days', now() - interval '30 days')), 0)
--             = public.get_total_clicks(ARRAY(SELECT id FROM public.links),
--                                       now() - interval '30 days') AS current_adds_up;
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.get_click_heatmap(uuid[], timestamptz);
--   DROP FUNCTION IF EXISTS public.get_link_click_windows(uuid[], timestamptz, timestamptz);

BEGIN;

-- ============================================================================
-- Click heatmap (weekday x hour, India time)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_click_heatmap(
  p_link_ids uuid[],
  p_since timestamptz DEFAULT NULL
)
RETURNS TABLE(dow int, hour int, clicks bigint)
LANGUAGE sql
STABLE
SET search_path = 'public'
AS $$
  SELECT (extract(isodow FROM clicked_at AT TIME ZONE 'Asia/Kolkata')::int - 1) AS dow,
         extract(hour FROM clicked_at AT TIME ZONE 'Asia/Kolkata')::int AS hour,
         count(*) AS clicks
  FROM clicks
  WHERE link_id = ANY(p_link_ids)
    AND clicked_at >= COALESCE(p_since, '-infinity'::timestamptz)
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;

REVOKE ALL ON FUNCTION public.get_click_heatmap(uuid[], timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_click_heatmap(uuid[], timestamptz) TO authenticated;

-- ============================================================================
-- Clicks per link in two back-to-back windows
-- ============================================================================
-- Reads only clicked_at >= p_prior_since. A click after now() (clock skew) is
-- in neither window.
CREATE OR REPLACE FUNCTION public.get_link_click_windows(
  p_link_ids uuid[],
  p_prior_since timestamptz,
  p_since timestamptz
)
RETURNS TABLE(link_id uuid, clicks_current bigint, clicks_prior bigint)
LANGUAGE sql
STABLE
SET search_path = 'public'
AS $$
  SELECT c.link_id,
         count(*) FILTER (WHERE c.clicked_at >= p_since AND c.clicked_at <= now()) AS clicks_current,
         count(*) FILTER (WHERE c.clicked_at < p_since) AS clicks_prior
  FROM clicks c
  WHERE c.link_id = ANY(p_link_ids)
    AND c.clicked_at >= p_prior_since
  GROUP BY c.link_id;
$$;

REVOKE ALL ON FUNCTION public.get_link_click_windows(uuid[], timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_link_click_windows(uuid[], timestamptz, timestamptz) TO authenticated;

-- A leftover overload on the remote would make PostgREST refuse the call
-- (PGRST203, see 010).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('get_click_heatmap', 'get_link_click_windows')
    GROUP BY p.proname
    HAVING count(*) <> 1
  ) THEN
    RAISE EXCEPTION 'A link insight RPC has a second overload; see preflight 1';
  END IF;
END $$;

COMMIT;
