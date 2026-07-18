-- 020_repair_ownership_deeplinks_totals.sql
-- Production data repair (2026-07-18), paired with app fixes for
-- "deep links not working" and "unable to track individual link statistics".
--
--   1. Ownership consolidation: links owned by the never-signed-in
--      admin@tws.bio account (a1a62768-...) or by nobody (user_id IS NULL,
--      pre-019 anonymous creations) are invisible in every dashboard under
--      the owner-only RLS policies, so their per-link statistics were
--      unreachable. Reassign them to the active owner account
--      tradingwithsidhant@gmail.com (3633ce1a-...). 22 of 51 links affected.
--   2. Deep-link URI repair: `youtube:///<path>` (empty authority — the iOS
--      app opens but cannot route to the channel) -> full-host
--      `youtube://www.youtube.com/<path>` (4 rows), and backfill the native
--      Telegram scheme for tws.bio/tg, which predates Telegram support in
--      detectDeepLinks(). Paired with the same-day fix in src/lib/deeplinks.ts.
--   3. total_clicks reconcile: raise undercounted totals (15 rows, e.g.
--      hpl 0 -> 74) to the real clicks row count. GREATEST semantics — never
--      lowers a total whose detailed click rows were purged historically.
--   4. record_click_and_increment: increment unconditionally whenever a click
--      row is inserted. Cap enforcement already happens at redirect time in
--      the route handler (410 before tracking), so the old max_clicks guard
--      on the UPDATE could only make rows and totals drift apart on races.
--      No production link uses max_clicks today (verified 2026-07-18).

-- Reversibility snapshot of every column this migration touches.
CREATE TABLE IF NOT EXISTS public._repair_backup_20260718 AS
SELECT id, short_code, user_id, ios_deep_link, android_deep_link, total_clicks
FROM public.links;

-- The backup must not be readable through the public API surface.
ALTER TABLE public._repair_backup_20260718 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._repair_backup_20260718 FROM anon, authenticated;

-- 1. Ownership consolidation
UPDATE public.links
SET user_id = '3633ce1a-cbab-4ee5-9a60-1bf0bf5b2c5f'
WHERE user_id = 'a1a62768-592f-4e46-b4ec-bf89ae00fc54' OR user_id IS NULL;

-- 2a. Repair empty-authority YouTube iOS URIs
UPDATE public.links
SET ios_deep_link = replace(ios_deep_link, 'youtube:///', 'youtube://www.youtube.com/')
WHERE ios_deep_link LIKE 'youtube:///%';

-- 2b. Backfill the native Telegram scheme for tws.bio/tg
UPDATE public.links
SET ios_deep_link = 'tg://resolve?domain=tradingwsidhant',
    android_deep_link = 'tg://resolve?domain=tradingwsidhant'
WHERE short_code = 'tg'
  AND original_url = 'https://t.me/tradingwsidhant'
  AND ios_deep_link IS NULL;

-- 3. Reconcile undercounted totals with the real click rows
UPDATE public.links l
SET total_clicks = c.cnt
FROM (SELECT link_id, count(*) AS cnt FROM public.clicks GROUP BY link_id) c
WHERE c.link_id = l.id AND c.cnt > l.total_clicks;

-- 4. Keep the counter and the click rows symmetric. Identical to the 017
--    definition except the UPDATE no longer carries the max_clicks guard.
--    CREATE OR REPLACE preserves the existing GRANTs (anon, authenticated).
CREATE OR REPLACE FUNCTION public.record_click_and_increment(
  p_link_id uuid,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_referrer_url text DEFAULT NULL,
  p_browser_name text DEFAULT NULL,
  p_os_name text DEFAULT NULL,
  p_device_type device_type DEFAULT 'unknown'::device_type,
  p_utm_source text DEFAULT NULL,
  p_utm_medium text DEFAULT NULL,
  p_utm_campaign text DEFAULT NULL,
  p_utm_term text DEFAULT NULL,
  p_utm_content text DEFAULT NULL,
  p_country text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_inet inet;
  v_masked inet;
  v_referrer_domain text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM links WHERE id = p_link_id AND is_active = true) THEN
    RETURN;
  END IF;

  UPDATE links
  SET total_clicks = total_clicks + 1
  WHERE id = p_link_id;

  BEGIN
    v_inet := p_ip_address::inet;
  EXCEPTION WHEN others THEN
    v_inet := NULL;
  END;

  IF v_inet IS NULL THEN
    v_masked := NULL;
  ELSIF family(v_inet) = 4 THEN
    v_masked := network(set_masklen(v_inet, 24));
  ELSE
    v_masked := network(set_masklen(v_inet, 48));
  END IF;

  v_referrer_domain := NULLIF(
    split_part(regexp_replace(p_referrer_url, '^https?://', ''), '/', 1),
    ''
  );

  INSERT INTO clicks (
    link_id, ip_address, user_agent, referrer_url, referrer_domain, country,
    browser_name, os_name, device_type,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content
  )
  VALUES (
    p_link_id, v_masked, p_user_agent, p_referrer_url, v_referrer_domain, NULLIF(p_country, ''),
    p_browser_name, p_os_name, p_device_type,
    p_utm_source, p_utm_medium, p_utm_campaign, p_utm_term, p_utm_content
  );
END;
$$;
