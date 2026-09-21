-- 021_resource_drop_links.sql
--
-- Click tracking for the tws.bio/r/{slug} Resource Drop short links.
--
-- The /r/[slug] route redirects without a row in `links` (see
-- src/lib/resourceDrop.ts), because the Resource Drop Desk that creates each
-- video's drop cannot reach this database. This function gives the route a row
-- to record clicks against: it finds, or creates on first click, a `links` row
-- with short_code 'r/{slug}', owned by the active owner account and tagged
-- 'resource-drop', so each video appears in the dashboard with its clicks.
--
-- The slash in 'r/{slug}' is deliberate: getShortUrl() renders it as
-- tws.bio/r/{slug}, which is the real URL, and a single-segment
-- /[shortCode] lookup can never collide with it.
--
-- Abuse guard: the function is callable by anon (the redirect route has no
-- session), so a bot walking random slugs could create rows. Creation stops at
-- 20 new resource-drop rows per hour; past that, the redirect still works and
-- that click is simply not recorded.
--
-- Applied to production on 2026-09-21 through the Supabase SQL editor.

CREATE OR REPLACE FUNCTION public.resource_drop_link_id(p_slug text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_code text;
  v_id uuid;
BEGIN
  -- Same slug rule as the CRM, capped at 48 so 'r/' + slug fits the 50-char
  -- chk_short_code_length constraint.
  IF p_slug IS NULL OR char_length(p_slug) < 2 OR char_length(p_slug) > 48
     OR p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
    RETURN NULL;
  END IF;

  v_code := 'r/' || p_slug;

  SELECT id INTO v_id FROM links WHERE short_code = v_code;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  IF (SELECT count(*) FROM links
      WHERE 'resource-drop' = ANY(tags)
        AND created_at > now() - interval '1 hour') >= 20 THEN
    RETURN NULL;
  END IF;

  INSERT INTO links (short_code, original_url, user_id, title, link_type, is_active, tags)
  VALUES (
    v_code,
    'https://twsgurukulx.com/r/' || p_slug,
    '3633ce1a-cbab-4ee5-9a60-1bf0bf5b2c5f',
    'Resource drop: ' || p_slug,
    'url',
    true,
    ARRAY['resource-drop']
  )
  ON CONFLICT (short_code) DO NOTHING
  RETURNING id INTO v_id;

  -- Lost a race with a concurrent first click: read the winner's row.
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM links WHERE short_code = v_code;
  END IF;

  RETURN v_id;
END
$$;

REVOKE ALL ON FUNCTION public.resource_drop_link_id(text) FROM public;
GRANT EXECUTE ON FUNCTION public.resource_drop_link_id(text) TO anon, authenticated;
