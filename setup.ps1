# Setup script for tws.bio

Write-Host "Setting up tws.bio URL Shortener..." -ForegroundColor Green

# Create .env.local file
$envContent = @"
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://ucpkchokkbyskhggcjww.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcGtjaG9ra2J5c2toZ2djand3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2NzYxNTgsImV4cCI6MjA2NjI1MjE1OH0.Z23SsNAJQ-nhNInBMimUzY0TCb2Cs8MODI3zsmJz7_o

# Get this from your Supabase dashboard: Settings > API > Service Role Key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Domain Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SHORT_DOMAIN=localhost:3000
"@

# Write to .env.local
$envContent | Out-File -FilePath ".env.local" -Encoding UTF8

Write-Host "✅ Created .env.local file" -ForegroundColor Green

# Display next steps
Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/ucpkchokkbyskhggcjww" -ForegroundColor Cyan
Write-Host "2. Navigate to SQL Editor" -ForegroundColor Cyan
Write-Host "3. Copy the contents of supabase/migrations/001_create_url_shortener_schema.sql" -ForegroundColor Cyan
Write-Host "4. Run the migration in SQL Editor" -ForegroundColor Cyan
Write-Host "5. Go to Settings > API and copy the service_role key" -ForegroundColor Cyan
Write-Host "6. Replace 'your-service-role-key-here' in .env.local with the actual key" -ForegroundColor Cyan
Write-Host "`nThen run: npm run dev" -ForegroundColor Green 