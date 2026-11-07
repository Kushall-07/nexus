# NEXUS Phase 7 Phase 2 — Implementation Report

**Date:** 2026-11-07  
**Status:** Complete — TypeScript clean, 134/134 tests passing, Vite build successful

---

## Scope

Phase 2 implemented the full public-facing redesign of the NEXUS web application:

1. Permanent public landing page at `/`
2. Route migration: `SkillOverview` moved from `/` → `/skills`
3. Three.js particle-network hero with dual-theme support
4. Full multi-section landing page (8 sections)
5. Dual theme system: Gold Signal dark (default) + Cream/Teal/Coral light
6. Test suite updated for new routing

---

## Files Created

### `apps/web/src/lib/theme.ts`
Theme utility module. Exports `getStoredTheme`, `applyTheme`, `setTheme`, `toggleTheme`, `initTheme`.
- SSR-safe: `typeof window === "undefined"` guard in `getStoredTheme`
- Transition suppression via `theme-no-transition` CSS class + double rAF

### `apps/web/src/three/HeroScene.tsx`
Three.js particle-network scene component.
- 95 particles split across REPO (40%), SKILL (40%), opportunity (20%) types
- Custom `ShaderMaterial` with per-vertex `aSize` attribute (PointsMaterial doesn't support per-vertex sizes)
- `THREE.LineSegments` with `aAlpha` per-vertex attribute for dynamic connections
- Pivot group rotation: `pivot.rotation.y += ROTATION_SPEED * dt`
- Pointer attraction via camera ray → z=0 plane intersection
- Visibility-aware animation pausing (IntersectionObserver on canvas container)
- Full cleanup on unmount and theme change via `destroyRef` pattern

### `apps/web/src/three/StaticHeroBackground.tsx`
SVG-based fallback for mobile, reduced-motion, and no-WebGL contexts.
- 15 pre-defined nodes at percentage positions on 0–100 viewBox
- 17 connection edges
- Reuses existing `nx-node-pulse` CSS animation class

### `apps/web/src/pages/landing/LandingPage.tsx`
Full public landing page (1062 lines).
- `LandingNav`: sticky glass header, auth-aware CTAs, mobile menu
- `HeroSection`: Three.js (lazy) or static fallback; `useThreeJs` guards: SSR, matchMedia, mobile, reduced-motion
- `PositioningSection`: evidence vs keywords before/after
- `HowItWorksSection`: 4 numbered steps
- `EvidenceSection`: signal weights with score bars
- `SkillIntelligenceSection`: 8 illustrative skill cards
- `TrustSection`: 4 trust items
- `FinalCTASection`: primary GitHub sign-in CTA with "Sign in with GitHub" link
- `AuthNotice`: shows cancelled sign-in notice from `useAuth().notice`
- `useScrollReveal`: IntersectionObserver scroll reveal hook
- `ThemeToggle`: sun/moon icon button

---

## Files Modified

### `apps/web/src/index.css`
- Added `[data-theme="light"]` overrides for all OKLCH color slots (Cream/Teal/Coral palette)
- Added `.theme-no-transition` utility
- Added `.landing-section-reveal` / `.is-visible` scroll-reveal keyframes
- Added `.nx-coral` and `.nx-bg-coral` utilities
- Added `.landing-reveal` keyframe animation for hero entrance

### `apps/web/src/App.tsx`
- Added `LandingPage` import
- Changed `AppShell` to split routes:
  - `<Route path="/" element={<LandingPage />} />` — always public
  - `<Route path="/*" element={<AuthenticatedShell />} />` — shell with AuthGate
- Inside authenticated shell: `/skills` = `SkillOverviewPage`, legacy `/` redirects to `/skills`
- Changed `NAV_GROUPS` Skills `to` from `/` to `/skills`

### `apps/web/src/AuthGate.tsx`
- Stripped `SignInPrompt`, `GitHubMark`, `ProductViz`, `LandingNav` (old inline sign-in page)
- Unauthenticated now redirects to `/` via `<Navigate to="/" replace />`

### `apps/web/src/features/skills/SkillDetailView.tsx`
- Back link changed from `to="/"` to `to="/skills"`

### `apps/web/src/features/repositories/RepositoriesView.tsx`
- "View Skill Graph" link changed from `to="/"` to `to="/skills"`

---

## Test Suite Updates

### `apps/web/src/test-setup.ts`
Added jsdom browser API stubs (guarded with `typeof window !== "undefined"`):
- `window.matchMedia`: jsdom does not implement it; LandingPage hero calls it in `useState` initializer
- `window.IntersectionObserver`: jsdom does not implement it; `useScrollReveal` calls it in `useEffect`

### `apps/web/src/App.test.tsx`
- Changed `expect(html).toContain("GitHub Evidence Engine")` → `"IS EVIDENCE"` (landing page h1 content, not authenticated shell sidebar)

### `apps/web/src/App.interaction.test.tsx`
- Changed `mount()` → `mount("/skills")` for 4 skill-overview tests (default `/` now renders LandingPage)
- Left the unauthenticated test at `mount()` — LandingPage at `/` has "Sign in with GitHub" in `FinalCTASection`

### `apps/web/src/auth/account-menu.test.tsx`
- Changed default mount path from `"/"` → `"/skills"` (SkillOverview only uses `/api/skills` which is in the stub; `/dashboard` made unexpected API calls causing extra `role="alert"` elements)
- Changed expired-session test to use `mount("/skills")` explicitly (needs SkillOverview to fetch `/api/skills` and get the 401 that triggers session expiry)

### `apps/web/src/features/skills/skills.test.tsx`
- Changed `expect(html).toContain('href="/"')` → `'href="/skills"'` (back link updated)

---

## Build Output

```
dist/index.html                      1.52 kB │ gzip:   0.80 kB
dist/assets/index-*.css             44.21 kB │ gzip:   8.87 kB
dist/assets/index-*.js             430.83 kB │ gzip: 120.15 kB
dist/assets/HeroScene-*.js         536.79 kB │ gzip: 133.14 kB
```

Three.js is fully code-split from the main bundle. The HeroScene chunk is only fetched when `useThreeJs = true` (desktop, non-reduced-motion, WebGL available). Mobile and SSR users receive only the static SVG fallback.

---

## Test Results

```
Test Files  10 passed (10)
      Tests  134 passed (134)
   Duration  27.89s
```

No failures. The `HTMLCanvasElement.getContext` jsdom warnings are non-breaking — Three.js attempts a WebGL context which jsdom doesn't support, but the `useThreeJs = false` guard prevents rendering the lazy component in test environments.
