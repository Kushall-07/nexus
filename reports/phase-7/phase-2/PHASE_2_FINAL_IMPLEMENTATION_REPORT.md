# NEXUS Phase 7 Phase 2 — Final Implementation Report

**Date:** 2026-11-07
**Branch:** `main` (local only — not committed)

---

## Overview

Phase 2 finalization completed all outstanding items identified in the Phase 2 handoff.
No Phase 3 work was started.

---

## Phase 2 Deliverables (original + finalization)

### Completed in original Phase 2

| Deliverable | Status |
|---|---|
| Public landing page at `/` | ✓ Complete |
| Authenticated routes under `/skills`, `/dashboard`, etc. | ✓ Complete |
| Three.js particle-network hero | ✓ Complete |
| Eight-section landing page | ✓ Complete |
| Dark and light theme system | ✓ Complete |
| Responsive layouts | ✓ Complete |
| Accessibility improvements | ✓ Complete |
| Updated routing (public `/`, authenticated `/*`) | ✓ Complete |
| Test infrastructure stubs (matchMedia, IntersectionObserver) | ✓ Complete |

### Completed in finalization

| Item | File | Description |
|---|---|---|
| Theme init (Phase 2.1) | `main.tsx` | `initTheme()` wired before React renders |
| SEO metadata (Phase 2.4) | `index.html` | Open Graph + theme-color added |
| Light-theme button contrast (Phase 2.5) | `LandingPage.tsx`, `App.tsx` | Hardcoded midnight-black text replaced with semantic token |
| Light-theme gradient overrides (Phase 2.5) | `index.css` | `nx-gradient-text` and `nx-score-fill` override for light |
| Three.js loop optimization (Phase 2.3) | `HeroScene.tsx` | Per-particle matrix inversion moved outside the loop |

---

## 2.1 — Theme Initialization

### Problem
`initTheme()` was not called in `main.tsx`, meaning the HTML element had no `data-theme`
attribute until React mounted and the LandingPage `useState` callback ran. Users who had
previously selected light theme would see a brief flash of dark-then-light on reload.

### Implementation
Added to `main.tsx`, before `ReactDOM.createRoot`:

```typescript
import { initTheme } from "./lib/theme";
initTheme(); // SSR-safe — no-ops when window is undefined
```

`initTheme()` calls `applyTheme(getStoredTheme())`, which:
1. Reads `localStorage["nexus-theme"]`.
2. Applies `data-theme="light"` or removes it.
3. Temporarily adds `theme-no-transition` to suppress CSS transitions on the first paint.

### Behavior verification

| Scenario | Expected | Implementation |
|---|---|---|
| First visit | Dark theme (no stored preference) | `getStoredTheme()` returns `"dark"` as default; no attribute applied |
| Reload in light mode | Light theme immediately | `data-theme="light"` applied before React renders |
| Reload in dark mode | Dark theme | No attribute needed; dark is CSS baseline |
| Invalid/missing preference | Dark fallback | `stored === "light" ? "light" : "dark"` guard |
| SSR / no window | No-op | `typeof window === "undefined"` check in `getStoredTheme()` |

---

## 2.2 — Landing Page Data Audit

### EvidenceSection (scoring signals)

The `SIGNALS` array in `LandingPage.tsx` lists weights:
`0.20, 0.20, 0.25, 0.10, 0.10, 0.05, 0.10` for dependency, framework, sourceUsage,
projectStructure, testing, documentation, activity.

**Verified against `config/scoring.json`**: these values exactly match the production
`signalWeights` object. The section heading says "Scoring signals — illustrative weights"
which is a conservative label that remains correct if weights change in the future.

**Decision: Keep static.** The landing page is public and unauthenticated. The weights
are deterministic constants from configuration, not live API data. No backend endpoint
needs to be called to show them.

### SkillIntelligenceSection (illustrative skill profile)

Displays a hardcoded set of skills with made-up scores. Already labeled
"Illustrative skill profile — not real user data".

**All skill API endpoints (`/api/skills`, `/api/skills/:id`) require authentication.**
A 401 response is returned to unauthenticated callers. Using these endpoints on a public
page would either require bypassing authentication or leaking nothing useful.

**Decision: Keep static.** The illustrative label is accurate and appropriate. No API
integration is warranted for an unauthenticated visitor showcase.

---

