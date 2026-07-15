-- Migration 011: Secure link creation RPCs
-- Fixes: H-3 / G-4  (create_link & create_deep_link insert a client-supplied
--                    p_user_id with no auth check -> user impersonation)
--        L-7 / G-12 (create_deep_link stores ios/android deep links with no
--                    scheme validation -> javascript:/data:/vbscript: injection)
--
-- These re-create the FINAL definitions from migration 007 faithfully via
-- CREATE OR REPLACE, adding ONLY:
--   1. An ownership guard in BOTH functions (anonymous p_user_id = NULL stays
--      allowed; authenticated callers may only pass their own auth.uid()).
--   2. Deep-link scheme validation in create_deep_link only.
-- Signatures are unchanged. SECURITY DEFINER, SET search_path, and the
-- unique_violation handling are preserved exactly as in 007.

-- ============================================================================
-- 1. create_link with ownership guard
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

  -- Ownership guard: anonymous creation (NULL) is allowed; authenticated
  -- callers may only create links for themselves.
  IF p_user_id IS NOT NULL AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Cannot create links on behalf of another user';
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
-- 2. create_deep_link with ownership guard + deep-link scheme validation
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

  -- Ownership guard: anonymous creation (NULL) is allowed; authenticated
  -- callers may only create links for themselves.
  IF p_user_id IS NOT NULL AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Cannot create links on behalf of another user';
  END IF;

  -- Reject dangerous deep-link schemes (case-insensitive). NULL/empty and
  -- normal app schemes are allowed.
  IF p_ios_deep_link IS NOT NULL AND p_ios_deep_link != ''
     AND lower(trim(p_ios_deep_link)) ~ '^(javascript|data|vbscript):' THEN
    RAISE EXCEPTION 'Invalid iOS deep link scheme';
  END IF;
  IF p_android_deep_link IS NOT NULL AND p_android_deep_link != ''
     AND lower(trim(p_android_deep_link)) ~ '^(javascript|data|vbscript):' THEN
    RAISE EXCEPTION 'Invalid Android deep link scheme';
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
