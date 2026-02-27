-- Cleanup: ensure only the combined view policy exists on links
-- These are idempotent (IF EXISTS) so safe to run even if already dropped
DROP POLICY IF EXISTS "Public can view active links" ON links;
DROP POLICY IF EXISTS "Users can view own links" ON links;

-- Ensure the combined policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'links' AND policyname = 'Combined view policy'
  ) THEN
    CREATE POLICY "Combined view policy" ON links
      FOR SELECT USING (is_active = true OR auth.uid() = user_id);
  END IF;
END $$;

-- Ensure link_analytics table has proper RLS if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'link_analytics') THEN
    ALTER TABLE link_analytics ENABLE ROW LEVEL SECURITY;

    -- Allow anonymous inserts for analytics tracking
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'link_analytics' AND policyname = 'Anyone can insert analytics'
    ) THEN
      CREATE POLICY "Anyone can insert analytics" ON link_analytics
        FOR INSERT WITH CHECK (true);
    END IF;

    -- Allow users to view analytics for their own links
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'link_analytics' AND policyname = 'Users can view own link analytics'
    ) THEN
      CREATE POLICY "Users can view own link analytics" ON link_analytics
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM links
            WHERE links.id = link_analytics.link_id
            AND links.user_id = auth.uid()
          )
        );
    END IF;
  END IF;
END $$;
