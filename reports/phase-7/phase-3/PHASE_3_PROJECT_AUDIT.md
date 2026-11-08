# NEXUS Phase 3 — Project Audit
**Date:** 2026-11-07  
**Auditor:** Claude Sonnet 4.6  
**Branch:** main (commit `cdf6867`)  
**Status:** Phase 3A — Audit & Blueprint only. No code modified.

---

## 1. Git State

| Field | Value |
|---|---|
| Branch | `main` |
| Latest commit | `cdf6867` — `feat(web): finalize Phase 2 landing page` |
| Working tree | **Clean** |
| Ahead of origin | **1 commit** (Phase 2 not pushed) |

Phase 2 is fully committed locally. The working tree is clean. Phase 3 can begin without any cleanup.

---

## 2. Monorepo Structure

```
nexus/
├── apps/
│   ├── web/                   # React 19 + Vite + Tailwind CSS v4 frontend
│   └── api/                   # Express 5 + TypeScript backend
├── packages/
│   └── domain/                # Shared types, scoring engine (@nexus/domain)
├── config/                    # Frozen business logic JSON
│   ├── scoring.json           # Skill scoring weights + thresholds [FROZEN]
│   ├── roles.json             # Role definitions [FROZEN]
│   ├── job-matching.json      # Job matching rules [FROZEN]
│   ├── skills.json            # Skill definitions [FROZEN]
│   └── technologies.json      # Technology classifications [FROZEN]
├── reports/
│   └── phase-7/
│       ├── phase-1/           # 8 discovery + design reports
│       ├── phase-2/           # 8 landing page implementation reports
│       └── phase-3/           # (this directory — Phase 3 reports)
├── e2e/                       # Playwright E2E tests
├── docker-compose.yml         # Local MongoDB (nexus_dev)
└── package.json               # Workspace root
```

---

## 3. Technology Stack

### Frontend (apps/web)

| Technology | Version | Notes |
|---|---|---|
| React | 19 | Latest; concurrent mode available |
| TypeScript | ~5.6 | Strict mode |
| Vite | 8 | HMR, proxy to localhost:4000 |
| Tailwind CSS | 4 | CSS `@theme` token system (no v3 config file) |
| React Router | 6 | `<Routes>` / `<Route>` declarative API |
| Three.js | — | Lazy-loaded for landing page hero only |
| Vitest | — | Unit + component tests |
| Playwright | — | E2E tests (isolated nexus_e2e database) |

**No data-fetching library** — all API calls use a custom `useApiResource` hook backed by the `fetch`-based `api/client.ts`.

**No component library** — all components are bespoke. No shadcn/ui, Radix, Headless UI, or Material installed.

**No form library** — forms are managed with native state.

**No chart library** — no Recharts, Chart.js, D3, or similar installed.

### Backend (apps/api)

| Technology | Version | Notes |
|---|---|---|
| Node.js | 20+ | |
| Express | 5 | |
| TypeScript | ~5.6 | |
| MongoDB | — | Via Mongoose |
| JWT | — | Custom session service, `nexus_session` cookie |
| GitHub OAuth | — | OAuth 2.0 flow |
| LLM | Optional | Groq / Google Gemini / OpenAI-compat |
| Playwright | — | E2E on separate port 4001 |

---

## 4. Frontend Architecture

### Entry and routing

```
main.tsx
  → initTheme()          # Applies data-theme before React renders (prevents FOUC)
  → ReactDOM.createRoot()
    → <BrowserRouter>
      → <App>
        → <AuthProvider>
          → <AppShell>
            → <Routes>
              → "/"            → <LandingPage>  (public, no auth)
              → "/*"           → Authenticated shell
                → <AuthGate>   (redirects to "/" if unauthenticated)
                  → nested <Routes> for all app pages
```

### Authenticated shell (App.tsx)

The shell is currently **inline in App.tsx** — not extracted into a reusable layout component. It includes:
- `DesktopSidebar` (w-56, hidden below lg breakpoint)
- `MobileHeader` (hamburger, sticky)
- `MobileDrawer` (focus-trapped overlay)
- `main#main-content` (max-w-5xl, px-4 py-6)
- `SidebarNav` (NAV_GROUPS constant, active-state via manual `location.pathname` match)

**Key observation:** The shell uses hardcoded Tailwind classes referencing the Gold Signal semantic slot names (`bg-white`, `border-slate-200`, `text-indigo-700`). It does not use separate theme files or CSS modules. This is correct — the token override system in index.css handles both themes.

