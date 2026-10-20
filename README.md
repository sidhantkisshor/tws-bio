# tws.bio

A private short-link and click-tracking tool for one business (Trading with Sidhant). It replaces a Bitly subscription: short links on `tws.bio`, mobile deep links that open the native app, campaigns, and per-link click stats.

- **Sign-in is required to create links.** Anyone can follow a short link. Only a signed-in user can make one.
- **Accounts are invite-only.** Signups are disabled on the Supabase project, so `/signup` only says so. The owner adds users in the Supabase dashboard.
- **Sign-in methods:** email and password, or Google OAuth. Google is the only OAuth provider. There is no GitHub sign-in.

## Stack

Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4, Supabase (PostgreSQL + Auth), Vitest. Hosted on Vercel, with functions in `bom1` (Mumbai) next to the database. Node 24 (`.nvmrc`).

## Local setup

1. Use Node 24 and run `npm install`.
2. Create a Supabase project. On its empty database, run every file in `supabase/migrations/` in filename order (SQL editor or `psql`).
   - 001 to 021 are applied to production. The numbered files from 022 on are written but not yet applied to production. Each of those has a read-only preflight in its header to run against production first.
   - The timestamped `20250715073856_drop_public_links_policy.sql` sorts last. It is a `DROP POLICY IF EXISTS`, so that position is fine.
3. In Supabase Auth:
   - **Providers:** enable Google.
   - **URL Configuration:** set the Site URL to `http://localhost:3000` and add `http://localhost:3000/auth/callback` to the Redirect URLs.
   - **Users:** add your own account here. The app has no sign-up form.
4. Create `.env.local`:

   ```env
   # Required
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   NEXT_PUBLIC_APP_URL=              # e.g. http://localhost:3000
   NEXT_PUBLIC_SHORT_DOMAIN=         # e.g. tws.bio

   # Optional, all safe to leave unset (see "Measurement and Tagging" in CLAUDE.md)
   SGTM_CLICKS=                      # server-only, must be `on` to send clicks at all (off by default)
   SGTM_ENDPOINT=                    # server-only, GTM server container base URL
   GA4_MEASUREMENT_ID=               # server-only, GA4 property the server container forwards to
   SGTM_CID_SALT=                    # server-only, salt for the derived cookieless client ID
   SHORTLINK_AUTOTAG=                # optional, `off` disables default utm auto-tagging (anything else, or unset, leaves it on)
   ```

   Keep `SGTM_CLICKS` off unless `GA4_MEASUREMENT_ID` points at a GA4 property used only for clicks. In the property the business website reports into, each click lands as a new, unattributed user and drowns the real numbers.

5. Run `npm run dev` and open http://localhost:3000.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint (flat config in `eslint.config.mjs`) |
| `npm run test` | Vitest unit tests, run once |
| `npm run typecheck` | Type-check with `tsc --noEmit` |

## Architecture

See [CLAUDE.md](CLAUDE.md): routes, the three Supabase clients, the redirect handler and its security checks, measurement and tagging, the database and its migrations, and known issues.
