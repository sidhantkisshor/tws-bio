# Navigation Fix

## If you're seeing a "demo page" while logged in:

### Quick Fix - Navigate Manually:

1. **Go to Dashboard**: Navigate to `https://tws.bio/dashboard`
2. **Go to Homepage**: Navigate to `https://tws.bio`

### To Logout:

Since you mentioned there's no logout button, try these URLs directly:

1. **Method 1**: Create a simple logout page by visiting:
   ```
   https://tws.bio/api/auth/signout
   ```

2. **Method 2**: Clear your browser cookies for tws.bio

3. **Method 3**: Open browser DevTools (F12) → Application → Cookies → Clear all cookies for tws.bio

## The Issue:

You might be seeing a cached page or you're on the wrong URL. The app has these pages:

- `/` (homepage) - Shows link creation form
- `/dashboard` - Shows your saved links (requires login)
- `/login` - Login page
- `/signup` - Signup page

## To verify you're logged in:

1. Open DevTools (F12)
2. Go to Application → Cookies
3. Look for `sb-` cookies (Supabase auth cookies)

If those exist, you're logged in and should be able to access `/dashboard`.