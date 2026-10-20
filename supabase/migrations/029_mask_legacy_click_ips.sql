-- Migration 029: Mask the full visitor IPs left on old clicks (audit db-6)
--
-- APPLIED to production on 2026-10-20 (preflight and verify passed). Run the preflight below against the remote
-- database first: the remote has drifted from these files before (CLAUDE.md).
--
-- What changes: every clicks row whose ip_address is still a full address
-- (mask length 32 for IPv4, 128 for IPv6) is masked exactly as
-- record_click_and_increment masks a new click, with the same expressions as
-- 017, 020 and 023: IPv4 keeps its first 24 bits (203.0.113.57 becomes
-- 203.0.113.0/24) and IPv6 its first 48. Rows that are already masked, rows
-- with no IP, and every other column are left as they are, so click counts and
-- charts do not change.
--
-- Why: masking on insert started on 2026-07-15. Clicks recorded before that
-- still hold the visitor's full IP, which is personal data (India's DPDP Act
-- 2023, GDPR), kept with no end date.
--
-- Approved by the owner on 2026-10-20: "Mask old IPs only". Audit db-6 also
-- proposed a retention job for old click details; the owner chose masking
-- only, so there is none here. That approves the approach: applying it still
-- needs the owner's go-ahead once the preflight results are in.
--
-- THIS CANNOT BE UNDONE. Once it commits, the full addresses are gone. There is
-- deliberately no backup table and no export: a backup would keep the very raw
-- IPs this file removes.
--
-- It stands alone: it changes only clicks.ip_address and does not depend on
-- 022-028, so it can go before or after them. Click inserts keep working while
-- it runs (the UPDATE locks only the rows it changes), and running it again
-- changes nothing.
--
-- PREFLIGHT (read-only)
--
-- None of these returns a full IP, so no address lands in query history or a
-- chat transcript. Keep it that way: never select ip_address itself.
--
-- 1. The live masking. Safe when there is exactly one row and its body masks
--    with network(set_masklen(v_inet, 24)) when family(v_inet) = 4 and
--    network(set_masklen(v_inet, 48)) otherwise. If it uses other lengths,
--    change 24 and 48 in the SET of the UPDATE below (and in preflight 4) to
--    match, so old rows end up like new ones. If it does not mask at all,
--    stop and fix the function first.
--      SELECT pg_get_functiondef(p.oid)
--      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--      WHERE n.nspname = 'public' AND p.proname = 'record_click_and_increment';
--
-- 2. The rows this file changes, by address family. Expect last_click no later
--    than 2026-07-15. A later one means a full IP was stored after masking
--    started: stop and find out what stored it (preflight 1 first), or clicks
--    recorded after this runs keep their full IPs.
--      SELECT family(ip_address) AS family, count(*) AS unmasked,
--             min(clicked_at) AS first_click, max(clicked_at) AS last_click
--      FROM public.clicks
--      WHERE masklen(ip_address) = CASE WHEN family(ip_address) = 4 THEN 32 ELSE 128 END
--      GROUP BY 1 ORDER BY 1;
--
-- 3. Every family and mask length on file. Expect only 4/32 and 6/128 (masked
--    here) and 4/24 and 6/48 (masked already). This file leaves any other
--    length alone: look at those rows before applying.
--      SELECT family(ip_address) AS family, masklen(ip_address) AS masklen, count(*)
--      FROM public.clicks WHERE ip_address IS NOT NULL
--      GROUP BY 1, 2 ORDER BY 1, 2;
--
-- 4. A sample of what will be stored: a.b.c.0/24 for IPv4, a /48 prefix for
--    IPv6. A value of ::/48 is an address whose first 48 bits are zero,
--    usually an IPv4 address stored in IPv6 form (::ffff:a.b.c.d); the
--    function masks a new one the same way.
--      SELECT id, clicked_at,
--             CASE WHEN family(ip_address) = 4 THEN network(set_masklen(ip_address, 24))
--                  ELSE network(set_masklen(ip_address, 48)) END AS masked
--      FROM public.clicks
--      WHERE masklen(ip_address) = CASE WHEN family(ip_address) = 4 THEN 32 ELSE 128 END
--      ORDER BY clicked_at DESC LIMIT 10;
--
-- VERIFY after applying: no full address is left. Expect 0.
--   SELECT count(*) AS unmasked FROM public.clicks
--   WHERE masklen(ip_address) = CASE WHEN family(ip_address) = 4 THEN 32 ELSE 128 END;
-- Preflight 3 then shows the same number of rows per family as before, now
-- all at 24 or 48 (plus any other length it showed before).
--
-- ROLLBACK: none. This cannot be rolled back: the full addresses are not kept
-- anywhere.

BEGIN;

-- The masking record_click_and_increment applies to a new click, on the rows
-- that still hold a full address. Masked rows and NULLs fail the WHERE, which
-- is also why a second run changes nothing.
UPDATE public.clicks
SET ip_address = CASE WHEN family(ip_address) = 4
                      THEN network(set_masklen(ip_address, 24))
                      ELSE network(set_masklen(ip_address, 48))
                 END
WHERE masklen(ip_address) = CASE WHEN family(ip_address) = 4 THEN 32 ELSE 128 END;

COMMIT;
