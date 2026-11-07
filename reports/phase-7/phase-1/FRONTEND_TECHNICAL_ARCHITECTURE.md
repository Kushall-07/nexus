# NEXUS — Frontend Technical Architecture
## Phase 7, Phase 1

**Date:** 2026-11-07

---

## 1. Existing Frontend Architecture

### 1.1 Technology Stack

| Technology | Version | Role |
|---|---|---|
| React | 19.3.0 | UI framework |
| React Router | 7.18.4 | Client-side SPA routing |
| TypeScript | 7.0.2 | Type safety |
| Vite | 8.3.2 | Build tool and dev server |
| Tailwind CSS | 4.3.3 | Utility-first styling |

**Notable absences (by design):**
- No UI component library (shadcn, MUI, Chakra)
- No state management library (Redux, Zustand, Jotai, Recoil)
- No data fetching library (TanStack Query, SWR, Apollo)
- No animation library (Framer Motion, GSAP, React Spring)

### 1.2 Routing

Routing is defined in `apps/web/src/App.tsx` using React Router 7:

```tsx
// All routes wrapped in AuthGate (shows landing page when unauthenticated)
<Routes>
  <Route path="/" element={<SkillOverviewPage />} />
  <Route path="/skills/:skillId" element={<SkillDetailPage />} />
  <Route path="/repositories" element={<RepositoriesPage />} />
  <Route path="/roles" element={<RolesPage />} />
  <Route path="/dashboard" element={<DashboardPage />} />
  <Route path="/opportunities" element={<OpportunitiesRoute />} />
  <Route path="/copilot" element={<CopilotPage />} />
  <Route path="/applications" element={<ApplicationsPage />} />
  <Route path="/resume" element={<ResumePage />} />
  <Route path="/development" element={<DevelopmentPage />} />
  <Route path="/settings" element={<SettingsPage />} />
  <Route path="/preferences" element={<PreferencesPage />} />
  <Route path="*" element={<NotFound />} />
</Routes>
```

**Observations:**
- All routes are flat (no nested route groups)
- No route-level code splitting (all page bundles loaded together)
- AuthGate renders the landing page when unauthenticated — it wraps all routes

### 1.3 State Management

The application uses three layers of state:

1. **Authentication state** — React Context (`AuthContext.tsx`)
   - States: loading / authenticated / unauthenticated / error
   - Shared globally via `AuthProvider`

2. **Server state** — Custom hook (`useApiResource.ts`)
   - Each component manages its own fetch state
   - States: loading / success / error
   - No shared caching (each page refetches on mount)
   - `reload()` callback for manual refresh

3. **Local UI state** — Component `useState`
   - Form inputs, toggles, filter values
   - Not persisted across navigation

**Limitation:** No global cache means every route change triggers a fresh API call. For Phase 3, this should be addressed with either TanStack Query or a simple cache layer.

### 1.4 API Client

Custom fetch-based client in `apps/web/src/api/client.ts`:
- Base URL from `VITE_API_BASE_URL` environment variable
- Credentials: cookies included via `credentials: "include"`
- Response envelope: `{ success: boolean; data?: T; error?: { code?: string; message?: string } }`
- Global 401 listener for session expiry

### 1.5 Styling Architecture

Tailwind CSS v4 with:
- Custom `@theme` block defining all brand colors (OKLCH)
- Semantic slot remapping (`indigo-700` = Gold, `slate-50` = Midnight Black)
- Custom utilities in `index.css` for brand-specific patterns
- No `tailwind.config.js` — config is fully in `@theme`

### 1.6 Component Architecture

```
src/
├── App.tsx              — App shell (router, layout, navigation)
├── AuthGate.tsx         — Auth check + landing page
├── main.tsx             — React DOM entry point
├── index.css            — Global styles + design tokens
├── auth/                — Authentication (Context)
├── api/                 — API client + TypeScript types
├── components/          — Shared reusable components
├── features/            — Feature-organized page components
│   ├── career/          — Jobs, applications, copilot, dashboard
│   ├── repositories/    — GitHub evidence
│   ├── roles/           — Role gap analysis
│   ├── settings/        — Settings page
│   └── skills/          — Skill overview + detail
├── hooks/               — Custom React hooks (useApiResource)
└── lib/                 — Utility functions (format, navigation)
```

---

## 2. Recommended Component Architecture for Phase 7

### 2.1 Layered Architecture

