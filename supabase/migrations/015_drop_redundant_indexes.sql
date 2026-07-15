-- Migration 015: Drop redundant indexes
-- Fixes: L-9 / G-11 (duplicate/redundant indexes waste write throughput & space)
--
-- idx_links_short_code (001:120) duplicates the implicit UNIQUE index Postgres
--   creates for `short_code TEXT UNIQUE NOT NULL` (001:21). Lookups on
--   short_code are already served by that unique index.
-- idx_clicks_link_id (001:123) on clicks(link_id) is a redundant leftmost
--   prefix of idx_clicks_created_at_link_id on clicks(link_id, clicked_at DESC)
--   (003:17), which serves link_id-only queries just as well.
--
-- Idempotent via IF EXISTS.
DROP INDEX IF EXISTS public.idx_links_short_code;   -- duplicate of the UNIQUE(short_code) index
DROP INDEX IF EXISTS public.idx_clicks_link_id;      -- redundant prefix of idx_clicks_created_at_link_id (link_id, clicked_at DESC)
