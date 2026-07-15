-- Fixes: H-4 / G-5 (fresh apply aborts on missing policy)
-- The "Public can view active links" policy was already replaced by the
-- "Combined view policy" in migration 003, so on any schema built from the
-- current migration set this policy no longer exists. Without IF EXISTS a
-- fresh apply raises "policy ... does not exist" and aborts the run.
-- Adding IF EXISTS makes this idempotent -- a no-op on current schemas, and
-- still a clean drop on any legacy schema where the policy lingers.
DROP POLICY IF EXISTS "Public can view active links" ON links;
