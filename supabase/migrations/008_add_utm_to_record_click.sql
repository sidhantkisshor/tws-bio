-- Migration 008: Add UTM parameter support to record_click RPC
-- The clicks table already has utm_source, utm_medium, utm_campaign, utm_term,
-- utm_content columns, but the record_click function does not accept or insert them.

CREATE OR REPLACE FUNCTION record_click(
  p_link_id UUID,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_referrer_url TEXT DEFAULT NULL,
  p_browser_name TEXT DEFAULT NULL,
  p_os_name TEXT DEFAULT NULL,
  p_device_type device_type DEFAULT 'unknown',
  p_utm_source TEXT DEFAULT NULL,
  p_utm_medium TEXT DEFAULT NULL,
  p_utm_campaign TEXT DEFAULT NULL,
  p_utm_term TEXT DEFAULT NULL,
  p_utm_content TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Verify the link exists and is active before recording
  IF NOT EXISTS (SELECT 1 FROM links WHERE id = p_link_id AND is_active = true) THEN
    RETURN; -- silently skip for invalid/inactive links
  END IF;

  INSERT INTO clicks (
    link_id, ip_address, user_agent, referrer_url,
    browser_name, os_name, device_type,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content
  )
  VALUES (
    p_link_id,
    CASE WHEN p_ip_address IS NOT NULL THEN p_ip_address::inet ELSE NULL END,
    p_user_agent, p_referrer_url,
    p_browser_name, p_os_name, p_device_type,
    p_utm_source, p_utm_medium, p_utm_campaign, p_utm_term, p_utm_content
  );
END;
$$;