**Key limitation:** The sidebar is **fixed-width** (w-56) with **no collapse/expand** behavior. It has no tooltip support when narrow. It has no keyboard shortcut to toggle it.

### Navigation structure

The `NAV_GROUPS` constant in App.tsx defines 4 groups / 12 items:

| Group | Route | Label | Icon |
|---|---|---|---|
| (ungrouped) | /dashboard | Dashboard | IconDashboard |
| Career | /opportunities | Opportunities | IconBriefcase |
| Career | /applications | Applications | IconClipboard |
| Career | /development | Development | IconTrendingUp |
| Career | /copilot | Copilot | IconChat |
| Profile | /skills | Skills | IconStar |
| Profile | /resume | Resume | IconDocument |
| Profile | /repositories | Repositories | IconCode |
| Profile | /roles | Target role | IconTarget |
| Profile | /preferences | Preferences | IconSliders |
| (ungrouped) | /settings | Settings | IconGear |

**Phase 3 proposed group renaming:**
- "Career" group → keep or rename "Career Discovery"
- "Profile" group → rename "Career Intelligence" (reflects repositioning)
- Add "AI & Personalization" or merge Copilot

### Component inventory

| File | Purpose | Reuse in Phase 3 |
|---|---|---|
| `AccountMenu.tsx` | User dropdown, sign-out, switch account | Restyled + extended |
| `Icons.tsx` | 44+ SVG icon components | Extend with new icons |
| `ScoreMeter.tsx` | Skill score fill bar | Reuse unchanged |
| `StateViews.tsx` | LoadingState, ErrorState, EmptyState, CardSkeleton | Extend |
| `RepositoryLink.tsx` | GitHub repo link with icon | Reuse unchanged |

### Hooks

| File | Purpose |
|---|---|
| `hooks/useApiResource.ts` | Manages async loading/error/success lifecycle |

**Gap:** No mutation hook (POST/PUT/DELETE with optimistic updates), no caching layer.

### Design system (index.css)

The CSS file is the entire design system. It uses Tailwind v4's `@theme` directive to override the default slate/indigo palettes with Gold Signal dark values, plus a `[data-theme="light"]` block for the Cream/Teal/Coral light palette.

**Dark theme (default):**
- bg: `oklch(5.5% 0.009 265)` — Midnight Black
- text: `oklch(96% 0.012 90)` — Warm White
- primary: `oklch(81% 0.195 86)` — Vibrant Gold
- surface (card): `oklch(8% 0.008 265)` — Lifted dark

**Light theme (`data-theme="light"`):**
- bg: `oklch(93% 0.014 72)` — Cream
- text: `oklch(16% 0.055 192)` — Near-black (teal cast)
- primary: `oklch(30% 0.065 192)` — Deep Teal
- surface (card): `oklch(98% 0.006 72)` — Near-white cream

**Semantic slot mapping (critical for Phase 3):**

| Tailwind Class | Dark value | Light value | Semantic meaning |
|---|---|---|---|
| `bg-slate-50` | Midnight Black | Cream | Page background |
| `bg-white` | Lifted dark surface | Near-white cream | Card/panel background |
| `border-slate-200` | Subtle dark border | Cream border | Default border |
| `text-slate-900` | Warm White | Near-black | Heading text |
| `text-slate-700` | Body text (warm) | Dark body | Body text |
| `text-slate-500` | Muted helper | Muted teal | Secondary text |
| `text-indigo-700` | Vibrant Gold | Deep Teal | Primary accent/links |
| `bg-indigo-700` | Vibrant Gold | Deep Teal | Primary button/action |
| `bg-indigo-100` | Active nav gold tint | Active nav teal tint | Active nav item bg |
| `bg-emerald-*` | Emerald tones | Emerald tones | Success / demonstrated |
| `bg-amber-*` | Amber tones | Amber tones | Warning / partial |
| `bg-red-*` | Red tones | Red tones | Error / missing |
| `bg-violet-*` | Violet tones | Violet tones | AI / Copilot |

---

## 5. Backend Architecture

The backend is a standard Express 5 application with 12+ route modules. It is production-ready with proper middleware ordering, rate limiting, auth guards, and graceful shutdown.

### Route modules

