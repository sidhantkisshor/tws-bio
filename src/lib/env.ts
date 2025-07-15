// Environment variable validation
export function validateEnv() {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_APP_URL',
    'NEXT_PUBLIC_SHORT_DOMAIN'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      `Please check your .env.local file and ensure all variables are set.`
    );
  }

  // Validate Supabase URL format
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!supabaseUrl.includes('.supabase.co') && !supabaseUrl.includes('localhost')) {
    console.warn('NEXT_PUBLIC_SUPABASE_URL does not appear to be a valid Supabase URL');
  }

  // Validate anon key format (should be a JWT)
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (anonKey.length < 100) {
    console.warn('NEXT_PUBLIC_SUPABASE_ANON_KEY appears to be too short');
  }

  return {
    supabaseUrl,
    supabaseAnonKey: anonKey,
    appUrl: process.env.NEXT_PUBLIC_APP_URL!,
    shortDomain: process.env.NEXT_PUBLIC_SHORT_DOMAIN!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
  };
}