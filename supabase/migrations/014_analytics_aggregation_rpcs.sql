-- Migration 014: Analytics aggregation RPCs (fixes H-5 / G-6)
--
-- Paired with the lib/analytics.ts rewrite: instead of pulling raw click rows to
-- the client and aggregating there, the dashboard calls these functions.
--
-- IMPORTANT: these are SECURITY INVOKER (the default) on purpose. They run with
-- the caller's privileges, so the existing clicks RLS policy
--   "Users can view clicks for own links"
-- restricts the aggregated rows to clicks on links the caller owns. Do NOT make
-- these SECURITY DEFINER — that would bypass RLS and leak other users' analytics.
--
-- All functions share the same filter:
--   WHERE link_id = ANY(p_link_ids) AND (p_since IS NULL OR clicked_at >= p_since)
-- The caller passes the ids of links it owns; RLS is the actual guard.

-- ============================================================================
-- Clicks over time (one row per day)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_clicks_over_time(
  p_link_ids uuid[],
  p_since timestamptz
)
RETURNS TABLE(day date, clicks bigint)
LANGUAGE sql
STABLE
SET search_path = 'public'
AS $$
  SELECT date_trunc('day', clicked_at)::date AS day, count(*) AS clicks
  FROM clicks
  WHERE link_id = ANY(p_link_ids)
    AND (p_since IS NULL OR clicked_at >= p_since)
  GROUP BY date_trunc('day', clicked_at)::date
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
    AND (p_since IS NULL OR clicked_at >= p_since)
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
    AND (p_since IS NULL OR clicked_at >= p_since)
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
    AND (p_since IS NULL OR clicked_at >= p_since)
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
    AND (p_since IS NULL OR clicked_at >= p_since)
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
    AND (p_since IS NULL OR clicked_at >= p_since);
$$;

GRANT EXECUTE ON FUNCTION public.get_total_clicks(uuid[], timestamptz) TO authenticated;
