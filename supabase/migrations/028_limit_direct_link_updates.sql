-- Migration 028: Limit direct link updates to the columns the dashboard edits
-- (audit db-11, the verifier's corrected fix)
--
-- APPLIED to production on 2026-10-20 (preflight and verify passed). Run the preflight below first, and apply this
-- file on its own, after 026: if the column list is wrong, a dashboard save
-- fails, and rolling this back must not reopen the INSERT path.
--
-- What changes:
--   1. authenticated may UPDATE only original_url, ios_deep_link,
--      android_deep_link, fallback_url, expires_at, max_clicks, is_active and
--      campaign_id on links, and anon may UPDATE nothing. The owner-only RLS
--      policy still decides which rows.
--   2. CHECK links_original_url_http_scheme: original_url must start with
--      http:// or https://, the rule the create RPCs already apply.
--
-- Why: dropping the INSERT policy (026) does not close the gap on its own.
-- "Users can update own links" has no column limit, so a signed-in owner can
-- PATCH /rest/v1/links directly and set short_code to 'r/<future-slug>'
-- (taking over a Resource Drop row before resource_drop_link_id creates it),
-- or change user_id or total_clicks. Column privileges stop that. The RPCs
-- and record_click_and_increment run as the table owner, so they are not
-- affected. The edit dialog also writes original_url with no scheme check in
-- the database; the CHECK adds one, as 016 did for the deep-link columns.
--
-- APP COUPLING: every supabase.from('links').update({...}) in src may set only
-- the columns above, or that save fails with "permission denied for table
-- links". As of 2026-10-19 they are CreateLinkForm (campaign_id),
-- EditLinkDialog through src/lib/linkEdit.ts (original_url, expires_at,
-- max_clicks, ios_deep_link, android_deep_link, fallback_url, campaign_id),
-- and LinkActions and LinksTable (is_active). A new editable column needs its own GRANT UPDATE (<column>)
-- before the app writes it. The updated_at trigger is not affected: column
-- privileges cover only the columns an UPDATE names.
--
-- PREFLIGHT (read-only)
--
-- 1. In the repo: every update call with the lines around it. Safe when each
--    one on links sets only the columns above.
--      git grep -n -B 3 -A 10 "\.update(" -- src
--
-- 2. The current grants on links. Expect UPDATE for anon and authenticated
--    (the Supabase default) and no column-level grants. If PUBLIC is listed
--    with UPDATE, add it to the REVOKE below. Save the output: it is the
--    rollback source.
--      SELECT grantee, privilege_type FROM information_schema.role_table_grants
--      WHERE table_schema = 'public' AND table_name = 'links' ORDER BY 1, 2;
--      SELECT attname, attacl FROM pg_attribute
--      WHERE attrelid = 'public.links'::regclass AND attacl IS NOT NULL;
--
-- 3. Rows the CHECK would refuse. Safe when it returns no rows. NOT VALID only
--    skips the one-time scan: every later UPDATE of a listed row fails, the
--    click counter included, so fix or delete those rows first.
--      SELECT id, short_code, original_url FROM public.links
--      WHERE original_url !~* '^https?://';
--
-- VERIFY after applying, in a transaction that changes nothing (the second
-- UPDATE must fail with "permission denied for table links"):
--   BEGIN;
--   SET LOCAL ROLE authenticated;
--   SELECT set_config('request.jwt.claims', '{"sub":"<owner id>","role":"authenticated"}', true);
--   UPDATE public.links SET is_active = is_active WHERE short_code = '<code>';
--   UPDATE public.links SET short_code = 'probe' WHERE short_code = '<code>';
--   ROLLBACK;
--
-- AFTER applying, with preflight 3 still empty, mark the CHECK validated:
--   ALTER TABLE public.links VALIDATE CONSTRAINT links_original_url_http_scheme;
--
-- ROLLBACK (one transaction; match the grants saved from preflight 2):
--   BEGIN;
--   ALTER TABLE public.links DROP CONSTRAINT IF EXISTS links_original_url_http_scheme;
--   REVOKE UPDATE (original_url, ios_deep_link, android_deep_link, fallback_url,
--     expires_at, max_clicks, is_active, campaign_id) ON public.links FROM authenticated;
--   GRANT UPDATE ON public.links TO anon, authenticated;
--   COMMIT;

BEGIN;

-- Revoke first: revoking a table-level privilege also revokes the matching
-- column-level ones, so the column grant has to come after it.
REVOKE UPDATE ON public.links FROM anon, authenticated;
GRANT UPDATE (
  original_url, ios_deep_link, android_deep_link, fallback_url,
  expires_at, max_clicks, is_active, campaign_id
) ON public.links TO authenticated;

ALTER TABLE public.links
  DROP CONSTRAINT IF EXISTS links_original_url_http_scheme;
ALTER TABLE public.links
  ADD CONSTRAINT links_original_url_http_scheme
  CHECK (original_url ~* '^https?://')
  NOT VALID;

COMMIT;
