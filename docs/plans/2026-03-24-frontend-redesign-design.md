# Frontend Redesign — Design Document

**Date**: 2026-03-24
**Status**: Approved

## Summary

Full frontend redesign of tws.bio using shadcn/ui with a custom TWS-branded dark theme. Inspired by tradingwithsidhant.com's visual identity (dark backgrounds, green accents, Inter + DM Serif Display typography) while maintaining its own personality as a URL shortener tool.

## Design Decisions

- **Approach**: shadcn/ui + custom theme (over hand-rolled or hybrid)
- **Style**: Dark & polished, TWS-inspired (not an exact clone)
- **Scope**: All pages — home, login, signup, dashboard (full overhaul with analytics + link management)
- **No schema changes**: All new features use existing `clicks` and `links` table data

## Theme & Design Tokens

### Colors (CSS variables)

| Token | Value | Usage |
|---|---|---|
| `--background` | `#0a0a0a` | Page background |
| `--foreground` | `#FAFAFA` | Primary text |
| `--card` | `#111111` | Card/panel backgrounds |
| `--card-foreground` | `#FAFAFA` | Card text |
| `--muted` | `#1a1a1a` | Subtle backgrounds, input fields |
| `--muted-foreground` | `#999999` | Secondary text |
| `--border` | `#1f1f1f` | Borders, dividers |
| `--primary` | `#00B03B` | CTAs, active states, links |
| `--primary-foreground` | `#FFFFFF` | Text on green buttons |
| `--destructive` | `#FF4433` | Delete, errors |
| `--accent` | `#1a1a1a` | Hover backgrounds |
| `--ring` | `#00B03B` | Focus rings |

### Typography

- **Body/UI**: Inter (via `next/font/google`, already configured)
- **Display accents**: DM Serif Display italic — sparingly on hero keywords and section titles
- **Monospace**: system `font-mono` for short codes, stats, click counts

### Special Effects

- Warm gradient glow (`radial-gradient` with orange/teal/green) behind key CTA sections
- Subtle `border-border` on cards
- Green glow on primary buttons: `shadow-[0_0_20px_rgba(0,176,59,0.3)]`

## Layout & Navigation

### Global

- Full dark background, max-width 1200px centered content, full-bleed backgrounds
- `<html class="dark">` permanently — no light mode toggle
- Sonner toast notifications replace inline success/error banners

### Navigation

- Floating pill-shaped nav bar, centered, semi-transparent (`bg-card/80 backdrop-blur-md`), rounded-full, subtle border
- Logo: "tws.bio" in Inter bold white
- Nav items: Home, Dashboard (logged in), Login/Sign up (logged out)
- Green "Sign up" CTA (or "Dashboard" when logged in)
- Mobile: Sheet sidebar via hamburger

### Footer

- Minimal: "tws.bio" branding, copyright, link to tradingwithsidhant.com

## Page Designs

### Home Page (`/`)

**Hero:**
- Left-aligned headline: "Short Links, *Big Impact*" — "Big Impact" in DM Serif Display italic green
- Subtitle: descriptive one-liner
- No CTA buttons — the form IS the CTA

**Link creation form:**
- Card with single-line input + inline green "Shorten" button
- Collapsible advanced options (custom code, deep links)
- Success: short URL + copy button with green checkmark
- Deep link auto-detection banner (green-themed)

**Recent links:**
- Card-based list below form, same localStorage pattern for anonymous users
- Each link: short URL (monospace green), original URL, click count, copy button

**Brand connection:**
- "Powered by Trading with Sidhant" badge linking to tradingwithsidhant.com

### Auth Pages (`/login`, `/signup`)

- Centered card (`bg-card border-border rounded-xl`, max-w 400px) on dark background
- "tws.bio" wordmark above card
- Dark input backgrounds (`bg-muted`), green focus rings
- Full-width green primary button
- Google OAuth outline button below divider
- Error states use destructive red

### Dashboard (`/dashboard`) — Full Overhaul

**Layout:**
- Sidebar navigation (collapsible on mobile via Sheet)
  - "tws.bio" logo
  - Nav: Overview, Links, Analytics
  - User info + sign out at bottom
- Main content area

**Overview tab (default):**
- 4 stat cards: Total Links, Total Clicks, Avg Clicks/Link, Active Links
- Monospace numbers, green accent for positive indicators
- Click trend area chart (last 30 days) via shadcn Charts
- Recent links quick table (top 5)

**Links tab:**
- Full table: Short Code (monospace), Original URL, Type badge, Clicks, Status, Created, Actions
- Actions: copy, toggle active/inactive, edit (Dialog), delete (AlertDialog)
- Edit dialog: original URL, custom code, deep link fields, expiration, max clicks
- QR code button per link → Dialog with QR display + PNG download (uses `react-qr-code`)
- Server-side pagination

**Analytics tab:**
- Date range picker
- Charts: clicks over time (area), device breakdown (donut), browser breakdown (bar), OS breakdown (bar), top referrers (horizontal bar)
- All data from existing `clicks` table — no schema changes

## shadcn/ui Components to Install

**Layout**: Card, Separator, Sheet, Sidebar
**Forms**: Button, Input, Label, Select, RadioGroup, Dialog, AlertDialog
**Data**: Table, Badge, Tabs
**Charts**: Chart (Recharts wrapper)
**Feedback**: Tooltip, Sonner (toast)

## Custom Components to Build

- `StatCard` — icon, label, value, trend indicator
- `LinkActions` — copy/edit/delete/QR action row
- `ClickChart`, `DeviceChart`, `BrowserChart`, `ReferrerChart` — chart wrappers
- `QRCodeDialog` — QR display + PNG download
- `DashboardSidebar` — sidebar nav with responsive Sheet fallback

## What Stays the Same

- All Supabase clients (browser, server, middleware) — untouched
- Database schema — no migrations
- RPCs (create_link, create_deep_link, record_click, increment_link_clicks)
- Anonymous link creation with localStorage (`anon_links`)
- Deep link auto-detection (`detectDeepLinks()`)
- Redirect handler (`[shortCode]/route.ts`)
- Auth routes (`/auth/callback`, `/auth/signout`)
- Proxy (`src/proxy.ts`)
- Server/client boundary pattern on home page
