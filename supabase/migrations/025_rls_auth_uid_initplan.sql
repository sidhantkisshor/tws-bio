-- Migration 025: Evaluate auth.uid() once per query in RLS policies (audit db-3)
--
-- APPLIED to production on 2026-10-20 (preflight and verify passed). Run the preflight below against the remote
-- database first. Policy names on the remote have drifted from these files
-- before (the live links SELECT policy was once "View links policy", a name no
-- migration creates), so ADJUST EVERY POLICY NAME BELOW TO THE PREFLIGHT 1
-- OUTPUT BEFORE APPLYING.
--
-- What changes: every policy in public that calls auth.uid() bare is rewritten
-- to call (SELECT auth.uid()). ALTER POLICY changes only the expression: each
-- policy keeps its name, command and roles, and there is no moment without a
-- policy. The clicks policy also changes shape, from a correlated EXISTS into
-- links to link_id IN (SELECT id FROM links WHERE user_id = ...). Who can see
-- or change which rows does not change.
--
-- Why: a bare auth.uid() is a function call Postgres may make once per row,
-- and each call parses the request's JWT claims. Wrapped in a scalar subquery
-- it becomes an InitPlan that runs once per query. On clicks it matters most:
-- every analytics RPC scans the caller's click rows under this policy, and the
-- IN form builds the caller's link ids once instead of probing links for each
-- click row. Supabase's advisor flags the bare form as auth_rls_initplan.
--
-- The links INSERT policy ("Users can create links") is left alone: 026 drops
-- it.
--
-- PREFLIGHT (read-only)
--
-- 1. Every policy in public. SAVE THIS OUTPUT: it is the rollback source.
--    Safe when every policy below is listed on the same table with the same
--    command, and its qual or with_check is the bare auth.uid() form from 001,
--    009 and 012. Then edit this file to match:
--      - a different name: change that ALTER POLICY line to the remote name;
--      - a policy below that is not listed: delete its line;
--      - a listed policy that calls auth.uid() bare but is not below (for
--        example one on link_analytics, see 005): add a line in the same
--        pattern;
--      - an UPDATE policy whose with_check calls auth.uid(): add
--        WITH CHECK ((SELECT auth.uid()) = <same column>) to its line.
--    The check at the end of this file aborts if any bare call is left.
--      SELECT tablename, policyname, cmd, roles, qual, with_check
--      FROM pg_policies WHERE schemaname = 'public' ORDER BY 1, 2;
--
-- 2. What two accounts can see, in a transaction that changes nothing. Run it
--    for the owner (3633ce1a-cbab-4ee5-9a60-1bf0bf5b2c5f) and for an account
--    that owns no links:
--      SELECT u.id FROM auth.users u
--      WHERE NOT EXISTS (SELECT 1 FROM public.links l WHERE l.user_id = u.id) LIMIT 1;
--    The owner sees their links and clicks; the other account sees 0 and 0.
--      BEGIN;
--      SET LOCAL ROLE authenticated;
--      SELECT set_config('request.jwt.claims', '{"sub":"<user id>","role":"authenticated"}', true);
--      SELECT count(*) AS links FROM public.links;
--      SELECT count(*) AS clicks FROM public.clicks;
--      ROLLBACK;
--
-- VERIFY after applying: preflight 2 returns the same counts for both
-- accounts, and in preflight 1 every rewritten policy shows
-- "( SELECT auth.uid() AS uid)".
--
-- ROLLBACK: ALTER POLICY each line back to the qual or with_check saved from
-- preflight 1. With the local definitions (001, 009, 012) that is:
--   BEGIN;
--   ALTER POLICY "Users can view own profile" ON public.profiles USING (auth.uid() = id);
--   ALTER POLICY "Users can update own profile" ON public.profiles USING (auth.uid() = id);
--   ALTER POLICY "Users can insert own profile" ON public.profiles WITH CHECK (auth.uid() = id);
--   ALTER POLICY "Owners can view their links" ON public.links USING (auth.uid() = user_id);
--   ALTER POLICY "Users can update own links" ON public.links USING (auth.uid() = user_id);
--   ALTER POLICY "Users can delete own links" ON public.links USING (auth.uid() = user_id);
--   ALTER POLICY "Users can view clicks for own links" ON public.clicks
--     USING (EXISTS (SELECT 1 FROM public.links
--                    WHERE links.id = clicks.link_id AND links.user_id = auth.uid()));
--   ALTER POLICY "Users can view own campaigns" ON public.campaigns USING (auth.uid() = user_id);
--   ALTER POLICY "Users can insert own campaigns" ON public.campaigns WITH CHECK (auth.uid() = user_id);
--   ALTER POLICY "Users can update own campaigns" ON public.campaigns USING (auth.uid() = user_id);
--   ALTER POLICY "Users can delete own campaigns" ON public.campaigns USING (auth.uid() = user_id);
--   ALTER POLICY "Users can view own domains" ON public.custom_domains USING (auth.uid() = user_id);
--   ALTER POLICY "Users can create domains" ON public.custom_domains WITH CHECK (auth.uid() = user_id);
--   ALTER POLICY "Users can update own domains" ON public.custom_domains USING (auth.uid() = user_id);
--   ALTER POLICY "Users can delete own domains" ON public.custom_domains USING (auth.uid() = user_id);
--   ALTER POLICY "Users can view own API keys" ON public.api_keys USING (auth.uid() = user_id);
--   ALTER POLICY "Users can create API keys" ON public.api_keys WITH CHECK (auth.uid() = user_id);
--   ALTER POLICY "Users can delete own API keys" ON public.api_keys USING (auth.uid() = user_id);
--   COMMIT;

