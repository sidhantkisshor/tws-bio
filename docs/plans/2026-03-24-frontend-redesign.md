# Frontend Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign all tws.bio frontend pages with shadcn/ui, TWS-branded dark theme, and a full dashboard overhaul with analytics and link management.

**Architecture:** Install shadcn/ui with a custom dark theme matching TWS branding (dark background, green accents, Inter + DM Serif Display). Restyle all existing pages (home, login, signup) and rebuild the dashboard with sidebar navigation, overview stats, link management (edit/delete/toggle/QR), and analytics charts. No database schema changes — all data comes from existing tables.

**Tech Stack:** Next.js 16, shadcn/ui, Tailwind CSS v4, Recharts (via shadcn Charts), react-qr-code, DM Serif Display (Google Font), Supabase

**Design doc:** `docs/plans/2026-03-24-frontend-redesign-design.md`

**Note:** No test framework is configured. Verify each task by running `npm run build` (type checks + build) and visual inspection via `npm run dev`.

---

### Task 1: Install shadcn/ui and Configure Dark Theme

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Create: `src/components/ui/button.tsx` (via CLI)
- Create: `src/components/ui/input.tsx` (via CLI)
- Create: `src/components/ui/card.tsx` (via CLI)
- Create: `src/lib/utils.ts` (CLI will try to create — merge with existing)
- Create/Modify: `components.json`

**Step 1: Initialize shadcn/ui**

Run: `npx shadcn@latest init`

When prompted:
- Style: **New York**
- Base color: **Neutral**
- CSS variables: **yes**
- Location for `components.json`: project root
- Aliases: `@/components`, `@/lib/utils`, `@/hooks`

**Important:** shadcn init will overwrite `src/lib/utils.ts`. Our existing file already has `cn()` plus `generateShortCode`, `getShortUrl`, `isValidUrl`, `BLOCKED_HOSTNAMES`. After init, restore the additional functions from git — shadcn only needs `cn()`.

**Step 2: Install core components**

```bash
npx shadcn@latest add button input card label badge separator tooltip sonner tabs table dialog alert-dialog select radio-group sheet
```

**Step 3: Install chart component**

```bash
npx shadcn@latest add chart
```

This wraps Recharts (already in `package.json`).

**Step 4: Override CSS variables with TWS theme**

Replace the shadcn-generated CSS variables in `src/app/globals.css` with the TWS dark theme. The file should contain:

```css
@import "tailwindcss";

@plugin "tailwindcss-animate";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar-background: var(--sidebar-background);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
  --radius-lg: var(--radius);
  --radius-md: calc(var(--radius) - 2px);
  --radius-sm: calc(var(--radius) - 4px);
  --font-family-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
}

:root {
  --radius: 0.625rem;
  --background: oklch(0.13 0 0);
  --foreground: oklch(0.97 0 0);
  --card: oklch(0.16 0 0);
  --card-foreground: oklch(0.97 0 0);
  --popover: oklch(0.16 0 0);
  --popover-foreground: oklch(0.97 0 0);
  --primary: oklch(0.65 0.2 145);
  --primary-foreground: oklch(1 0 0);
  --secondary: oklch(0.2 0 0);
  --secondary-foreground: oklch(0.97 0 0);
  --muted: oklch(0.18 0 0);
  --muted-foreground: oklch(0.55 0 0);
  --accent: oklch(0.18 0 0);
  --accent-foreground: oklch(0.97 0 0);
  --destructive: oklch(0.6 0.22 25);
  --destructive-foreground: oklch(1 0 0);
  --border: oklch(0.2 0 0);
  --input: oklch(0.2 0 0);
  --ring: oklch(0.65 0.2 145);
  --chart-1: oklch(0.65 0.2 145);
  --chart-2: oklch(0.6 0.15 200);
  --chart-3: oklch(0.55 0.12 260);
  --chart-4: oklch(0.65 0.18 60);
  --chart-5: oklch(0.6 0.16 330);
  --sidebar-background: oklch(0.14 0 0);
  --sidebar-foreground: oklch(0.97 0 0);
  --sidebar-primary: oklch(0.65 0.2 145);
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-accent: oklch(0.2 0 0);
  --sidebar-accent-foreground: oklch(0.97 0 0);
  --sidebar-border: oklch(0.2 0 0);
  --sidebar-ring: oklch(0.65 0.2 145);
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

Note: The oklch values map to our TWS hex colors: `--primary` ≈ `#00B03B`, `--background` ≈ `#0a0a0a`, `--card` ≈ `#111111`, `--muted` ≈ `#1a1a1a`, `--destructive` ≈ `#FF4433`. Adjust oklch values after visual inspection if needed.