## 2.3 — Three.js Performance Audit

### Audit findings

| Check | Result |
|---|---|
| Lazy-loaded via `React.lazy()` | ✓ Confirmed — HeroScene chunk is code-split at build time |
| Skipped on mobile / coarse pointer | ✓ `(pointer: coarse)` and `width < 1024px` checks in HeroSection |
| Skipped on reduced-motion | ✓ `prefers-reduced-motion: reduce` check before `useState` |
| SVG/CSS fallback works | ✓ `StaticHeroBackground` renders correctly |
| WebGL failure does not break page | ✓ Early return if `getContext("webgl2") ?? getContext("webgl")` returns null |
| Animation paused when tab hidden | ✓ `visibilitychange` listener sets `visible` flag |
| Resource cleanup on unmount | ✓ `destroy()` disposes geometries, materials, renderer |
| Event listeners removed on unmount | ✓ ResizeObserver disconnected; visibilitychange removed |
| Pointer tracking cleaned up | ✓ Both `mousemove` and `mouseleave` removed in `useEffect` cleanup |
| Device pixel ratio capped | ✓ `Math.min(window.devicePixelRatio, 2)` |

### Performance fix applied

**Problem:** `pivot.matrixWorld.clone().invert()` was computed inside the particle loop
(once per particle per frame = 95 Matrix4 clones + 95 matrix inversions per frame,
~5,700/second at 60 fps). The pointer's local-space position does not change between
particles in a single frame.

**Fix:** Moved the computation outside the loop:

```typescript
// Before (inside loop, 95× per frame):
const local = ptWorld.clone().applyMatrix4(pivot.matrixWorld.clone().invert());

// After (once per frame):
const localPtr = ptWorld
  ? ptWorld.clone().applyMatrix4(pivot.matrixWorld.clone().invert())
  : null;
// In loop:
if (localPtr) {
  const diff = localPtr.clone().sub(p.pos);
  ...
}
```

This reduces Matrix4 clones from 95 to 1 per frame and matrix inversions from 95 to 1
per frame when the pointer is active. Per-particle `Vector3` clones for `diff` remain
(one per particle per frame within the pointer radius — unavoidable).

### No other optimizations made
Particle count (95), connection distance, and shader code were not changed. No
observable performance problems exist with the current values on target hardware.

---

## 2.4 — SEO Metadata

Added to `index.html`:

```html
<meta property="og:title" content="NEXUS — Career Intelligence" />
<meta property="og:description" content="Turn your GitHub repositories into career intelligence. Evidence-backed job matching, skill graph, and career direction planning." />
<meta property="og:type" content="website" />
<meta name="theme-color" content="#F6C900" />
```

**Not added:**
- `og:url` — no production domain has been established; fabricating a URL was explicitly
  prohibited.
- `og:image` — no social preview image exists.
- Canonical link — same reason as `og:url`.

**Existing SEO (already present):**
- `<title>NEXUS — Career Intelligence</title>`
- `<meta name="description" ...>`
- `<meta name="viewport" ...>`
- `lang="en"` on `<html>`

---

## 2.5 — Light Theme Visual QA

### Contrast defect fixed: CTA button text

In dark theme, primary CTA buttons use Vibrant Gold background (`oklch(81% 0.195 86)`)
with Midnight Black text (`oklch(5.5% 0.009 265)`) — high contrast (L 81% vs L 5.5%).

In light theme, the button background switches to Deep Teal (`oklch(30% 0.065 192)`)
via the `--color-indigo-700` token. The original hardcoded text color remained
Midnight Black (`oklch(5.5% 0.009 265)`) — both L ≈ 5–30%, very low contrast.

**Fix:** Replaced all nine hardcoded `style={{ color: "oklch(5.5% 0.009 265)" }}`
instances in `LandingPage.tsx` and one in `App.tsx` with `style={{ color: "var(--color-indigo-950)" }}`.

The `--color-indigo-950` token is already defined in both themes:
- Dark: `oklch(5.5% 0.009 265)` — Midnight Black (correct on gold button)
- Light: `oklch(98% 0.006 72)` — Near-cream (correct on teal button)

This is the same token already used by the skip-to-main link.

### Gold gradient overrides for light theme

`.nx-gradient-text` uses a hardcoded gold gradient that appears as an artifact on the
cream/teal landing page in light mode.

