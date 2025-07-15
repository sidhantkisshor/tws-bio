-- Fix mutable function search paths (security issue)
ALTER FUNCTION public.increment_link_clicks SET search_path = 'public';
ALTER FUNCTION public.update_updated_at_column SET search_path = 'public';

-- Add missing indexes for foreign keys (performance)
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_domains_user_id ON public.custom_domains(user_id);

-- Combine duplicate RLS policies for better performance
DROP POLICY IF EXISTS "Public can view active links" ON links;
DROP POLICY IF EXISTS "Users can view own links" ON links;

CREATE POLICY "Combined view policy" ON links
  FOR SELECT USING (is_active = true OR auth.uid() = user_id);

-- Add index for click analytics queries
CREATE INDEX IF NOT EXISTS idx_clicks_created_at_link_id ON public.clicks(link_id, clicked_at DESC);