**Step 5: Update layout.tsx**

Add `class="dark"` to `<html>`, add DM Serif Display font, add Sonner Toaster:

```tsx
import type { Metadata } from "next";
import { Inter, DM_Serif_Display } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const dmSerif = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  style: "italic",
  variable: "--font-dm-serif",
});

export const metadata: Metadata = {
  title: "tws.bio - URL Shortener",
  description: "Shorten your URLs with tws.bio — by Trading with Sidhant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${dmSerif.variable}`}>
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
```

**Step 6: Restore utils.ts**

After shadcn init, ensure `src/lib/utils.ts` has both the shadcn `cn()` function AND the original `generateShortCode`, `getShortUrl`, `isValidUrl`, `BLOCKED_HOSTNAMES` exports. Check git diff and merge.

**Step 7: Verify**

Run: `npm run build`
Expected: Clean build, no type errors. The app should render with a dark background.

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: install shadcn/ui with TWS dark theme and DM Serif Display"
```

---

### Task 2: Build Shared Navigation Component

**Files:**
- Create: `src/components/Navbar.tsx`
- Modify: `src/app/page.tsx` (use new Navbar)
- Modify: `src/components/HomeHeader.tsx` (replace with Navbar)

**Step 1: Create Navbar component**

Create `src/components/Navbar.tsx` — a floating pill-shaped nav bar:

- Client component (needs `useAuth()` for conditional nav items)
- Container: `fixed top-4 left-1/2 -translate-x-1/2 z-50`, pill shape with `rounded-full bg-card/80 backdrop-blur-md border border-border`
- Left: "tws.bio" text logo (`font-bold text-lg text-foreground`)
- Right: nav links (Home, Dashboard if logged in, Login/Sign up if not)
- CTA: green Button for "Sign up" (or "Dashboard" when logged in)
- Mobile: Sheet with hamburger menu icon trigger
- Loading state: skeleton placeholder for auth-dependent items

**Step 2: Create minimal Footer component**

Create `src/components/Footer.tsx`:

- "tws.bio" branding, copyright 2025, "by Trading with Sidhant" link
- Centered, muted text, minimal padding

**Step 3: Replace HomeHeader**

Delete the contents of `src/components/HomeHeader.tsx` and re-export from Navbar, or update `src/app/page.tsx` to import Navbar directly. Remove `HomeHeader.tsx` if no longer needed.

**Step 4: Verify**

Run: `npm run dev`, check home page renders with new floating nav.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add floating Navbar and Footer components"
```

---

### Task 3: Redesign Home Page

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/HomeInteractive.tsx`
- Modify: `src/components/CreateLinkForm.tsx`
- Modify: `src/components/LinksList.tsx`

**Step 1: Redesign page.tsx**

Rewrite the home page layout:
- Dark background (inherits from body)
- Navbar at top
- Hero section: "Short Links, *Big Impact*" — wrap "Big Impact" in `<span className="font-[family-name:var(--font-dm-serif)] italic text-primary">Big Impact</span>`
- Subtitle in muted-foreground
- `<HomeInteractive />` below hero
- Features section restyled with Card components, dark backgrounds, green icon accents
- "Powered by Trading with Sidhant" badge at bottom linking to tradingwithsidhant.com
- Footer component

**Step 2: Restyle CreateLinkForm**

Replace raw HTML form with shadcn components:
- Outer wrapper: `<Card>` with `bg-card border-border`
- URL input: shadcn `<Input>` with `bg-muted` background
- Shorten button: shadcn `<Button>` (green primary) inline with input (flex row)
- Advanced toggle: styled text button with chevron
- Deep link fields: shadcn `<Input>`, `<Label>`, `<RadioGroup>` for link type
- Auto-detection banner: green-themed (replace purple)
- Success/error: replace inline divs with `toast()` from Sonner
- Custom code input: prefix label + Input in flex row

