# tws.bio — "The Clean Fill" beauty + speed pass (2026-07-16)

Synthesized from a 5-surface multi-agent audit (44 beauty / 35 perf findings) and 3 independent
design proposals. Direction: **the execution terminal for links** — tws.bio should feel like the
tool a trader trusts at market open. Green stops being ambient glow and becomes a *signal*: it
appears when something happened (created, copied, active, up). Everything else goes quiet so the
signal reads.

## Locked brand (do not change)

- Dark-only theme (#0a0a0a), green pair #00B03B (text/strokes) / #00802B (solid fills with white
  foreground) — never swap the roles (AA contrast rule, documented in globals.css:65-67).
- Inter body + DM Serif Display italic display accent. No new font downloads; the monospace "data
  voice" is the zero-byte system mono stack.
- No light mode, no teal, no blue accents (the iOS-blue interstitial button dies).

## Signature: the TickerChip + fill flash

`src/components/TickerChip.tsx` — one shared component: inline-flex monospace chip
(`font-mono text-sm tabular-nums`, bg-card, 1px border-border, rounded-md, px-2.5 py-1) with a 2px
green tick bar on its left edge (`border-l-2 border-l-primary-text`), showing `tws.bio/<code>`,
optional copy affordance. On copy (and on create) the chip fires a one-time **320ms fill flash**
(`@keyframes tick-fill` — background from `--tick-flash` to transparent) and the Copy icon swaps to
a green Check for 1.2s (opacity crossfade only). `aria-live="polite"` announces "Short link copied".
Reduced motion: no flash — the icon swap alone confirms.

Deployed at: CreateLinkForm success state (as an "execution ticket": chip + terminal-label row
`FILLED · HH:MM:SS UTC · → destination-host`), LinksList rows (home), dashboard LinksTable
short-code column, QRCodeDialog header, and one **static demo chip** in the marketing hero (server
HTML, no JS — `tws.bio/yt-live` style specimen).

Second structural device: the **mono eyebrow** — `font-mono text-[11px] uppercase tracking-[0.14em]
text-muted-foreground` — the standard section label ("WHY TWS.BIO", empty states, dead-link status
lines "410 — LINK EXPIRED"). Use to open sections, never on every small element.