```
src/
├── components/
│   ├── ui/              — Base primitives (shadcn, Phase 3)
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── dialog.tsx
│   │   ├── command.tsx  — Command palette
│   │   └── ...
│   ├── brand/           — NEXUS-specific brand components
│   │   ├── NexusBrand.tsx  — Logo + tagline lockup
│   │   ├── ScoreMeter.tsx  — Evidence score bar (existing, keep)
│   │   ├── MatchBadge.tsx  — Match quality labels
│   │   └── EvidenceBar.tsx — Evidence strength visualization
│   └── layout/          — Structural layout components
│       ├── Sidebar.tsx
│       ├── MobileHeader.tsx
│       ├── MobileDrawer.tsx
│       └── CommandPalette.tsx
├── features/            — Feature pages (keep existing structure)
├── pages/               — Public landing page sections (Phase 2)
│   ├── landing/
│   │   ├── LandingPage.tsx
│   │   ├── HeroSection.tsx
│   │   ├── HowItWorksSection.tsx
│   │   └── ...
│   └── auth/
│       └── AuthCallbackPage.tsx
├── hooks/               — Custom hooks
│   ├── useApiResource.ts   — Existing (keep)
│   ├── useCommandPalette.ts — New
│   └── useLocalStorage.ts  — New (for sidebar collapse state)
├── lib/                 — Utilities
│   ├── format.ts          — Existing
│   ├── navigation.ts      — Existing
│   └── cn.ts              — New (shadcn class merger)
└── three/               — Three.js scene components (Phase 2)
    ├── HeroScene.tsx       — Landing page particle network
    └── SceneCanvas.tsx     — WebGL canvas wrapper
```

### 2.2 Route-Level Code Splitting (Phase 3)

Currently all page components are bundled together. For Phase 3+:

```tsx
// Recommended: lazy-load route-level components
const OpportunitiesRoute = React.lazy(() => import('./features/career/OpportunitiesRoute'));
const CopilotPage = React.lazy(() => import('./features/career/CopilotPage'));
const RepositoriesPage = React.lazy(() => import('./features/repositories/RepositoriesPage'));

// Three.js scene: always lazy-loaded
const HeroScene = React.lazy(() => import('./three/HeroScene'));
```

This follows the `vercel-react-best-practices` skill's `bundle-dynamic-imports` rule (CRITICAL).

---

## 3. Routing Recommendations

### 3.1 Preserve Existing Route Structure

Do not change existing route paths. External links, bookmarks, and tests depend on current URLs.

### 3.2 Add Public Route Separation

Currently all routes are under `AuthGate`. Phase 2 adds a public landing page that should be clearly separated:

```tsx
function AppShell() {
  return (
    <Routes>
      {/* Public routes — no auth required */}
      <Route path="/" element={<PublicLayout><LandingPage /></PublicLayout>} />
      
      {/* Authenticated routes — existing structure */}
      <Route path="/*" element={<AuthenticatedLayout />} />
    </Routes>
  );
}
```

**Current behavior:** The root `/` renders `SkillOverviewPage` for authenticated users. The landing page is served by `AuthGate` when unauthenticated.

**Phase 2 change:** Extract the landing page to its own route and move Skill Overview to `/skills`. **This requires user approval** as it changes an existing route.

### 3.3 Route Change Proposal (Requires Approval)

| Current | Proposed | Reason |
|---|---|---|
| `/` | `/skills` | Free up `/` for public landing page |
| New | `/` | Public landing page |
| `/skills/:skillId` | `/skills/:skillId` | No change |

**Alternative:** Keep existing routes, serve landing page only at `/` when unauthenticated (current approach). This avoids route restructuring but means the public landing page URL disappears after login.

**Recommendation:** Keep current approach (AuthGate renders landing when unauthenticated) for Phase 2 to minimize change scope.

---

## 4. Data Fetching Recommendations

### 4.1 Current Issues

1. **No caching** — every navigation triggers fresh API calls
2. **No background refresh** — stale data not updated until manual reload
3. **No request deduplication** — multiple components can trigger identical requests
4. **No optimistic updates** — saves require server round-trip before UI updates

### 4.2 Phase 3 Recommendation: TanStack Query

Adopt **TanStack Query v5** (react-query) for server state management:

```tsx
// Replace useApiResource with TanStack Query
const { data, isLoading, error, refetch } = useQuery({
  queryKey: ['skills'],
  queryFn: () => apiGet<SkillOverview>('/api/skills'),
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

**Benefits:**
- Automatic caching (skills data doesn't change until analysis is re-run)
- Background refetch on window focus
- Request deduplication
- Optimistic updates for save/status changes

**Migration path:** `useApiResource` can be replaced page-by-page without a big-bang migration.

### 4.3 Mutation Pattern with Optimistic Updates

For saved jobs and task status updates:

```tsx
const mutation = useMutation({
  mutationFn: (status) => apiPut(`/api/saved-jobs/${jobId}`, { status }),
  onMutate: async (newStatus) => {
    // Cancel in-flight queries
    await queryClient.cancelQueries({ queryKey: ['saved-jobs'] });
    // Optimistically update
    const previous = queryClient.getQueryData(['saved-jobs']);
    queryClient.setQueryData(['saved-jobs'], (old) => updateStatus(old, jobId, newStatus));
    return { previous };
  },
  onError: (err, newStatus, context) => {
    // Roll back on error
    queryClient.setQueryData(['saved-jobs'], context?.previous);
  },
});
```

---

## 5. shadcn Adoption Recommendation

### 5.1 Summary

shadcn/ui is **recommended for Phase 3** as the primary component system for the authenticated application.

### 5.2 Integration Strategy

**Step 1: Initialize shadcn in existing Vite project**
```bash
npx shadcn@latest init --preset base-nova --template vite
```
(Do NOT run during Phase 1. Document only.)

**Step 2: Map Gold Signal tokens to shadcn CSS variables**

The critical mapping challenge: NEXUS's semantic slot remapping (`indigo-700` = Gold) conflicts with shadcn's color system. Resolution:

```css
/* Add shadcn variables alongside existing Gold Signal system */
:root {
  /* shadcn semantic tokens — mapped to Gold Signal */
  --background: oklch(5.5% 0.009 265);     /* Midnight Black */
  --foreground: oklch(96% 0.012 90);       /* Warm White */
  --card: oklch(8% 0.008 265);             /* Dark surface */
  --card-foreground: oklch(96% 0.012 90);
  --primary: oklch(81% 0.195 86);          /* Vibrant Gold */
  --primary-foreground: oklch(5.5% 0.009 265);
  --secondary: oklch(13% 0.007 265);       /* Subtle surface */
  --secondary-foreground: oklch(96% 0.012 90);
  --muted: oklch(13% 0.007 265);
  --muted-foreground: oklch(60% 0.008 90);
  --accent: oklch(9% 0.030 86);            /* Gold tint */
  --accent-foreground: oklch(81% 0.195 86);
  --destructive: oklch(59% 0.210 26);      /* Red */
  --destructive-foreground: oklch(96% 0.012 90);
  --border: oklch(13% 0.007 265);
  --input: oklch(13% 0.007 265);
  --ring: oklch(81% 0.195 86);             /* Gold focus ring */
  --radius: 0.5rem;
}
```

**Step 3: Add components incrementally**
- Phase 3A: Command palette, Sidebar, Dialog, Toast (structural)
- Phase 3B: Table (Application Tracker), Tabs, Drawer (Job Discovery)
- Phase 3C: Chart components (Skill scores, Application funnel)
- Phase 3D: Chat primitives (Career Copilot)

**Step 4: Keep custom NEXUS components**
- `ScoreMeter` — custom gold bar, keep as-is
- `MatchBadge` — NEXUS-specific, keep as-is
- `NexusBrand` — logo lockup, keep as-is
- `IconNexus` — brand mark, keep as-is

### 5.3 Risk: Tailwind CSS v4 Compatibility

shadcn v4 supports Tailwind CSS v4 via `@theme inline` blocks. However:
- NEXUS's existing semantic slot remapping may conflict with shadcn's default mappings
- Must test for color conflicts after initialization
- Use `shadcn` skill's integration workflow during Phase 3

---

## 6. Effects Integration Architecture

### 6.1 Three.js (Landing Page Hero)

**Integration approach:** React component with direct Three.js rendering into a canvas element.

```tsx
// apps/web/src/three/HeroScene.tsx
// Lazy-loaded only on the landing page
export function HeroScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const scene = new THREE.Scene();
    // ... Three.js setup
    
    // Cleanup on unmount — critical
    return () => {
      scene.dispose();
      renderer.dispose();
    };
  }, []);
  
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}
```

**NOT an iframe.** Direct React component with lifecycle management.

**Lazy loading:**
```tsx
const HeroScene = React.lazy(() => import('../three/HeroScene'));