**Step 3: Restyle LinksList**

Replace raw HTML with shadcn components:
- Each link: `<Card>` with hover state
- Short URL: `font-mono text-primary`
- Copy button: shadcn `<Button variant="ghost" size="sm">`
- Deep link badge: shadcn `<Badge>`
- Loading: skeleton shimmer using `bg-muted animate-pulse` (keep existing pattern)

**Step 4: Verify**

Run: `npm run dev`, check home page. Verify:
- Dark theme renders correctly
- Link creation works (creates via RPC, shows toast)
- Deep link auto-detection still works
- Anonymous links display from localStorage
- Copy to clipboard works

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: redesign home page with TWS dark theme"
```

---

### Task 4: Redesign Auth Pages

**Files:**
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/signup/page.tsx`

**Step 1: Redesign login page**

Rewrite `src/app/login/page.tsx`:
- Dark full-screen background
- Centered `<Card className="max-w-md w-full bg-card border-border">`
- "tws.bio" wordmark above card (link to `/`)
- shadcn `<Input>` with `<Label>` for email/password, `bg-muted` backgrounds
- Primary green `<Button>` full-width for submit
- Separator with "Or continue with" text
- Outline `<Button variant="outline">` for Google OAuth with inline SVG
- Error display: `toast.error()` from Sonner (replace inline red banner)
- Footer link to signup
- Keep all existing auth logic (`signInWithPassword`, `signInWithOAuth`)

**Step 2: Redesign signup page**

Same treatment as login — mirror the layout. Keep existing signup logic.

**Step 3: Verify**

Run: `npm run dev`, navigate to `/login` and `/signup`. Verify:
- Dark themed cards render
- Email/password login works
- Google OAuth redirects correctly
- Error states show as toasts
- Links between login/signup work

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: redesign auth pages with dark theme"
```

---

### Task 5: Build Dashboard Layout with Sidebar

**Files:**
- Create: `src/app/dashboard/layout.tsx`
- Modify: `src/app/dashboard/page.tsx`
- Create: `src/components/dashboard/DashboardSidebar.tsx`
- Create: `src/app/dashboard/links/page.tsx`
- Create: `src/app/dashboard/analytics/page.tsx`

**Step 1: Create dashboard layout**

Create `src/app/dashboard/layout.tsx` — a Server Component that:
- Checks auth (redirect to `/login` if no user) — move auth check from `page.tsx` to `layout.tsx`
- Renders sidebar + main content area in a flex row
- Sidebar: fixed width left, main content fills remaining space
- Uses shadcn `SidebarProvider` + `Sidebar` components (if shadcn sidebar is installed) OR a custom flex layout

**Step 2: Create DashboardSidebar**

Create `src/components/dashboard/DashboardSidebar.tsx` — Client Component:
- "tws.bio" logo at top
- Nav items using `Link` from `next/link`: Overview (`/dashboard`), Links (`/dashboard/links`), Analytics (`/dashboard/analytics`)
- Active state: green left border + `bg-accent` background on current route (use `usePathname()`)
- User email + sign out button at bottom (sign out via form POST to `/auth/signout`)
- Mobile: render as Sheet (slide-in from left) with hamburger trigger

**Step 3: Refactor dashboard/page.tsx as Overview tab**

Strip the auth check (moved to layout). This becomes the Overview tab — for now, keep the existing stats and table but restyled. Full stats/charts come in Task 6.

**Step 4: Create placeholder pages**

Create `src/app/dashboard/links/page.tsx` and `src/app/dashboard/analytics/page.tsx` with placeholder content ("Coming soon" in a Card). These get filled in Tasks 7 and 8.

**Step 5: Verify**

Run: `npm run dev`, navigate to `/dashboard`. Verify:
- Auth redirect works (unauthenticated → `/login`)
- Sidebar renders with nav items
- Clicking nav items navigates between tabs
- Mobile hamburger opens Sheet sidebar

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add dashboard layout with sidebar navigation"
```

---

### Task 6: Dashboard Overview Tab