BEGIN;

-- ============================================================================
-- profiles
-- ============================================================================
ALTER POLICY "Users can view own profile" ON public.profiles
  USING ((SELECT auth.uid()) = id);
ALTER POLICY "Users can update own profile" ON public.profiles
  USING ((SELECT auth.uid()) = id);
ALTER POLICY "Users can insert own profile" ON public.profiles
  WITH CHECK ((SELECT auth.uid()) = id);

-- ============================================================================
-- links (the INSERT policy is dropped by 026)
-- ============================================================================
ALTER POLICY "Owners can view their links" ON public.links
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can update own links" ON public.links
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can delete own links" ON public.links
  USING ((SELECT auth.uid()) = user_id);

-- ============================================================================
-- clicks
-- ============================================================================
-- The subquery runs once per query and each click row becomes a lookup in
-- its result. The links policy still applies inside it, as it did inside the
-- EXISTS.
ALTER POLICY "Users can view clicks for own links" ON public.clicks
  USING (link_id IN (SELECT id FROM public.links WHERE user_id = (SELECT auth.uid())));

-- ============================================================================
-- campaigns
-- ============================================================================
ALTER POLICY "Users can view own campaigns" ON public.campaigns
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can insert own campaigns" ON public.campaigns
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can update own campaigns" ON public.campaigns
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can delete own campaigns" ON public.campaigns
  USING ((SELECT auth.uid()) = user_id);

-- ============================================================================
-- custom_domains and api_keys (no app code, but the advisor flags them too)
-- ============================================================================
ALTER POLICY "Users can view own domains" ON public.custom_domains
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can create domains" ON public.custom_domains
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can update own domains" ON public.custom_domains
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can delete own domains" ON public.custom_domains
  USING ((SELECT auth.uid()) = user_id);

ALTER POLICY "Users can view own API keys" ON public.api_keys
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can create API keys" ON public.api_keys
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can delete own API keys" ON public.api_keys
  USING ((SELECT auth.uid()) = user_id);

-- Abort if any policy still calls auth.uid() bare: the remote has a policy
-- this file does not name (see preflight 1). pg_policies prints the wrapped
-- form as "( SELECT auth.uid() AS uid)", so whatever is left after removing
-- that text is a bare call.
--
-- The remote (preflight of 2026-10-20) had most policies calling
-- public.uid(), a SQL wrapper that returns auth.uid(). pg_policies prints it as
-- "uid()", which the text check above cannot see, so the second check reads
-- the policy's dependencies instead and refuses any call to the wrapper.
DO $$
DECLARE
  v_bare text;
  v_wrapper text;
BEGIN
  SELECT string_agg(format('%s.%s', tablename, policyname), ', ')
  INTO v_bare
  FROM pg_policies
  WHERE schemaname = 'public'
    AND NOT (tablename = 'links' AND cmd = 'INSERT')
    AND (replace(coalesce(qual, ''), '( SELECT auth.uid() AS uid)', '') LIKE '%auth.uid()%'
      OR replace(coalesce(with_check, ''), '( SELECT auth.uid() AS uid)', '') LIKE '%auth.uid()%');

  IF v_bare IS NOT NULL THEN
    RAISE EXCEPTION 'Policies still calling auth.uid() bare: %', v_bare;
  END IF;

  IF to_regprocedure('public.uid()') IS NOT NULL THEN
    SELECT string_agg(format('%s.%s', c.relname, pol.polname), ', ')
    INTO v_wrapper
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace cn ON cn.oid = c.relnamespace
    JOIN pg_depend d ON d.classid = 'pg_policy'::regclass AND d.objid = pol.oid
      AND d.refclassid = 'pg_proc'::regclass
    WHERE cn.nspname = 'public'
      AND d.refobjid = to_regprocedure('public.uid()')
      AND NOT (c.relname = 'links' AND pol.polcmd = 'a');

    IF v_wrapper IS NOT NULL THEN
      RAISE EXCEPTION 'Policies still calling public.uid(): %', v_wrapper;
    END IF;
  END IF;
END $$;

COMMIT;