// In HeroSection.tsx:
<Suspense fallback={<StaticHeroBackground />}>
  <HeroScene />
</Suspense>
```

**Mobile detection:** Use `window.matchMedia('(pointer: coarse)')` or `window.innerWidth < 1024` to skip Three.js on mobile.

**Reduced motion:** `window.matchMedia('(prefers-reduced-motion: reduce)')` → show static CSS animation only.

**WebGL unavailable:** `canvas.getContext('webgl2')` returns null → show CSS atmospheric gradients (already in `body` style).

### 6.2 WebGL Liquid-Metal Button (Landing Page CTAs Only)

**Integration approach:** Per-button WebGL canvas overlay.

```tsx
// apps/web/src/components/brand/HeroCTA.tsx
export function HeroCTA({ children, onClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  
  // ... WebGL setup on mount
  // ... pointer tracking in useEffect
  // ... cleanup on unmount (deleteProgram, losing context handler)
  
  return (
    <button
      onClick={onClick}
      className="relative overflow-hidden rounded-lg px-6 py-3 ..."
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      <span className="relative z-10 font-semibold">{children}</span>
    </button>
  );
}
```

**Scope:** Maximum 2 instances on landing page. Never in authenticated application.

**Browser limit:** Each `canvas.getContext('webgl2')` consumes one of ~16 WebGL contexts. Strictly limit use.

### 6.3 Canvas 2D Gallery Heading (Optional, Phase 2)

**Integration approach:** React component with Canvas 2D API (no WebGL needed).

```tsx
// apps/web/src/components/brand/GalleryHeading.tsx
export function GalleryHeading({ heading, tiles }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // ... Canvas 2D setup + pointer tracking
  
  return (
    <div className="relative">
      <h2 className="font-display text-6xl ...">{heading}</h2>
      <canvas ref={canvasRef} ... />
    </div>
  );
}
```

**Use:** Maximum 2 landing page sections. Canvas 2D (not WebGL) — lighter weight.

### 6.4 Skill Network Graph (Phase 3, Authenticated)

**Integration approach:** Canvas 2D or SVG (not Three.js — lighter for dense data).

**NOT Three.js.** The skill network in the authenticated application should use D3.js force simulation or a custom Canvas 2D implementation. Three.js is too heavy for a productivity application.

```tsx
// apps/web/src/components/brand/SkillNetwork.tsx
// Canvas 2D with requestAnimationFrame
// D3 force simulation for node layout
// Interactive: hover node = show skill name, click = navigate to skill detail
```

---

## 7. Asset Handling

### 7.1 Fonts

Currently loaded via Google Fonts CDN in `index.html`. This creates a dependency on Google's infrastructure and can delay text rendering.

**Recommendation for Phase 3+:** Self-host fonts using `@font-face` in CSS.

```bash
# Install using fontsource (NPM)
npm install @fontsource/barlow-condensed @fontsource/inter @fontsource/jetbrains-mono
```

```css
/* In index.css */
@import "@fontsource/barlow-condensed/700.css";
@import "@fontsource/barlow-condensed/800.css";
@import "@fontsource/barlow-condensed/900.css";
@import "@fontsource/inter/variable.css";
@import "@fontsource/jetbrains-mono/400.css";
@import "@fontsource/jetbrains-mono/500.css";
```

**Benefits:** No external CDN dependency, fonts preloaded, no CORS issues.

**Phase:** Implement in Phase 3 (not Phase 2 — minimize risk).

### 7.2 Three.js Assets

If the Three.js hero uses HDRI environment maps or external textures:
- Must be bundled in `public/` folder (not imported as modules)
- Load using `THREE.TextureLoader` with Vite's public asset path
- Keep below 500KB per asset uncompressed

### 7.3 Favicon and Brand Assets

Current `index.html` has no favicon. Phase 2 should add:
- `favicon.ico` (legacy fallback)
- `favicon.svg` (modern browsers)
- `apple-touch-icon.png` (180×180, for iOS)
- `og-image.png` (1200×630, for social sharing)
- `manifest.webmanifest` (PWA readiness, optional)

---

## 8. Performance Architecture

### 8.1 Bundle Strategy

**Current bundle:** All page components compiled together in one chunk.

**Phase 3 target:**
```
Initial bundle (critical path):
- React + React Router runtime: ~50KB gzip
- Tailwind CSS: ~20KB gzip
- App shell (sidebar, navigation, auth): ~30KB gzip
Total critical: ~100KB gzip

Lazy chunks (loaded on navigation):
- OpportunitiesPage + filters: ~40KB gzip
- SkillOverviewPage + charts: ~30KB gzip
- CopilotPage: ~20KB gzip
- Three.js + HeroScene: ~150KB gzip (landing page only)
```

### 8.2 Core Web Vitals Targets

| Metric | Target | Risk |
|---|---|---|
| LCP (Largest Contentful Paint) | <2.5s | Three.js hero must not block LCP text |
| FID (First Input Delay) | <100ms | No heavy synchronous JS on main thread |
| CLS (Cumulative Layout Shift) | <0.1 | Font loading must not cause layout shift |
| INP (Interaction to Next Paint) | <200ms | Long skill/job lists need virtualization |

### 8.3 Rendering Optimization

**Skill lists (30+ items):** Add windowing/virtualization in Phase 3 if performance testing reveals jank.  
**Job results (20–50 items):** Card list should render within 16ms budget.  
**Three.js scene:** Target 60fps on modern hardware, 30fps on older hardware.

### 8.4 Three.js Performance

| Technique | Requirement |
|---|---|
| Dynamic import | `React.lazy(() => import('./HeroScene'))` |
| Dispose on unmount | `scene.dispose()`, `geometry.dispose()`, `material.dispose()` |
| Pause when hidden | `document.visibilitychange` listener |
| Throttled resize | `debounce(handleResize, 100)` |
| Device pixel ratio | `Math.min(window.devicePixelRatio, 2)` |
| Mobile skip | Don't load on `pointer: coarse` or `width < 1024` |

---

## 9. Testing Strategy

### 9.1 Existing Tests

| Type | Tool | Location | Status |
|---|---|---|---|
| Unit | Vitest + RTL | `apps/web/src/**/*.test.tsx` | Maintained |
| Integration (API) | Vitest + Supertest | `apps/api/tests/` | Maintained |
| E2E | Playwright | `apps/web/e2e/` | Maintained (isolated DB) |

### 9.2 Testing Requirements for Phase 7 Redesign

**Preserve all existing tests.** The redesign must not break existing test coverage.

**Add new tests for:**
1. Command palette — keyboard navigation, action routing, search results
2. New shadcn components — Form validation, Dialog open/close, Tabs
3. Three.js scene — WebGL unavailable fallback, cleanup on unmount
4. Responsive behavior — Mobile layout tests with Playwright viewports
5. Accessibility — `axe-playwright` integration for automated a11y checks

### 9.3 Visual Regression Testing

**Recommendation for Phase 4:** Add Playwright visual comparison tests for key pages.

```typescript
// apps/web/e2e/visual.spec.ts
test('dashboard - authenticated', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveScreenshot('dashboard.png');
});
```

---

## 10. Environment Configuration

### Required Environment Variables (`.env.example`)

**Frontend:**
```
VITE_API_BASE_URL=http://localhost:4000  # Empty = same-origin
```

**Backend:**
```
MONGODB_URI=...
JWT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
TOKEN_ENCRYPTION_KEY=...
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:4000

