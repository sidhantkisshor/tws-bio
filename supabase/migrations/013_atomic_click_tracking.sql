-- Migration 013: Atomic click tracking (fixes M-3/G-7, M-5/G-10, M-1/G-8 partial)
--
-- ============================================================================
-- WARNING: APPLY THIS MIGRATION BEFORE DEPLOYING THE PAIRED route.ts CHANGE.
-- ============================================================================
-- Replaces the two separate calls (increment_link_clicks + record_click) with a
-- single transactional SECURITY DEFINER function so the increment and the click
-- insert always happen together (atomic), the increment respects max_clicks, the
-- stored IP is truncated for PII, and the referrer domain is derived server-side.
--
-- Deploy order: 1) apply this migration, 2) deploy the route.ts change that calls
-- record_click_and_increment(). The old record_click / increment_link_clicks are
-- dropped at the end, so deploying code first (still calling the old functions)
-- would break click tracking.

-- ============================================================================
-- 1. Transactional record-and-increment function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.record_click_and_increment(
  p_link_id uuid,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_referrer_url text DEFAULT NULL,
  p_browser_name text DEFAULT NULL,
  p_os_name text DEFAULT NULL,
  p_device_type device_type DEFAULT 'unknown',
  p_utm_source text DEFAULT NULL,
  p_utm_medium text DEFAULT NULL,
  p_utm_campaign text DEFAULT NULL,
  p_utm_term text DEFAULT NULL,
  p_utm_content text DEFAULT NULL
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
  -- Verify the link exists and is active before recording anything.
  IF NOT EXISTS (SELECT 1 FROM links WHERE id = p_link_id AND is_active = true) THEN
    RETURN; -- silently skip for invalid/inactive links
  END IF;

  -- Increment total_clicks, but only while below the max_clicks cap (if any).
  -- Runs in the same transaction as the insert below -> atomic.
  UPDATE links
  SET total_clicks = total_clicks + 1
  WHERE id = p_link_id
    AND (max_clicks IS NULL OR total_clicks < max_clicks);

  -- Parse the IP safely: a malformed value stores NULL rather than erroring.
  BEGIN
    v_inet := p_ip_address::inet;
  EXCEPTION WHEN others THEN
    v_inet := NULL;
  END;

  -- Truncate the IP for PII: zero the host bits (IPv4 -> /24, IPv6 -> /48).
  IF v_inet IS NULL THEN
    v_masked := NULL;
  ELSIF family(v_inet) = 4 THEN
    v_masked := network(set_masklen(v_inet, 24));
  ELSE
    v_masked := network(set_masklen(v_inet, 48));
  END IF;

  -- Derive the referrer domain from the raw referrer URL (strip scheme, take host).
  v_referrer_domain := NULLIF(
    split_part(regexp_replace(p_referrer_url, '^https?://', ''), '/', 1),
    ''
  );

  INSERT INTO clicks (
    link_id, ip_address, user_agent, referrer_url, referrer_domain,
    browser_name, os_name, device_type,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content
  )
  VALUES (
    p_link_id, v_masked, p_user_agent, p_referrer_url, v_referrer_domain,
    p_browser_name, p_os_name, p_device_type,
    p_utm_source, p_utm_medium, p_utm_campaign, p_utm_term, p_utm_content
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_click_and_increment(
  uuid, text, text, text, text, text, device_type,
  text, text, text, text, text
) TO anon, authenticated;

-- ============================================================================
-- 2. Drop the superseded functions (no longer called by the app)
-- ============================================================================
-- record_click 12-arg signature (migration 008).
DROP FUNCTION IF EXISTS public.record_click(
  uuid, text, text, text, text, text, device_type,
  text, text, text, text, text
);

-- increment_link_clicks(uuid) (migrations 002/003/007).
DROP FUNCTION IF EXISTS public.increment_link_clicks(uuid);
