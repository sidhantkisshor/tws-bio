-- Migration 023: Leaner, bounded click recording (audit db-8, db-9)
--
-- NOT APPLIED as of 2026-10-19. Run the preflight below against the remote
-- database first: the remote has drifted from these files before (CLAUDE.md).
--
-- What changes:
--   1. record_click_and_increment is rebuilt from its latest definition (020)
--      with the same 13 arguments, names, defaults, SECURITY DEFINER and
--      search_path, so it is replaced in place and keeps its grants (anon,
--      authenticated). The IP masking (/24, /48) and country handling are
--      020's. Three changes:
--      a. The is_active check rides on the counter UPDATE. 020 read the link
--         once to check it and again to update it; one statement now does
--         both, and IF NOT FOUND still skips an unknown or inactive link.
--      b. Text inputs are capped with left(): user_agent 512, referrer_url
--         2048, utm_* 256, browser_name and os_name 32, country 2. The
--         function is callable with the public anon key, so nothing else
--         bounds what a caller can store.
--      c. referrer_domain is the host of any scheme://host referrer,
--         lowercased, without userinfo or port. 020 only stripped http(s)://,
--         so every app referrer (Chrome on Android sends
--         android-app://com.linkedin.android/ for a link opened from the
--         LinkedIn app) landed in one "android-app:" bucket in Top Referrers.
--         Those now read as the app's package name. A referrer with no scheme
--         at all (browsers never send one) now stores NULL, not its first
--         path segment.
--   2. links.updated_at stops moving on clicks. The 001 trigger stamped it on
--      every UPDATE and every click is one, so updated_at meant "last click".
--      Section 2 explains why the trigger compares values rather than listing
--      columns.
--
-- Bot filtering is not in here on purpose: the redirect routes decide which
-- requests count as clicks.
--
-- Old clicks keep the referrer_domain they were stored with. Re-deriving them
-- is a separate product call (it also fills rows from before 2026-07-15, which
-- have none):
--   UPDATE public.clicks
--   SET referrer_domain = lower(substring(left(referrer_url, 2048)
--         from '^[A-Za-z][A-Za-z0-9+.-]*://(?:[^@/?#]*@)?([^/:?#]+)'))
--   WHERE referrer_url IS NOT NULL;
--
-- PREFLIGHT (read-only)
--
-- 1. The live function. Safe when there is exactly one row, args are
--      p_link_id uuid, p_ip_address text, p_user_agent text,
--      p_referrer_url text, p_browser_name text, p_os_name text,
--      p_device_type device_type, p_utm_source text, p_utm_medium text,
--      p_utm_campaign text, p_utm_term text, p_utm_content text,
--      p_country text
--    prosecdef is true, proconfig is {search_path=public}, owner is postgres
--    (the role you apply as), and the body matches 020 section 4 (no
--    max_clicks guard on the UPDATE). Any other argument list means
--    CREATE OR REPLACE would add a second overload (PGRST203, see 010): stop.
--    Save the output: it is the rollback source.
--      SELECT pg_get_function_identity_arguments(p.oid) AS args, p.prosecdef,
--             p.proconfig, pg_get_userbyid(p.proowner) AS owner,
--             pg_get_functiondef(p.oid)
--      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--      WHERE n.nspname = 'public' AND p.proname = 'record_click_and_increment';
--
-- 2. Who may call it. Expect anon and authenticated among the grantees;
--    CREATE OR REPLACE keeps them.
--      SELECT grantee, privilege_type FROM information_schema.routine_privileges
--      WHERE routine_schema = 'public' AND routine_name = 'record_click_and_increment';
--
-- 3. The triggers on links. Safe when the only updated_at trigger is
--    update_links_updated_at, defined as "BEFORE UPDATE ON public.links FOR
--    EACH ROW EXECUTE FUNCTION update_updated_at_column()". If it has another
--    name, put that name in the DROP TRIGGER below: otherwise the old trigger
--    keeps stamping every click (the check at the end of this file aborts in
--    that case).
--      SELECT tgname, tgenabled, pg_get_triggerdef(oid)
--      FROM pg_trigger WHERE tgrelid = 'public.links'::regclass AND NOT tgisinternal;
--
-- 4. The shared trigger function. Safe when it only sets NEW.updated_at = NOW()
--    and returns NEW. This migration leaves it as it is: the profiles and
--    custom_domains triggers use it too.
--      SELECT pg_get_functiondef('public.update_updated_at_column()'::regprocedure);
--
-- 5. For information: the longest stored values. The caps apply to new rows
--    only; anything above them here is what they would have trimmed.
--      SELECT max(length(user_agent)) AS user_agent,
--             max(length(referrer_url)) AS referrer_url,
--             max(greatest(length(utm_source), length(utm_medium), length(utm_campaign),
--                          length(utm_term), length(utm_content))) AS utm,
--             max(greatest(length(browser_name), length(os_name))) AS browser_os,
--             max(length(country)) AS country
--      FROM public.clicks;
--
-- 6. For information: the new referrer rule on real rows. "proposed" should be
--    a plain lowercase host on every row, and android-app rows a package name
--    such as com.linkedin.android.
--      SELECT referrer_domain AS current,
--             lower(substring(left(referrer_url, 2048)
--               from '^[A-Za-z][A-Za-z0-9+.-]*://(?:[^@/?#]*@)?([^/:?#]+)')) AS proposed,
--             count(*)
--      FROM public.clicks WHERE referrer_url IS NOT NULL
--      GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 30;
--
-- VERIFY after applying: open one short link, then
--   SELECT short_code, total_clicks, updated_at FROM public.links WHERE short_code = '<code>';
-- total_clicks went up by 1 and updated_at did not move. Edit the link in the
-- dashboard: updated_at moves.
--
-- ROLLBACK (one transaction):
--   1. Re-run the CREATE OR REPLACE FUNCTION in section 4 of
--      020_repair_ownership_deeplinks_totals.sql (or the definition saved from
--      preflight 1). Same signature, so it replaces this one in place.
--   2. DROP TRIGGER IF EXISTS update_links_updated_at ON public.links;
--      CREATE TRIGGER update_links_updated_at BEFORE UPDATE ON public.links
--        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