**Files:**
- Modify: `src/app/dashboard/page.tsx`
- Create: `src/components/dashboard/StatCard.tsx`
- Create: `src/components/dashboard/ClickChart.tsx`

**Step 1: Create StatCard component**

Create `src/components/dashboard/StatCard.tsx`:
- Props: `{ title: string; value: string | number; icon?: ReactNode }`
- Uses shadcn `<Card>`: title in `text-sm text-muted-foreground`, value in `text-3xl font-bold font-mono`
- Green accent for the icon

**Step 2: Create ClickChart component**

Create `src/components/dashboard/ClickChart.tsx` — Client Component:
- Uses shadcn `ChartContainer` + Recharts `AreaChart`
- Props: `{ data: { date: string; clicks: number }[] }`
- Green fill/stroke for the area, dark grid lines
- Tooltip using shadcn `ChartTooltip`

**Step 3: Rewrite dashboard/page.tsx**

Server Component that:
- Fetches from Supabase: total links count, total clicks (sum), active links count
- Fetches clicks grouped by day (last 30 days) for the chart — query `clicks` table with `clicked_at` grouped by date
- Renders: 4 StatCards in a grid, ClickChart below, recent 5 links in a mini Table

**Step 4: Verify**

Run: `npm run dev`, check `/dashboard`. Verify stat cards show correct numbers, chart renders.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add dashboard overview with stats and click chart"
```

---

### Task 7: Dashboard Links Tab

**Files:**
- Modify: `src/app/dashboard/links/page.tsx`
- Create: `src/components/dashboard/LinkActions.tsx` (Client Component)
- Create: `src/components/dashboard/EditLinkDialog.tsx` (Client Component)
- Create: `src/components/dashboard/DeleteLinkDialog.tsx` (Client Component)
- Create: `src/components/dashboard/QRCodeDialog.tsx` (Client Component)

**Step 1: Build the links table page**

Rewrite `src/app/dashboard/links/page.tsx` as a Server Component:
- Fetch paginated links (reuse existing pagination logic from old `dashboard/page.tsx`)
- Render shadcn `<Table>` with columns: Short Code (`font-mono text-primary`), Original URL (truncated), Type (`<Badge>`), Clicks (`font-mono`), Status (active/inactive badge), Created (date), Actions
- Pagination at bottom (Previous/Next links)

**Step 2: Create LinkActions component**

Create `src/components/dashboard/LinkActions.tsx` — Client Component:
- Row of icon buttons: Copy, Edit, QR Code, Toggle Active, Delete
- Copy: copies short URL to clipboard, shows toast
- Edit: opens `EditLinkDialog`
- QR: opens `QRCodeDialog`
- Toggle: calls Supabase `update` on `links` table to flip `is_active`, refreshes page via `router.refresh()`
- Delete: opens `DeleteLinkDialog`

**Step 3: Create EditLinkDialog**

Create `src/components/dashboard/EditLinkDialog.tsx` — Client Component:
- shadcn `<Dialog>` with form fields: Original URL, Custom Code (readonly display), Deep Link fields (iOS, Android, Fallback), Expiration date, Max clicks
- On save: calls Supabase `update` on `links` table directly (client-side), shows toast, calls `router.refresh()`
- Uses shadcn `<Input>`, `<Label>`, `<Button>`

**Step 4: Create DeleteLinkDialog**

Create `src/components/dashboard/DeleteLinkDialog.tsx` — Client Component:
- shadcn `<AlertDialog>` with destructive confirmation
- On confirm: calls Supabase `delete` on `links` table (or sets `is_active = false`), shows toast, calls `router.refresh()`

**Step 5: Create QRCodeDialog**

Create `src/components/dashboard/QRCodeDialog.tsx` — Client Component:
- shadcn `<Dialog>` displaying QR code via `react-qr-code` library
- QR value: the full short URL (`getShortUrl(shortCode)`)
- Dark background QR with green foreground to match theme
- "Download PNG" button: renders QR to canvas, triggers download

**Step 6: Verify**

Run: `npm run dev`, check `/dashboard/links`. Verify:
- Links table renders with all columns
- Copy works (toast confirmation)
- Edit dialog opens, saves changes
- Delete dialog confirms and removes link
- QR code displays and downloads
- Toggle active/inactive works
- Pagination works

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: add links management tab with edit, delete, QR, and toggle"
```

