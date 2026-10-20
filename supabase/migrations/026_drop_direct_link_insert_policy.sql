-- Migration 026: Drop the direct INSERT policy on links (audit db-11)
--
-- NOT APPLIED as of 2026-10-19. Run the preflight below against the remote
-- database first: policy names on the remote have drifted before (CLAUDE.md).
--
-- What changes: drops "Users can create links" (001), the policy that lets a
-- signed-in user INSERT into links through the REST API directly.
--
-- Why: CLAUDE.md and 019 say the SECURITY DEFINER RPCs (create_link,
-- create_deep_link, resource_drop_link_id) are the only write path to links,
-- but this policy was never dropped. A direct POST /rest/v1/links skips the
-- RPCs' checks: the short-code pattern and the http(s) scheme. It can also
-- take a code such as 'r/<future-slug>' before resource_drop_link_id creates
-- that row. With no INSERT policy left, RLS refuses every direct insert. The
-- RPCs are not affected: they run as the table owner, and RLS does not apply
-- to the owner (preflight 2 confirms that holds on the remote). No app code
-- inserts into links directly.
--
-- The same finding notes that the UPDATE path is just as open (an owner can
-- PATCH short_code). That fix is 028, kept apart because it depends on which
-- columns the app updates.
--
-- PREFLIGHT (read-only)
--
-- 1. The policies on links. Safe when exactly one row has cmd INSERT or ALL,
--    and it is "Users can create links" WITH CHECK (auth.uid() = user_id). If
--    it has another name, put that name in the DROP POLICY below (the check at
--    the end aborts otherwise). If no row has cmd INSERT or ALL, the hole is
--    already closed: do not apply this file, and record that here instead.
--      SELECT policyname, cmd, roles, with_check
--      FROM pg_policies WHERE schemaname = 'public' AND tablename = 'links'
--      ORDER BY policyname;
--
-- 2. The RPCs still insert once the policy is gone. Safe when
--    relforcerowsecurity is false, and each function has prosecdef true and
--    is owned by the table owner (or by a role with rolbypassrls true). FORCE
--    ROW LEVEL SECURITY, or another owner, would put the RPC inserts under
--    RLS, and with no INSERT policy they would fail.
--      SELECT relrowsecurity, relforcerowsecurity, pg_get_userbyid(relowner) AS table_owner
--      FROM pg_class WHERE oid = 'public.links'::regclass;
--      SELECT p.proname, p.prosecdef, r.rolname AS owner, r.rolbypassrls
--      FROM pg_proc p
--      JOIN pg_namespace n ON n.oid = p.pronamespace
--      JOIN pg_roles r ON r.oid = p.proowner
--      WHERE n.nspname = 'public'
--        AND p.proname IN ('create_link', 'create_deep_link', 'resource_drop_link_id');
--
-- VERIFY after applying: create a link from the dashboard (the RPC path still
-- works). Then confirm a direct insert is refused, in a transaction that
-- changes nothing; expect "new row violates row-level security policy":
--   BEGIN;
--   SET LOCAL ROLE authenticated;
--   SELECT set_config('request.jwt.claims', '{"sub":"<owner id>","role":"authenticated"}', true);
--   INSERT INTO public.links (short_code, original_url, user_id)
--   VALUES ('rls-probe', 'https://example.com', '<owner id>');
--   ROLLBACK;
--
-- OPTIONAL, not part of this migration (same finding): get_links_by_ids (018)
-- is still callable with the anon key, and since 020 no link is ownerless, so
-- the anonymous path has nothing left to serve. Revoke it only once
-- src/hooks/useLinks.ts no longer calls it for signed-out visitors, and once
--   SELECT count(*) FROM public.links WHERE user_id IS NULL;
-- returns 0:
--   REVOKE EXECUTE ON FUNCTION public.get_links_by_ids(uuid[]) FROM anon, public;
--
-- ROLLBACK:
--   CREATE POLICY "Users can create links" ON public.links
--     FOR INSERT WITH CHECK (auth.uid() = user_id);

BEGIN;

DROP POLICY IF EXISTS "Users can create links" ON public.links;

-- IF EXISTS keeps a re-run harmless, so check the outcome: an INSERT (or ALL)
-- policy under another name would leave the direct path open.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'links'
               AND cmd IN ('INSERT', 'ALL')) THEN
    RAISE EXCEPTION 'links still has an INSERT or ALL policy; drop it by its remote name (see preflight 1)';
  END IF;
END $$;

COMMIT;
