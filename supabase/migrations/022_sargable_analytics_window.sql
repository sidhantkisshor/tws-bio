-- Migration 022: Index-friendly date window and IST chart days in the
-- analytics RPCs (audit db-1)
--
-- NOT APPLIED as of 2026-10-20. Run the preflight below against the remote
-- database first: the remote has drifted from these files before (CLAUDE.md).
--
-- DEPLOY ORDER: apply this right before the app deploy that moves the
-- dashboard to IST days (CHART_TIME_ZONE, rangeWindow and dayKey in
-- src/lib/analytics.ts). Until both are live, the app's day keys and this
-- function's day labels disagree for clicks made between 00:00 and 05:30 IST
-- (18:30 to 24:00 UTC). Those clicks chart under the wrong day, and one end of
-- a window can drop them from the chart: the first day while only the IST app
-- is live, the last day while only this migration is. Totals and breakdowns
-- are unaffected, since they count from p_since and carry no day labels.
--
-- What changes: the six aggregation RPCs from 014 are replaced in place. Their
-- signatures, return types, STABLE, SET search_path, SECURITY INVOKER (the
-- default, so the clicks RLS policy still applies) and grants stay as they
-- are. Two things change:
--   1. The date filter, in all six:
--        before: (p_since IS NULL OR clicked_at >= p_since)
--        after:  clicked_at >= COALESCE(p_since, '-infinity'::timestamptz)
--   2. The day a click is charted under, in get_clicks_over_time only (its
--      SELECT and its GROUP BY):
--        before: date_trunc('day', clicked_at)::date            (UTC date)
--        after:  (clicked_at AT TIME ZONE 'Asia/Kolkata')::date  (IST date)
--      The other five GROUP BY expressions stay as they are.
--
-- Why the filter: SET search_path stops Postgres from inlining these
-- functions, so each body is planned once with p_since unknown. In that plan
-- "p_since IS NULL OR ..." cannot be an index condition: only link_id reaches
-- the (link_id, clicked_at DESC) index, and every click the links ever had is
-- read and then filtered by date. The COALESCE form is a plain range on
-- clicked_at, so a 7-day view reads only 7 days of index entries.
--
-- Why the day: the owner chose India Standard Time for every chart and window
-- on 2026-10-20. IST is UTC+5:30 all year (no daylight saving), and the app
-- now starts each window at IST midnight and labels each day with its IST
-- date. date_trunc on a timestamptz took the date in the session's TimeZone
-- (UTC here); AT TIME ZONE names the zone, so the label no longer depends on
-- that setting. Only the SELECT and GROUP BY use it, so the date filter stays
-- an index range.
--
-- Behavior: totals and breakdowns are unchanged for every row that has a
-- clicked_at. The column is nullable (DEFAULT now()); a row without one used
-- to count in "all time" and no longer does. Preflight 4 shows whether any
-- exist. Chart days move: a click made between 00:00 and 05:30 IST now shows
-- under its IST date, one day after its UTC date.
--
-- PREFLIGHT (read-only)
--
-- 1. Server version. PG17 and older plan these bodies generically, which is
--    the case this fixes. PG18 can choose custom plans, so the gain is smaller
--    there; the change is still correct.
--      SELECT version();
--
-- 2. The live definitions. Safe when there are exactly six rows, each with
--    args 'p_link_ids uuid[], p_since timestamp with time zone', prosecdef
--    false, proconfig {search_path=public}, owner postgres (the role you apply
--    as), and a body that matches 014 apart from the date filter. Any other
--    argument list means CREATE OR REPLACE would add a second overload
--    (PGRST203, see 010): stop and reconcile first. Save this output: it is
--    the rollback source if the remote bodies differ from 014.
--      SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
--             p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) AS owner,
--             pg_get_functiondef(p.oid)
--      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--      WHERE n.nspname = 'public'
--        AND p.proname IN ('get_clicks_over_time', 'get_device_breakdown',
--                          'get_browser_breakdown', 'get_referrer_breakdown',
--                          'get_country_breakdown', 'get_total_clicks')
--      ORDER BY 1;
--
-- 3. The index the new filter uses. Safe when idx_clicks_created_at_link_id is
--    listed as "USING btree (link_id, clicked_at DESC)". If it is missing,
--    create it first, as 003 does:
--      CREATE INDEX idx_clicks_created_at_link_id ON public.clicks (link_id, clicked_at DESC);
--    Query:
--      SELECT indexname, indexdef FROM pg_indexes
--      WHERE schemaname = 'public' AND tablename = 'clicks' ORDER BY 1;
--
-- 4. Rows that would leave "all time". Safe when 0. Otherwise decide before
--    applying: give them a date (UPDATE public.clicks SET clicked_at =
--    '<date>' WHERE clicked_at IS NULL; they then chart on that day) or accept
--    that they drop out of all-time totals.
--      SELECT count(*) FROM public.clicks WHERE clicked_at IS NULL;
--
-- 5. Totals to compare. Run now and again after applying; with 0 in
--    preflight 4, both numbers must come back the same.
--      SELECT public.get_total_clicks(ARRAY(SELECT id FROM public.links), NULL) AS all_time,
--             public.get_total_clicks(ARRAY(SELECT id FROM public.links),
--                                     now() - interval '30 days') AS last_30_days;
--
-- 6. Optional, PG16 or newer: the plans. The old filter shows clicked_at under
--    "Filter", the new one under "Index Cond". enable_seqscan = off only keeps
--    a small table from hiding the index.
--      SET enable_seqscan = off;
--      EXPLAIN (GENERIC_PLAN) SELECT count(*) FROM public.clicks
--        WHERE link_id = ANY($1) AND ($2::timestamptz IS NULL OR clicked_at >= $2);
--      EXPLAIN (GENERIC_PLAN) SELECT count(*) FROM public.clicks
--        WHERE link_id = ANY($1) AND clicked_at >= COALESCE($2, '-infinity'::timestamptz);
--      RESET enable_seqscan;
--
-- VERIFY after applying: preflight 2 still returns six rows, now with the
-- COALESCE filter, and get_clicks_over_time groups by
-- (clicked_at AT TIME ZONE 'Asia/Kolkata')::date. Preflight 5 returns the
-- numbers it did before. The IST days still hold every click in a window, so
-- this returns true:
--   SELECT COALESCE((SELECT sum(clicks) FROM public.get_clicks_over_time(
--            ARRAY(SELECT id FROM public.links), now() - interval '30 days')), 0)
--        = public.get_total_clicks(ARRAY(SELECT id FROM public.links),
--                                  now() - interval '30 days') AS days_add_up;
--
-- ROLLBACK: re-run 014_analytics_aggregation_rpcs.sql (or the definitions
-- saved from preflight 2). It is six CREATE OR REPLACE statements with the
-- same signatures, so it puts the old filter back in place. It also puts the
-- UTC day labels back, so roll the app back to UTC days with it: under the
-- IST app, UTC labels make the first day of every window drop its 00:00-05:30
-- IST clicks.