BEGIN;

-- ============================================================================
-- 1. record_click_and_increment
-- ============================================================================
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
  v_referrer_url text := left(p_referrer_url, 2048);
  v_referrer_domain text;
BEGIN
  -- The active check and the count are one statement, so an unknown or
  -- inactive link costs one index probe and records nothing. total_clicks has
  -- no index, which keeps this a HOT update; keep it that way.
  UPDATE links
  SET total_clicks = total_clicks + 1
  WHERE id = p_link_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN;
  END IF;

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

  -- Any scheme, not just http(s): app referrers (android-app://<package>/)
  -- carry the app's package where a web referrer carries its host.
  v_referrer_domain := lower(substring(
    v_referrer_url from '^[A-Za-z][A-Za-z0-9+.-]*://(?:[^@/?#]*@)?([^/:?#]+)'
  ));

  -- Each cap is at or above what a browser or the redirect routes normally
  -- send (country is ISO 3166 alpha-2), so real clicks are stored whole.
  INSERT INTO clicks (
    link_id, ip_address, user_agent, referrer_url, referrer_domain, country,
    browser_name, os_name, device_type,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content
  )
  VALUES (
    p_link_id, v_masked, left(p_user_agent, 512), v_referrer_url, v_referrer_domain,
    left(NULLIF(p_country, ''), 2),
    left(p_browser_name, 32), left(p_os_name, 32), p_device_type,
    left(p_utm_source, 256), left(p_utm_medium, 256), left(p_utm_campaign, 256),
    left(p_utm_term, 256), left(p_utm_content, 256)
  );
END;
$$;

-- ============================================================================
-- 2. links.updated_at: skip updates that change only total_clicks
-- ============================================================================
-- The WHEN clause compares the whole row, minus total_clicks and updated_at,
-- instead of naming the editable columns in BEFORE UPDATE OF. A column list
-- fires on the columns written in the SET clause, so an edit to any column
-- left off the list (tags, custom_meta, or one added later) would keep the old
-- updated_at without anyone noticing. Comparing values cannot miss an edit,
-- covers future columns without touching this trigger, and a click-only update
-- never calls the trigger function at all.
--
-- One intended side effect: a save that writes back the same values no longer
-- moves updated_at either, because nothing changed.
DROP TRIGGER IF EXISTS update_links_updated_at ON public.links;
CREATE TRIGGER update_links_updated_at
  BEFORE UPDATE ON public.links
  FOR EACH ROW
  WHEN ((to_jsonb(OLD) - 'total_clicks' - 'updated_at')
        IS DISTINCT FROM (to_jsonb(NEW) - 'total_clicks' - 'updated_at'))
  EXECUTE FUNCTION public.update_updated_at_column();

-- Abort if preflight 1 or 3 was missed: a second overload makes PostgREST
-- calls ambiguous (PGRST203), and a second updated_at trigger under another
-- name would keep stamping every click.
DO $$
BEGIN
  IF (SELECT count(*)
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'record_click_and_increment') <> 1 THEN
    RAISE EXCEPTION 'record_click_and_increment has more than one overload; see preflight 1';
  END IF;

  IF (SELECT count(*)
      FROM pg_trigger
      WHERE tgrelid = 'public.links'::regclass AND NOT tgisinternal
        AND tgfoid = 'public.update_updated_at_column()'::regprocedure) <> 1 THEN
    RAISE EXCEPTION 'links has another trigger calling update_updated_at_column(); see preflight 3';
  END IF;
END $$;

COMMIT;
