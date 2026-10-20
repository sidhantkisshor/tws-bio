-- Migration 024: Drop two clicks indexes no query uses (audit db-10)
--
-- NOT APPLIED as of 2026-10-19. Run the preflight below against the remote
-- database first: the remote has drifted from these files before (CLAUDE.md).
--
-- What changes: drops idx_clicks_visitor_id and idx_clicks_clicked_at (001).
--
-- Why: every click writes to every index on clicks, the one table that keeps
-- growing. visitor_id is never written (no code sets it), so its index holds
-- only NULLs. Every clicks query in the app filters on link_id first (the six
-- analytics RPCs and the links, link detail and campaign detail pages), and
-- idx_clicks_created_at_link_id (link_id, clicked_at DESC) serves all of them,
-- date window included since 022. That leaves two of the four btrees written
-- per click with no reader.
--
-- If a retention job ever filters clicks on clicked_at alone (audit db-6), add
-- a small BRIN index for it then, since clicks arrive in time order:
--   CREATE INDEX idx_clicks_clicked_at_brin ON public.clicks USING brin (clicked_at);
--
-- A plain DROP INDEX locks clicks for a moment (milliseconds at this size:
-- click inserts wait, none fail). DROP INDEX CONCURRENTLY avoids the lock but
-- cannot run inside BEGIN/COMMIT, and is not worth it here.
--
-- PREFLIGHT (read-only)
--
-- 1. The indexes on clicks. Safe when idx_clicks_created_at_link_id is listed
--    as "USING btree (link_id, clicked_at DESC)". The remote has lost it once
--    already (restored 2026-07-15); if it is missing, stop and restore it
--    first (003) before dropping idx_clicks_clicked_at. The check at the top
--    of the transaction aborts in that case.
--      SELECT indexname, indexdef FROM pg_indexes
--      WHERE schemaname = 'public' AND tablename = 'clicks' ORDER BY 1;
--
-- 2. Use since the counters started. Safe when idx_scan is 0 for both indexes
--    (or tiny next to idx_clicks_created_at_link_id) and query 3 shows the
--    counters cover weeks, not hours. An index that is clearly being scanned
--    serves something the audit missed: keep it.
--      SELECT indexrelname, idx_scan, pg_size_pretty(pg_relation_size(indexrelid)) AS size
--      FROM pg_stat_user_indexes
--      WHERE schemaname = 'public' AND relname = 'clicks' ORDER BY 1;
--
-- 3. When those counters started (NULL: never reset).
--      SELECT stats_reset FROM pg_stat_database WHERE datname = current_database();
--
-- 4. visitor_id is unused. Safe when 0.
--      SELECT count(*) FROM public.clicks WHERE visitor_id IS NOT NULL;
--
-- ROLLBACK:
--   CREATE INDEX IF NOT EXISTS idx_clicks_clicked_at ON public.clicks (clicked_at DESC);
--   CREATE INDEX IF NOT EXISTS idx_clicks_visitor_id ON public.clicks (visitor_id);

BEGIN;

-- idx_clicks_clicked_at may only go while the composite index covers the
-- clicks queries.
DO $$
BEGIN
  IF to_regclass('public.idx_clicks_created_at_link_id') IS NULL THEN
    RAISE EXCEPTION 'idx_clicks_created_at_link_id is missing; restore it before dropping idx_clicks_clicked_at (see preflight 1)';
  END IF;
END $$;

DROP INDEX IF EXISTS public.idx_clicks_visitor_id;   -- visitor_id is never written
DROP INDEX IF EXISTS public.idx_clicks_clicked_at;   -- every query leads with link_id

COMMIT;
