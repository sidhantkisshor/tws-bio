-- Function to create a link atomically, preventing race conditions.
-- This function will be called from the frontend to ensure that the
-- check for an existing short_code and the creation of a new one
-- happen in a single, atomic database transaction.

CREATE OR REPLACE FUNCTION create_link(
  p_short_code TEXT,
  p_original_url TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS links
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_link links;
BEGIN
  INSERT INTO public.links (short_code, original_url, user_id, title)
  VALUES (p_short_code, p_original_url, p_user_id, p_original_url)
  RETURNING * INTO new_link;

  RETURN new_link;
EXCEPTION
  WHEN unique_violation THEN
    -- A unique_violation on the 'links_short_code_key' constraint means the short_code is taken.
    RAISE EXCEPTION 'Short code "%" is already taken.', p_short_code;
END;
$$; 