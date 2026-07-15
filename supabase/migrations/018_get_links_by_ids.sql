-- Migration 018: Restore the anonymous saved-links list (post-012 follow-up)
--
-- Migration 012 replaced the broad anon SELECT on links with an owner-only
-- policy, which broke the home page's anonymous link list: useLinks fetches
-- the visitor's own creations by the UUIDs it saved in localStorage
-- (anon_links). This SECURITY DEFINER RPC restores that path without
-- re-opening enumeration: link ids are random UUIDs handed out only at
-- creation time, so possession of an id is proof the caller created (or was
-- given) the link. No sequential scanning is possible.
--
-- The input is capped at 50 ids (the client-side MAX_ANON_LINKS cap) to bound
-- work from adversarial callers.

CREATE OR REPLACE FUNCTION public.get_links_by_ids(p_ids uuid[])
RETURNS SETOF public.links
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
STABLE
AS $$
  SELECT * FROM public.links
  WHERE id = ANY(p_ids[1:50])
  ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_links_by_ids(uuid[]) TO anon, authenticated;
