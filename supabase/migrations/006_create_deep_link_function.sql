-- Function to create a deep link atomically, supporting all deep link fields.
-- SECURITY DEFINER allows anonymous users (null user_id) to create links.

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

-- Also fix search_path on the existing create_link function
ALTER FUNCTION public.create_link SET search_path = 'public';
