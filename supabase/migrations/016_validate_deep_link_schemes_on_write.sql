-- Migration 016: Enforce deep-link scheme validation at the table level
-- Fixes: XSS / scheme-validation bypass via direct table UPDATE.
--
-- Migration 011 validates ios/android/fallback schemes only on the CREATE
-- path (create_deep_link RPC). The dashboard edit dialog
-- (src/components/dashboard/EditLinkDialog.tsx) calls
-- supabase.from('links').update(...) directly, bypassing that check, so a
-- javascript:/data:/vbscript: payload could be persisted. The redirect
-- handler (route.ts) already rejects these schemes at read time, so this is
-- defense-in-depth -- but the invariant belongs in the DB so it holds for
-- ANY write path (edit dialog, future code, manual SQL), not just the RPC.
--
-- CHECK constraints reject the dangerous schemes case-insensitively on
-- trimmed values. NULL/empty and normal app schemes (app://, youtube:, etc.)
-- remain allowed. Idempotent: drops any prior copy before re-adding.

ALTER TABLE public.links
  DROP CONSTRAINT IF EXISTS links_ios_deep_link_safe_scheme;
ALTER TABLE public.links
  ADD CONSTRAINT links_ios_deep_link_safe_scheme
  CHECK (
    ios_deep_link IS NULL
    OR lower(trim(ios_deep_link)) !~ '^(javascript|data|vbscript):'
  );

ALTER TABLE public.links
  DROP CONSTRAINT IF EXISTS links_android_deep_link_safe_scheme;
ALTER TABLE public.links
  ADD CONSTRAINT links_android_deep_link_safe_scheme
  CHECK (
    android_deep_link IS NULL
    OR lower(trim(android_deep_link)) !~ '^(javascript|data|vbscript):'
  );

ALTER TABLE public.links
  DROP CONSTRAINT IF EXISTS links_fallback_url_safe_scheme;
ALTER TABLE public.links
  ADD CONSTRAINT links_fallback_url_safe_scheme
  CHECK (
    fallback_url IS NULL
    OR lower(trim(fallback_url)) !~ '^(javascript|data|vbscript):'
  );
