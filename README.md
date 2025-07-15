# tws.bio - URL Shortener with Analytics

A powerful URL shortener with advanced analytics, mobile deep linking, and custom domains built with Next.js and Supabase.

## Features

- 🔗 **URL Shortening** - Create short, memorable links
- 📊 **Advanced Analytics** - Track clicks, locations, devices, browsers, and referrers
- 📱 **Mobile Deep Linking** - Direct users to specific app content with smart fallbacks
- 🎯 **UTM Tracking** - Built-in UTM parameter tracking
- 📱 **QR Codes** - Auto-generated QR codes for each link
- 🔐 **Privacy Controls** - Password protection, expiration dates, and click limits
- 🌐 **Custom Domains** - Use your own domain for branded links
- 🚀 **High Performance** - Built on Next.js App Router and Supabase

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Realtime)
- **Analytics**: Custom implementation with detailed tracking
- **Deployment**: Optimized for Vercel/Netlify

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

1. Add your domain (tws.bio) in Vercel/Netlify domain settings
2. Update DNS records as instructed
3. Update `NEXT_PUBLIC_SHORT_DOMAIN` environment variable
4. Add the domain to Supabase allowed redirect URLs

## Database Schema

The app uses the following main tables:

- **links** - Stores shortened links with metadata
- **clicks** - Detailed analytics for each click
- **profiles** - User profile information
- **custom_domains** - User's custom domains
- **api_keys** - API access keys

## API Usage

Coming soon: RESTful API for programmatic link creation and analytics retrieval.

## Mobile Deep Linking

The app supports deep linking for iOS and Android apps:

1. **iOS**: Uses Universal Links format (e.g., `myapp://path/to/content`)
2. **Android**: Uses App Links format (e.g., `myapp://path/to/content`)
3. **Fallback**: Automatically redirects to App Store/Play Store or custom URL

## Analytics Tracked

- Click count and unique visitors
- Device type (desktop, mobile, tablet)
- Browser and OS information
- Geographic location (country, region, city)
- Referrer information
- UTM parameters
- Time-based analytics

## Security Features

- Row Level Security (RLS) enabled on all tables
- Secure authentication with Supabase Auth
- API rate limiting
- Click fraud detection (bot filtering)

## Future Enhancements

- [ ] Bulk link import/export
- [ ] A/B testing for links
- [ ] Webhook notifications
- [ ] Advanced analytics dashboard
- [ ] Team collaboration features
- [ ] API with SDK
- [ ] Browser extension
- [ ] Mobile app

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.