| Module | Base path | Routes |
|---|---|---|
| auth | /api/auth | me, logout, /github, /github/callback |
| github | /api/github | repositories, user |
| analysis | /api/analysis | POST repositories/:id, POST run |
| skills | /api/skills | GET /, GET /:id, GET /:id/evidence |
| roles | /api/roles | GET /, GET /:id, POST /:id/explain |
| gap-analysis | /api/gap-analysis | GET /:roleId |
| opportunities | /api/opportunities | providers, GET /, GET /:id/match |
| saved-jobs | /api/saved-jobs | GET /, PUT /:id, DELETE /:id |
| career | /api/career | profile, preferences, direction, transition, tasks, refresh |
| resume | /api/resume | GET /, POST extract, PUT /, DELETE / |
| copilot | /api/copilot | prompts, POST message |
| health | /health, /ready | Status checks |

### Auth middleware

Sessions are JWT tokens stored in `nexus_session` (httpOnly, Lax cookie). The `require-auth.ts` middleware validates the token on every protected route and sets `req.user`.

---

## 6. Domain Package

`packages/domain` contains:
- Shared TypeScript types (DTO interfaces used by both api and web)
- Scoring engine (deterministic, reads from frozen `config/scoring.json`)
- Evidence types and signal classifications
- Role definitions (reads from frozen `config/roles.json`)

This package is built first in the workspace build sequence. It cannot be modified in Phase 3 (frozen business logic).

---

## 7. E2E Test Infrastructure

- **Framework:** Playwright
- **Ports:** API=4001, Web=5174 (separate from dev ports 4000/5173)
- **Database:** `nexus_e2e` (isolated, never `nexus_dev`)
- **Auth:** JWT session token written to `.session-token` by global-setup
- **Projects:** desktop-chrome (1280x800), tablet (768x1024), mobile (375x812)
- **Current pass rate:** 134/134 (all Phase 2 tests passing)
- **Coverage:** All 11+ authenticated routes + public landing page + auth redirects

---

## 8. Phase 1 & Phase 2 Summary

### Phase 1 Decisions (made)
- Extend Gold Signal (don't replace)
- Three.js for landing hero
- Two themes: Gold Signal dark + Cream/Teal/Coral light
- Both themes built into `index.css` via `@theme` + `[data-theme]`
- Font stack: Barlow Condensed (display) + Inter (body) + JetBrains Mono (code)
- shadcn/ui recommended for authenticated app UI components
- Canvas 2D (not Three.js) recommended for data visualizations

### Phase 2 Completed
- Public landing page at `/` (8 sections)
- Three.js particle-network hero (lazy-loaded)
- Light theme implementation
- Theme persistence + `initTheme()` anti-FOUC
- 134/134 E2E tests passing
- TypeScript: 0 errors
- Production build: succeeds

---

## 9. Key Findings for Phase 3

### Strengths to build on
1. Solid semantic token system — all Phase 3 components just need to use `bg-white`, `text-slate-900`, etc.
2. Working authentication flow — AuthContext fully functional
3. All pages are functional (not stubs) — data loads, errors display, loading states present
4. E2E tests provide regression safety
5. API client is clean and typesafe

### Gaps to address in Phase 3
1. **Shell lacks collapse/expand sidebar** — fixed w-56, no narrow mode
2. **No component library** — every UI pattern is hand-rolled; Phase 3 needs Dialog, Command, Select, Tabs, etc.
3. **No data visualization** — no charts; Skill Intelligence and Gap Analysis pages need them
4. **No command palette** — no Cmd+K navigation
5. **No code splitting** — all authenticated routes load in one bundle (except Three.js)
6. **Layout is too narrow** — `max-w-5xl` on main content limits split-view patterns
7. **No toast/notification system** — no feedback on async operations (save job, refresh, etc.)
8. **Active nav uses hardcoded gold border** — `shadow-[inset_3px_0_0_oklch(81%_0.195_86)]` — doesn't adapt in light theme
9. **Mobile layout** — mobile drawer works but content width is not optimized for split views

### Critical preservation checklist
- [ ] `config/scoring.json` — do not touch
- [ ] `config/roles.json` — do not touch
- [ ] `config/job-matching.json` — do not touch
- [ ] All existing API endpoints and contracts
- [ ] Auth cookie / session mechanism
- [ ] Phase 2 landing page at `/`
- [ ] Three.js hero (lazy-loaded)
- [ ] Theme initialization (`initTheme()` in `main.tsx`)
- [ ] All 134 existing E2E tests (may need assertion updates for redesigned UI, not deletion)