BEGIN;

-- ============================================================================
-- Clicks over time (one row per day)
-- ============================================================================
-- Each click is charted under its date in India (IST, UTC+5:30), the same day
-- the app's dayKey and rangeWindow use (src/lib/analytics.ts).
CREATE OR REPLACE FUNCTION public.get_clicks_over_time(
  p_link_ids uuid[],
  p_since timestamptz
)
RETURNS TABLE(day date, clicks bigint)
LANGUAGE sql
STABLE
SET search_path = 'public'
AS $$
  SELECT (clicked_at AT TIME ZONE 'Asia/Kolkata')::date AS day, count(*) AS clicks
  FROM clicks
  WHERE link_id = ANY(p_link_ids)
    AND clicked_at >= COALESCE(p_since, '-infinity'::timestamptz)
  GROUP BY (clicked_at AT TIME ZONE 'Asia/Kolkata')::date
  ORDER BY day;
$$;

GRANT EXECUTE ON FUNCTION public.get_clicks_over_time(uuid[], timestamptz) TO authenticated;

-- ============================================================================
-- Device type breakdown
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_device_breakdown(
  p_link_ids uuid[],
  p_since timestamptz
)
RETURNS TABLE(name text, count bigint)
LANGUAGE sql
STABLE
SET search_path = 'public'
AS $$
  SELECT coalesce(device_type::text, 'unknown') AS name, count(*) AS count
  FROM clicks
  WHERE link_id = ANY(p_link_ids)
    AND clicked_at >= COALESCE(p_since, '-infinity'::timestamptz)
  GROUP BY coalesce(device_type::text, 'unknown')
  ORDER BY count DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_device_breakdown(uuid[], timestamptz) TO authenticated;

