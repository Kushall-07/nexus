# NEXUS Phase 7 Phase 2 — Handoff

**Date:** 2026-11-07  
**Branch:** `main` (local only — not committed per Phase 2 directive)

---

## What Was Built

A complete public landing page experience for NEXUS, built on the Gold Signal design system established in Phase 1.

---

## Routes After Phase 2

| Path | Renders | Auth required |
|---|---|---|
| `/` | `LandingPage` | No — always public |
| `/skills` | `SkillOverviewPage` | Yes (AuthGate redirects to `/` if unauth) |
| `/skills/:skillId` | `SkillDetailPage` | Yes |
| `/dashboard` | `DashboardPage` | Yes |
| `/repositories` | `RepositoriesPage` | Yes |
| `/roles` | `RolesPage` | Yes |
| `/opportunities` | `OpportunitiesRoute` | Yes |
| `/applications` | `ApplicationsPage` | Yes |
| `/resume` | `ResumePage` | Yes |
| `/development` | `DevelopmentPage` | Yes |
| `/copilot` | `CopilotPage` | Yes |
| `/settings` | `SettingsPage` | Yes |
| `/preferences` | `PreferencesPage` | Yes |

Unauthenticated users reaching any authenticated route are redirected to `/` (LandingPage).

---

## Key Files

| File | Purpose |
|---|---|
| `apps/web/src/pages/landing/LandingPage.tsx` | Full public landing page |
| `apps/web/src/three/HeroScene.tsx` | Three.js particle-network scene |
| `apps/web/src/three/StaticHeroBackground.tsx` | CSS/SVG fallback hero |
| `apps/web/src/lib/theme.ts` | Theme read/write/toggle/init |
| `apps/web/src/index.css` | Light theme tokens + scroll-reveal + landing animations |
| `apps/web/src/App.tsx` | Route split: `/` public, `/*` authenticated shell |
| `apps/web/src/AuthGate.tsx` | Stripped to redirect-only for unauthenticated users |
| `apps/web/src/test-setup.ts` | Added matchMedia + IntersectionObserver stubs |

---

## Theme System

Theme defaults to dark (Gold Signal). Users can toggle to light (Cream/Teal/Coral) via the sun/moon button in the LandingNav.

```typescript
// Read current theme (SSR-safe)
import { getStoredTheme } from "./lib/theme";

// Toggle and return new theme
import { toggleTheme } from "./lib/theme";

// Apply without toggle (e.g. on page load)
import { initTheme } from "./lib/theme";
initTheme(); // reads localStorage, applies to <html>
```

`initTheme()` should be called in `main.tsx` before the React root mounts to prevent flash of wrong theme. It is not called there yet — this is a **Phase 3 task**.

---

## Known Gaps / Phase 3 Work Items

1. **`initTheme()` not wired in `main.tsx`**: Theme is applied by `useState(() => getStoredTheme())` in LandingPage and `applyTheme` on toggle. Dark-to-light flash on page reload in light mode is not fully suppressed. Add `initTheme()` call in `main.tsx` before React mounts.

2. **Landing page CTA flows are illustrative**: The sign-in link goes to `/api/auth/github` (correct). The nav links (`#how-it-works`, `#evidence`, etc.) use anchor fragments. All are correct.

3. **SkillIntelligenceSection and EvidenceSection use static data**: Phase 3 could wire these to real API data. Currently they serve as visual illustrations only.

4. **Three.js performance on lower-end hardware**: The particle count (95) and connection distance can be tuned. Current values are conservative but can be reduced further if needed.

5. **Landing page SEO**: `<meta>` tags, Open Graph, and `<title>` for the landing page are not set. Phase 3 work.

6. **Light theme**: The `[data-theme="light"]` CSS block overrides the Gold Signal defaults. Visual QA at light theme parity with dark is pending.

---

## Verification

```bash
cd apps/web
npm test          # 134/134 passing
npm run build     # Clean build, Three.js code-split at ~537kB (gzip ~133kB)
npx tsc -b --noEmit  # 0 errors
```

Do NOT commit, push, or deploy without user approval.