DM Serif italic ration: exactly ONE italic accent per page, always `text-primary-text` (hero "Big
Impact", auth wordmark `tws.<i>bio</i>`, resources h1 accent). Never in body copy or buttons.

## Token layer (globals.css)

- `color-scheme: dark;` in `:root`; thin scrollbars `* { scrollbar-width: thin; scrollbar-color:
  var(--border) transparent; }` in @layer base.
- `--brand: #00B03B;` and repoint `--primary-text: var(--brand)`, `--ring: var(--brand)`.
- `--tick-flash: rgb(0 176 59 / 0.16);` — used only by the fill-flash animation, never resting.
- `--gradient-hero: radial-gradient(ellipse at center, rgb(0 176 59 / 0.35) 0%, rgb(0 128 43 /
  0.18) 40%, transparent 70%);` — replaces inline glows (kills the off-brand teal stop).
- Elevation: `--shadow-overlay: 0 8px 30px rgb(0 0 0 / 0.55), 0 2px 8px rgb(0 0 0 / 0.35);`
  `--shadow-raised: 0 1px 2px rgb(0 0 0 / 0.4);` (theme entries `--shadow-*` so `shadow-overlay`
  utility works). Overlay shadow on Dialog/AlertDialog/Select/Sheet content; cards stay ring-only.
- `::selection { background-color: var(--primary); color: var(--primary-foreground); }`
- Autofill fix: `input:-webkit-autofill { -webkit-box-shadow: 0 0 0 1000px #1a1a1a inset;
  -webkit-text-fill-color: #FAFAFA; caret-color: #FAFAFA; }`
- `--font-mono` theme entry (ui-monospace stack) so `font-mono` is deliberate.
- `@keyframes tick-fill` + a `.animate-tick-fill` utility; global reduced-motion backstop
  `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms
  !important; transition-duration: 0.01ms !important; } }`.

## Motion budget (total)

1. 320ms fill flash on create/copy (signature; reduced-motion: none).
2. Copy→Check opacity crossfade 150ms, shown 1.2s.
3. Interstitial CSS spinner 0.8s linear (reduced-motion: hidden, static text).
4. 150ms transition-colors on hover/focus.
Nothing else moves. No transforms/scale, no scroll reveals, no glow pulses.

## Per-surface changes

Full per-issue detail lives in the audit JSON:
`C:\Users\Sidhant\AppData\Local\Temp\claude\e--Dev-Projects-Cursor-tws-bio\4aadaa68-a32a-461e-a4a6-002c4b4a827a\tasks\w6k4vq9qn.output`

### Home / marketing
Center hero on one axis with the form column (text-center, mx-auto, max-w-3xl); server-rendered
CTAs (`buttonVariants()`: primary "Create your first link" → /signup, ghost "Sign in" → /login);
static demo TickerChip under the paragraph; glow uses `--gradient-hero` at reduced opacity; feature
section gets mono eyebrow + h2 with one serif-italic word, icon chips (`bg-primary/10` +
`text-primary-text`), `hover:border-primary/30`; truthful copy on "Fast & Free" (drop "no
tracking"/"no rate limits"); delete duplicate "Powered by" block; kill the flicker cascade (Navbar
optimistic logged-out default seeded from cached getSession, LinksList renders nothing unless anon
ids or user exist, CreateLinkForm gate is the anonymous optimistic default); page stays statically
prerendered (no cookies()); OG/Twitter metadata + generated opengraph-image.

### Auth
Shared AuthCard shell + GoogleAuthButton; wordmark `tws.<i serif green>bio</i>`; `--gradient-hero`
glow behind card at low opacity; all links `text-primary-text`; surface `?error=auth_failed` as
destructive alert (useSearchParams in Suspense); Loader2 spinners staying disabled through
redirect; minLength=6 + hint + eye toggle, drop confirm field; lazy-load supabase client in
handlers.

### Redirect interstitial + dead-link pages ([shortCode]/route.ts)
Full rebrand inline (CSP requires inline): #0a0a0a body, color-scheme/theme-color meta, #111111
card 1px #1f1f1f radius 10px, mono eyebrow "REDIRECTING", CSS spinner (#00B03B top border,
reduced-motion hidden), button fill #00802B hover #00B03B, tws.bio wordmark footer. Dead links →
branded mono status pages ("404 — LINK NOT FOUND", "410 — LINK EXPIRED", "410 — CLICK LIMIT
REACHED", "403 — FLAGGED AS UNSAFE") with same status codes. Cancel 2.5s fallback timer on
visibilitychange/pagehide. `Cache-Control: private, no-store` on interstitial + dead-link 200/4xx.
Security invariants untouched: CSP `default-src 'none'…`, X-Frame-Options DENY, jsonEscapeForHtml,
SAFE_DEEP_LINK_SCHEMES, visible fallback anchor from first paint, redirect stays uncacheable.
Perf: module-level singleton supabase-js client (no cookies) for this route's RPCs.

### Dashboard (additive only — it just had 3 audit rounds)
LinksTable short codes + QRCodeDialog header → TickerChip; copy actions fire the fill flash;
Campaigns page adopts the standard shell; Analytics gets destructive error card on clicksError,
StatCard reuse for Total Clicks, mb-8→mb-6; add analytics/loading.tsx + campaigns/loading.tsx,
patch dashboard/loading.tsx parity; BarChart/DonutChart migrate to chart tokens/ChartTooltipContent
(preserve margin left:80 / YAxis width:75, MiniSparkline fixed size, TrendChip semantics);
QRCodeDialog reads colors via getComputedStyle, `bg-card` wrapper; tabular-nums on all numerics;
remove `blur-[100px]` from the dashboard glow.

### Resources
Adopt Navbar + Footer chrome (pt-28), hero-treated h1 with serif accent, mono eyebrow per group,
hover/focus states on rows, link from Footer.

### UI kit
Button: add `hover:bg-primary/90`, fix `[a]:hover` → `[a&]:hover`, drop variant `transition-shadow`
that twMerge-kills the base transition; base transition → explicit property list (not
transition-all). Scrims: bg-black/10 → bg-black/60 in dialog/alert-dialog/sheet; shadow-overlay on
overlay content. Focus rings standardized `focus-visible:ring-3 ring-ring/50 border-ring`; remove
TabsTrigger double outline; badge `rounded-4xl` → `rounded-full`. Sonner: hardcode `theme="dark"`,
remove next-themes import + dependency. chart.tsx: collapse THEMES to dark-only.

## Performance plan

1. **proxy.ts matcher → allowlist**: `['/', '/dashboard/:path*', '/login', '/signup',
   '/resources', '/auth/:path*']` — short-code clicks stop paying a Supabase session refresh.
2. **Analytics page**: replace raw-clicks fetch + JS aggregation with existing lib/analytics.ts
   RPC helpers (SECURITY INVOKER — clicks RLS applies) in one Promise.all incl. prior-period count.
3. **Dashboard overview**: collapse 3 sequential DB waves → derive linkIds/totalClicks from one
   query wave; use getClicksOverTime RPC for the 30-day chart.
4. **Links page**: count + data queries in Promise.all (keep over-range clamp fallback).
5. **React cache() `getUser`** helper in lib/supabase/server.ts; use in dashboard layout + pages.
6. **Home client bundle**: single shared auth resolution (module-level dedupe in useAuth +
   getSession seed); dynamic-import supabase client inside effects/handlers; useLinks gated on
   auth resolution; narrow select('*') to used columns.
7. **LinkActions**: dynamic-import QRCodeDialog/EditLinkDialog/DeleteLinkDialog (react-qr-code
   ~51KB leaves the table bundle).
8. **Remove next-themes**; collapse chart.tsx dual-theme style emission.
9. Delete dead code: SocialIcon.tsx, config/bio.ts.

## Global cautions (from audit — binding)

- No anonymous link creation path may reappear; sign-in gate semantics unchanged.
- CreateLinkForm `initialUser` contract with dashboard/create must keep working.
- Keep detectDeepLinks behind its dynamic import.
- Keep home page statically prerenderable (no cookies()/headers() in its tree).
- getSession() may seed UI optimistically, but security-sensitive checks stay on getUser().
- Preserve aria wiring (aria-invalid/describedby, role=alert, aria-busy/live), double-submit
  guards, error-vs-empty distinction, TrendChip semantics, UTC date math, over-range clamp.
- Analytics RPCs stay SECURITY INVOKER; never make /[shortCode] redirects cacheable.
- Auth `?error=auth_failed` key is a contract with auth/callback/route.ts.