Added to `index.css`:

```css
[data-theme="light"] .nx-gradient-text {
  background: linear-gradient(135deg, oklch(30% 0.065 192), oklch(70% 0.148 36));
}
```

Teal-to-coral gradient matches the approved light palette and reads as intentional.

`.nx-score-fill` similarly used hardcoded gold.

```css
[data-theme="light"] .nx-score-fill {
  background: linear-gradient(to right, oklch(38% 0.070 191), oklch(30% 0.065 192));
}
```

### Sections verified correct without code changes

| Section | Dark | Light |
|---|---|---|
| Navigation | ✓ | ✓ — slate tokens map correctly to cream palette |
| Hero scrim | ✓ | ✓ — theme-aware radial gradient (already correct) |
| Positioning cards | ✓ | ✓ — indigo/slate tokens map to teal palette |
| How it works | ✓ | ✓ — step numbers use `text-indigo-700` (teal in light) |
| Evidence signals | ✓ | Fixed (gradient + score fill overrides) |
| Skill intelligence | ✓ | ✓ — status colors unchanged (semantic) |
| Trust section | ✓ | ✓ — card backgrounds use `--color-white` token |
| Final CTA | ✓ | Fixed (button text contrast) |
| Footer | ✓ | ✓ — `text-slate-*` tokens resolve correctly |
| Theme toggle | ✓ | ✓ — ring uses `indigo-700` (teal in light) |

---

## 2.6 — Accessibility and Responsiveness Audit

No defects found requiring code changes. Existing implementation:

- **Skip-to-main** `<a href="#hero-content" className="skip-to-main">` present in LandingPage
- **Semantic headings** h1 in hero, h2 in all sections — correct hierarchy
- **Focus indicators** `focus-visible:ring-2 focus-visible:ring-indigo-700` on all interactive elements
- **Aria labels** ThemeToggle, mobile menu button, mobile menu dialog, footer nav
- **Decorative SVGs** `aria-hidden="true"` on GitHubMark, scroll indicator, arrow icons
- **Reduced-motion** `useScrollReveal()` skips animations; CSS `@media (prefers-reduced-motion: reduce)` zeroes all animations and transitions; Three.js skipped
- **Mobile nav** Full mobile drawer with focus trap, Escape closes, outside-click closes
- **Keyboard trap prevention** `MobileDrawer` traps focus only while open (correct); uses `Tab`/`Shift+Tab` cycle
- **No horizontal overflow** `overflow-x-clip` on main content area

---

## Files Changed During Finalization

| File | Change |
|---|---|
| `apps/web/src/main.tsx` | Added `initTheme()` call before React renders |
| `apps/web/index.html` | Added Open Graph tags and `theme-color` |
| `apps/web/src/index.css` | Added `[data-theme="light"]` overrides for `nx-gradient-text` and `nx-score-fill` |
| `apps/web/src/pages/landing/LandingPage.tsx` | Changed 9× `oklch(5.5% ...)` to `var(--color-indigo-950)` |
| `apps/web/src/App.tsx` | Changed 1× `oklch(5.5% ...)` to `var(--color-indigo-950)` in NotFound |
| `apps/web/src/three/HeroScene.tsx` | Moved per-frame matrix inversion outside particle loop |

---

## Files Not Changed

| File | Reason |
|---|---|
| `config/scoring.json` | Business logic — no modifications required |
| `config/roles.json` | Business logic — not relevant to Phase 2 |
| `config/job-matching.json` | Business logic — not relevant to Phase 2 |
| `apps/web/src/lib/theme.ts` | Complete and correct as delivered |
| `apps/web/src/three/StaticHeroBackground.tsx` | No issues found |
| All backend files | No backend modifications required |

---

## Intentionally Deferred Items

| Item | Reason |
|---|---|
| Canonical URL in `index.html` | No production domain established — fabricating a URL was explicitly prohibited |
| `og:image` social preview | No image asset exists |
| Light-theme `nx-node-pulse` | CSS `box-shadow` animation on SVG `<circle>` elements does not render in most browsers; the animation is a no-op in the StaticHeroBackground. No visible defect to fix. |
| Dynamic EvidenceSection weights | Static values match `scoring.json` exactly; API not needed for public page |
| Dynamic SkillIntelligenceSection | Requires authentication; appropriate as illustrative |