-- ============================================================================
-- Browser breakdown
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_browser_breakdown(
  p_link_ids uuid[],
  p_since timestamptz
)
RETURNS TABLE(name text, count bigint)
LANGUAGE sql
STABLE
SET search_path = 'public'
AS $$
  SELECT coalesce(browser_name, 'Unknown') AS name, count(*) AS count
  FROM clicks
  WHERE link_id = ANY(p_link_ids)
    AND clicked_at >= COALESCE(p_since, '-infinity'::timestamptz)
  GROUP BY coalesce(browser_name, 'Unknown')
  ORDER BY count DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_browser_breakdown(uuid[], timestamptz) TO authenticated;

-- ============================================================================
-- Referrer breakdown (top 10 domains)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_referrer_breakdown(
  p_link_ids uuid[],
  p_since timestamptz
)
RETURNS TABLE(name text, count bigint)
LANGUAGE sql
STABLE
SET search_path = 'public'
AS $$
  SELECT coalesce(referrer_domain, 'Direct') AS name, count(*) AS count
  FROM clicks
  WHERE link_id = ANY(p_link_ids)
    AND clicked_at >= COALESCE(p_since, '-infinity'::timestamptz)
  GROUP BY coalesce(referrer_domain, 'Direct')
  ORDER BY count DESC
  LIMIT 10;
$$;

GRANT EXECUTE ON FUNCTION public.get_referrer_breakdown(uuid[], timestamptz) TO authenticated;

-- ============================================================================
-- Country breakdown
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_country_breakdown(
  p_link_ids uuid[],
  p_since timestamptz
)
RETURNS TABLE(name text, count bigint)
LANGUAGE sql
STABLE
SET search_path = 'public'
AS $$
  SELECT coalesce(country, 'Unknown') AS name, count(*) AS count
  FROM clicks
  WHERE link_id = ANY(p_link_ids)
    AND clicked_at >= COALESCE(p_since, '-infinity'::timestamptz)
  GROUP BY coalesce(country, 'Unknown')
  ORDER BY count DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_country_breakdown(uuid[], timestamptz) TO authenticated;

-- ============================================================================
-- Total clicks
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_total_clicks(
  p_link_ids uuid[],
  p_since timestamptz
)
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = 'public'
AS $$
  SELECT count(*)
  FROM clicks
  WHERE link_id = ANY(p_link_ids)
    AND clicked_at >= COALESCE(p_since, '-infinity'::timestamptz);
$$;

GRANT EXECUTE ON FUNCTION public.get_total_clicks(uuid[], timestamptz) TO authenticated;

-- A different signature on the remote would have turned a statement above
-- into a second overload rather than a replacement (PGRST203, see 010).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('get_clicks_over_time', 'get_device_breakdown',
                        'get_browser_breakdown', 'get_referrer_breakdown',
                        'get_country_breakdown', 'get_total_clicks')
    GROUP BY p.proname
    HAVING count(*) <> 1
  ) THEN
    RAISE EXCEPTION 'An analytics RPC now has a second overload; see preflight 2';
  END IF;
END $$;

COMMIT;