---

### Task 8: Dashboard Analytics Tab

**Files:**
- Modify: `src/app/dashboard/analytics/page.tsx`
- Create: `src/components/dashboard/DeviceChart.tsx`
- Create: `src/components/dashboard/BrowserChart.tsx`
- Create: `src/components/dashboard/ReferrerChart.tsx`
- Create: `src/components/dashboard/DateRangePicker.tsx`

**Step 1: Create chart wrapper components**

Each chart is a Client Component using shadcn `ChartContainer`:

- `DeviceChart.tsx`: Recharts `PieChart` (donut) — props: `{ data: { device: string; count: number }[] }`
- `BrowserChart.tsx`: Recharts `BarChart` — props: `{ data: { browser: string; count: number }[] }`
- `ReferrerChart.tsx`: Recharts horizontal `BarChart` — props: `{ data: { referrer: string; count: number }[] }`

All use TWS theme colors from chart CSS variables.

**Step 2: Create DateRangePicker**

Create `src/components/dashboard/DateRangePicker.tsx` — Client Component:
- Simple select dropdown with presets: Last 7 days, Last 30 days, Last 90 days, All time
- Uses shadcn `<Select>`
- Updates URL search params (`?range=7d`) to trigger server-side data refetch

**Step 3: Build analytics page**

Rewrite `src/app/dashboard/analytics/page.tsx` as a Server Component:
- Reads `searchParams` for date range (default 30 days)
- Queries `clicks` table with date filter:
  - Clicks by day (for existing ClickChart — reuse from Task 6)
  - Clicks grouped by `device_type` (for DeviceChart)
  - Clicks grouped by `browser_name` (for BrowserChart)
  - Clicks grouped by `os_name` (for a secondary bar chart or combined with browser)
  - Clicks grouped by `referrer_domain` (top 10, for ReferrerChart)
- All queries filter by `user_id` (only show the logged-in user's link clicks via join on `links`)
- Layout: DateRangePicker at top, then a 2-column grid of chart Cards

**Step 4: Verify**

Run: `npm run dev`, check `/dashboard/analytics`. Verify:
- Charts render with real data
- Date range picker changes the data
- Empty states handled (no clicks → "No data yet" message)

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add analytics tab with device, browser, and referrer charts"
```

---

### Task 9: Polish and Final Verification

**Files:**
- Various — touch-ups across all pages

**Step 1: Add gradient glow effects**

Add the warm gradient glow effect to:
- Home page: behind the hero section or CTA area
- Dashboard: subtle glow behind stat cards
- Implementation: `absolute` positioned div with `radial-gradient` and blur, behind content with `pointer-events-none`

**Step 2: Green button glow**

Add to primary buttons globally (in `button.tsx` default variant or via a custom class):
`hover:shadow-[0_0_20px_rgba(0,176,59,0.3)]` with transition

**Step 3: Clean up old styles**

- Remove any leftover `bg-white`, `text-gray-*`, `bg-gray-*` classes from old design
- Ensure all pages are consistently dark
- Check mobile responsiveness on all pages

**Step 4: Full build verification**

Run: `npm run build`
Expected: Clean build, no type errors, no warnings.

Run: `npm run dev` and manually check every page:
- `/` — hero, form, link creation, recent links
- `/login` — form, Google OAuth, error state
- `/signup` — form, Google OAuth
- `/dashboard` — overview stats, chart
- `/dashboard/links` — table, copy, edit, delete, QR, toggle, pagination
- `/dashboard/analytics` — charts, date picker

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add gradient effects and polish all pages"
```

---

## Dependency Order

```
Task 1 (shadcn + theme)
  └→ Task 2 (Navbar + Footer)
       └→ Task 3 (Home page)
       └→ Task 4 (Auth pages)
       └→ Task 5 (Dashboard layout)
            └→ Task 6 (Overview tab)
            └→ Task 7 (Links tab)
            └→ Task 8 (Analytics tab)
                 └→ Task 9 (Polish)
```

Tasks 3, 4, 5 can run in parallel after Task 2.
Tasks 6, 7, 8 can run in parallel after Task 5.
Task 9 runs last.
