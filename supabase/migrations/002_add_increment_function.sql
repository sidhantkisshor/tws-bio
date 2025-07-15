-- Create function to increment link clicks atomically
CREATE OR REPLACE FUNCTION increment_link_clicks(link_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE links 
  SET total_clicks = total_clicks + 1 
  WHERE id = link_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;