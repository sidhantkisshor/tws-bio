-- Migration 007: Security hardening
-- Fixes: S3 (RPC input validation), S8 (search_path), S9 (open clicks policy),
--        S11 (short_code length constraint)

-- ============================================================================
-- 1. Add CHECK constraint on short_code length
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'chk_short_code_length'
  ) THEN
    ALTER TABLE links ADD CONSTRAINT chk_short_code_length
      CHECK (char_length(short_code) BETWEEN 1 AND 50);
  END IF;
END $$;

-- ============================================================================
-- 2. Re-create create_link with input validation
-- ============================================================================
CREATE OR REPLACE FUNCTION create_link(
  p_short_code TEXT,
  p_original_url TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS links
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  new_link links;
BEGIN
  -- Validate short_code format and length
  IF p_short_code IS NULL OR p_short_code = '' THEN
    RAISE EXCEPTION 'Short code is required.';
  END IF;
  IF char_length(p_short_code) > 50 THEN
    RAISE EXCEPTION 'Short code must be 50 characters or fewer.';
  END IF;
  IF p_short_code !~ '^[a-zA-Z0-9-]+$' THEN
    RAISE EXCEPTION 'Short code may only contain letters, numbers, and hyphens.';
  END IF;

  -- Validate original_url scheme
  IF p_original_url IS NULL OR p_original_url = '' THEN
    RAISE EXCEPTION 'Original URL is required.';
  END IF;
  IF lower(p_original_url) NOT LIKE 'http://%' AND lower(p_original_url) NOT LIKE 'https://%' THEN
    RAISE EXCEPTION 'URL must start with http:// or https://';
  END IF;

  INSERT INTO public.links (short_code, original_url, user_id, title)
  VALUES (p_short_code, p_original_url, p_user_id, p_original_url)
  RETURNING * INTO new_link;

  RETURN new_link;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Short code "%" is already taken.', p_short_code;
END;
$$;

-- ============================================================================
-- 3. Re-create create_deep_link with input validation
-- ============================================================================
CREATE OR REPLACE FUNCTION create_deep_link(
  p_short_code TEXT,
  p_original_url TEXT,
  p_user_id UUID DEFAULT NULL,
  p_ios_deep_link TEXT DEFAULT NULL,
  p_android_deep_link TEXT DEFAULT NULL,
  p_fallback_url TEXT DEFAULT NULL
)
RETURNS links
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  new_link links;
BEGIN
  -- Validate short_code format and length
  IF p_short_code IS NULL OR p_short_code = '' THEN
    RAISE EXCEPTION 'Short code is required.';
  END IF;
  IF char_length(p_short_code) > 50 THEN
    RAISE EXCEPTION 'Short code must be 50 characters or fewer.';
  END IF;
  IF p_short_code !~ '^[a-zA-Z0-9-]+$' THEN
    RAISE EXCEPTION 'Short code may only contain letters, numbers, and hyphens.';
  END IF;

  -- Validate original_url scheme
  IF p_original_url IS NULL OR p_original_url = '' THEN
    RAISE EXCEPTION 'Original URL is required.';
  END IF;
  IF lower(p_original_url) NOT LIKE 'http://%' AND lower(p_original_url) NOT LIKE 'https://%' THEN
    RAISE EXCEPTION 'URL must start with http:// or https://';
  END IF;

  -- Validate fallback_url scheme if provided
  IF p_fallback_url IS NOT NULL AND p_fallback_url != '' THEN
    IF lower(p_fallback_url) NOT LIKE 'http://%' AND lower(p_fallback_url) NOT LIKE 'https://%' THEN
      RAISE EXCEPTION 'Fallback URL must start with http:// or https://';
    END IF;
  END IF;

  INSERT INTO public.links (
    short_code, original_url, user_id, title,
    link_type, ios_deep_link, android_deep_link, fallback_url
  )
  VALUES (
    p_short_code, p_original_url, p_user_id, p_original_url,
    'deep_link', p_ios_deep_link, p_android_deep_link, p_fallback_url
  )
  RETURNING * INTO new_link;

  RETURN new_link;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Short code "%" is already taken.', p_short_code;
END;
$$;

-- ============================================================================
-- 4. Re-create increment_link_clicks with explicit search_path
-- ============================================================================
CREATE OR REPLACE FUNCTION increment_link_clicks(link_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE links
  SET total_clicks = total_clicks + 1
  WHERE id = link_id;
END;
$$;

-- ============================================================================
-- 5. Create record_click RPC to replace open clicks insert policy
-- ============================================================================
CREATE OR REPLACE FUNCTION record_click(
  p_link_id UUID,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_referrer_url TEXT DEFAULT NULL,
  p_browser_name TEXT DEFAULT NULL,
  p_os_name TEXT DEFAULT NULL,
  p_device_type device_type DEFAULT 'unknown'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Verify the link exists and is active before recording
  IF NOT EXISTS (SELECT 1 FROM links WHERE id = p_link_id AND is_active = true) THEN
    RETURN; -- silently skip for invalid/inactive links
  END IF;

  INSERT INTO clicks (
    link_id, ip_address, user_agent, referrer_url,
    browser_name, os_name, device_type
  )
  VALUES (
    p_link_id,
    CASE WHEN p_ip_address IS NOT NULL THEN p_ip_address::inet ELSE NULL END,
    p_user_agent, p_referrer_url,
    p_browser_name, p_os_name, p_device_type
  );
END;
$$;

-- ============================================================================
-- 6. Drop overly permissive clicks insert policy
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can insert clicks" ON clicks;
