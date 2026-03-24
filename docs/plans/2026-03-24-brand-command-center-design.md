# Brand Command Center — Design

**Date**: 2026-03-24
**Goal**: Transform tws.bio from a generic URL shortener into a personal brand tool for @tradingwithsidhant.

## Context

- Single user (Sidhant), not a SaaS product
- Audience: free public followers across Instagram, YouTube, Telegram, X, etc.
- Design feel: clean & minimal — fast, professional, no frills
- Priority order: analytics > campaigns > resource hub > link-in-bio

## Feature 1: Rich Analytics Dashboard

**Route**: `/dashboard` (replaces current basic dashboard)

### Layout

- **Stat cards row**: Total Clicks, Total Links, Top Referrer, Top OS
- **Time range picker**: 7d / 30d / 90d / All (via `searchParams`, server-side)
- **Clicks over time**: Area chart (recharts)
- **Referrers**: Horizontal bar chart
- **Devices**: Donut chart (mobile / desktop / tablet)
- **Countries**: Horizontal bar chart
- **Browsers**: Donut chart
- **Links table**: Enhanced with campaign column, each row clickable

### Per-link detail view

**Route**: `/dashboard/links/[id]`

Same chart components filtered to a single link.

### Data source

All from existing `clicks` table — no new tables needed. Server Components query Supabase with date filters, pass data to thin `'use client'` chart wrappers using recharts (already installed).

### UTM parsing

`record_click` RPC already has UTM columns but they aren't populated. The redirect handler (`[shortCode]/route.ts`) will parse `?utm_source=...&utm_medium=...` etc. from the incoming request URL and pass them to `record_click`.

### Key decisions

- No real-time / polling — refresh to see new data
- Time filtering is server-side via searchParams, not client state
- Charts are the only `'use client'` islands on the dashboard

---

## Feature 2: Campaigns

### New table

```sql
CREATE TABLE campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### Link association

Add `campaign_id uuid REFERENCES campaigns(id)` (nullable) to `links` table. A link belongs to zero or one campaign.

### Routes

- `/dashboard/campaigns` — list of campaigns with total links, total clicks, date range
- `/dashboard/campaigns/[id]` — aggregate analytics for all links in a campaign (reuses same chart components)

### UI flow

- **Create link form**: Optional "Campaign" dropdown — pick existing or type new name to create inline
- **Dashboard**: Tab toggle `[All Links] [Campaigns]` at top

### No UTM auto-generation

Campaign is a higher-level grouping defined by the user, not derived from UTM params.

---

## Feature 3: Resource Hub

**Route**: `/resources` (public)

### Approach

Static config file `src/config/resources.ts` — no database. Single user, edit-and-deploy workflow.

```ts
export const resources = [
  {
    category: "Brokers",
    items: [
      { title: "Zerodha", url: "...", description: "My primary broker" },
    ]
  },
  // ...
]
```

### Page

- Server Component, fully static, zero JS
- Grouped by category, clean list layout
- Resource links can optionally use tws.bio short links for click tracking

---

## Feature 4: Link-in-Bio Homepage

**Route**: `/` (replaces current marketing homepage)

### Approach

Static config file `src/config/bio.ts` — no database.

```ts
export const bio = {
  name: "Sidhant",
  handle: "@tradingwithsidhant",
  tagline: "Trading, markets & options",
  avatar: "/avatar.jpg",
  links: [
    { label: "YouTube", url: "...", icon: "youtube" },
    { label: "Instagram", url: "...", icon: "instagram" },
    { label: "Telegram Group", url: "...", icon: "telegram" },
    { label: "Resources", url: "/resources", icon: "bookmark" },
  ]
}
```

### Page

- Server Component, zero JS — loads instantly
- White background, avatar + name + tagline at top, stacked link buttons
- SVG icons for socials
- `/resources` is one of the bio entries

### What gets relocated

- "Short Links, Big Impact" hero + features section + `HomeInteractive` → behind `/dashboard`
- Login/signup → accessible via `/login` URL only (small footer link or no public link)
- Anonymous link creation → removed (single user, no longer needed)

---

## What gets removed from codebase

- Anonymous link creation via localStorage (`anon_links`)
- Public-facing signup flow promotion (signup page stays but isn't linked)
- Generic marketing copy on homepage
- Features section on homepage

## Architecture notes

- Reusable chart components in `src/components/charts/` wrapping recharts
- Analytics queries as server-side functions in `src/lib/analytics.ts`
- Config files in `src/config/` for bio and resources (static, no DB)
- One new DB table (`campaigns`) + one new column on `links` (`campaign_id`)
- One new migration file for campaigns + campaign_id
