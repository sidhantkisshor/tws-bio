# tws.bio - URL Shortener with Analytics

A URL shortener with click analytics and mobile deep linking, built with Next.js and Supabase.

## Features

- **URL Shortening** — Create short, memorable links (anonymous or authenticated)
- **Click Analytics** — Track total clicks per link with browser, OS, and device info
- **Mobile Deep Linking** — Auto-detect 30+ platforms and generate iOS/Android deep links with fallback URLs
- **Link Controls** — Expiration dates and max click limits

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4
- **Backend**: Supabase (PostgreSQL, Auth)
- **Deployment**: Vercel

## Setup Instructions

### 1. Clone the repository

```bash
cd tws-bio
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the migration from `supabase/migrations/001_create_url_shortener_schema.sql`
3. Enable Google and GitHub OAuth providers in Authentication > Providers (optional)
4. Add your redirect URLs in Authentication > URL Configuration:
   - Site URL: `http://localhost:3000` (for development)
   - Redirect URLs: `http://localhost:3000/auth/callback`

### 4. Configure environment variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Domain configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SHORT_DOMAIN=localhost:3000
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import your repository in Vercel
3. Add the environment variables
4. Update the environment variables with production URLs:
   - `NEXT_PUBLIC_APP_URL`: Your Vercel app URL
   - `NEXT_PUBLIC_SHORT_DOMAIN`: tws.bio (or your custom domain)
5. Deploy!

### Custom Domain Setup

1. Add your domain (tws.bio) in Vercel domain settings
2. Update DNS records as instructed
3. Update `NEXT_PUBLIC_SHORT_DOMAIN` environment variable
4. Add the domain to Supabase allowed redirect URLs

## Database Schema

The app uses the following main tables:

- **links** — Shortened links with metadata (short_code, original_url, deep link fields, expiration, click limits)
- **clicks** — Per-click analytics records (IP, user agent, browser, OS, device type, referrer)
- **profiles** — User profile information (extends auth.users)

Note: `custom_domains` and `api_keys` tables exist in the schema but are not wired into the application.

## Security Features

- Row Level Security (RLS) enabled on all tables
- SECURITY DEFINER RPCs with `SET search_path = 'public'`
- URL validation with SSRF protection (blocks private IPs, cloud metadata, hex/octal encodings)
- XSS prevention in deep link HTML responses
- Secure authentication with Supabase Auth (PKCE flow)

## License

This project is licensed under the MIT License.