# LLM (optional)
LLM_PROVIDER=groq|gemini|openai-compatible
LLM_API_KEY=...
LLM_MODEL=...
LLM_BASE_URL=...

# Job providers (all optional)
JSEARCH_API_KEY=...
ADZUNA_APP_ID=...
ADZUNA_APP_KEY=...
REMOTIVE_ENABLED=true
ARBEITNOW_ENABLED=true
HIMALAYAS_ENABLED=true
```

---

## 11. Summary of Recommended Changes for Phase 3

| Change | Type | Priority | Prerequisite |
|---|---|---|---|
| Adopt shadcn/ui component system | New dependency | P1 | Gold Signal token mapping plan |
| Add TanStack Query for server state | New dependency | P2 | None |
| Route-level code splitting (React.lazy) | Optimization | P2 | None |
| Collapsible sidebar | Feature | P1 | shadcn Sidebar component |
| Command palette (Cmd+K) | Feature | P1 | shadcn Command + Dialog |
| Lucide React icon library | New dependency | P1 | Replaces custom Icons.tsx |
| Three.js (landing page only) | New dependency | P2 | Phase 2 complete |
| Self-hosted fonts | Optimization | P3 | Phase 3 near-complete |

**What NOT to change:**
- Tailwind CSS v4 configuration foundation
- Existing semantic token system (extend, not replace)
- Authentication flow and API client
- Frozen config files
- Existing route paths
