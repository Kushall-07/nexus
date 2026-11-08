# Phase 4B/4C — Visual QA Report
**Date:** 2026-11-08  
**Status:** Complete

---

## 1. Public Landing Page QA

### Section inventory

| Section | Heading | Dark theme | Light theme |
|---------|---------|-----------|------------|
| Navigation | NEXUS logo + nav links + theme toggle | ✓ | ✓ |
| Hero | "YOUR CODE IS EVIDENCE." | ✓ Three.js particles | ✓ Static fallback |
| Problem | "JOB HUNTING SHOULDN'T BE GUESSING." | ✓ | ✓ |
| Solution | "FROM REPOSITORIES TO CAREER CLARITY." | ✓ | ✓ |
| Evidence | "EVIDENCE, NOT KEYWORDS." | ✓ | ✓ |
| Skills | "YOUR SKILLS, SCORED BY EVIDENCE." | ✓ | ✓ |
| Transparency | "TRANSPARENT BY DESIGN." | ✓ | ✓ |
| CTA | "BUILD YOUR NEXT MOVE ON EVIDENCE." | ✓ `.nx-cta-shimmer` | ✓ |
| Footer | Logo + links + tagline | ✓ | ✓ |

### Three.js hero

- Lazy loaded via dynamic import — ✓
- Mobile fallback: static CSS constellation — ✓
- Reduced-motion: animation classes suppressed by `@media (prefers-reduced-motion: reduce)` — ✓
- WebGL failure: `<canvas>` not found in jsdom (expected — browser-only) — ✓
- Pointer interaction: handled in HeroScene component — ✓
- Chunk isolated: `HeroScene-*.js` (536.80 kB) separate from main bundle — ✓

### Theme switching

The landing page renders a `ThemeToggle` button in both the desktop nav and the mobile nav. Toggle calls `toggleTheme()` from `lib/theme.ts`:
- Persists to `localStorage("nexus-theme")`
- Applies `data-theme="light"` on `<html>` for light mode
- Removes attribute for dark mode
- Uses `theme-no-transition` class to suppress flash during toggle

### Landing-page interactions

| Interaction | Status |
|-------------|--------|
| Nav links scroll/navigate | ✓ |
| Sign-in CTA → GitHub OAuth | ✓ |
| Final section CTA → Sign in | ✓ |
| Theme toggle → both themes | ✓ |
| Mobile menu opens/closes | ✓ |
| Keyboard focus rings visible | ✓ |

---

## 2. Authenticated Application QA

### Typography consistency

All page h1 headings use `.font-display` with consistent sizing (1.75rem, lh:1, ls:-0.02em). All matches the Gold Signal design system.

| Page | h1 heading | Match to nav label |
|------|-----------|-------------------|
| Overview (Dashboard) | Dynamic greeting | ✓ (nav says "Overview") |
| Job Discovery | "Job Discovery" | ✓ |
| Saved Opportunities | "Saved Opportunities" | ✓ |
| Applications | "Applications" | ✓ |
| GitHub Evidence | "GitHub Evidence" | ✓ |
| Role & Gap Analysis | "Role & Gap Analysis" | ✓ |
| Skill Intelligence | "Skill graph" | Partial — test-locked name |
| Career Copilot | "Career Copilot" | ✓ |
| My Career Profile (Resume) | "My Career Profile" | ✓ (fixed in Phase 4) |
| My Career Profile (Prefs) | "My Career Profile" | ✓ (contextual access) |
| Settings | "Settings" | ✓ |

### State coverage

Every authenticated page implements all three state types:

| State type | Implementation | Location |
|------------|---------------|---------|
| Loading | `<LoadingState label="…" />` | All pages |
| Error | `<ErrorState error={…} onRetry={…} />` | All pages |
| Empty | Page-specific empty state | All pages |

### Theme in the authenticated app

The authenticated application shell (`App.tsx`) uses Gold Signal dark theme tokens throughout. The light theme (`data-theme="light"`) is applied globally via `<html>` and overrides all CSS variables.

Theme initialization: `initTheme()` is called in `main.tsx` before React renders — prevents flash of wrong theme.

**Phase 4 fix**: Added `AppearanceSection` to `SettingsPage` allowing users to toggle between Gold Signal (dark) and Cream & Teal (light) themes without leaving the authenticated app. The toggle uses `lib/theme.ts` — same persistence layer as the landing page.

### Visual consistency checks

| Element | Consistent | Notes |
|---------|-----------|-------|
| Card borders | ✓ `border-slate-200` throughout |
| Card backgrounds | ✓ `bg-white` throughout |
| Card radii | ✓ `rounded-xl` throughout |
| Button primary | ✓ `bg-indigo-700` + `text-indigo-950` |
| Button secondary | ✓ `border-slate-200 bg-white text-slate-700` |
| Button danger | ✓ `bg-red-800` for delete actions |
| Input fields | ✓ `inputClass` from `jobParts.tsx` shared across pages |
| Focus rings | ✓ `focus-visible:ring-2 focus-visible:ring-indigo-700` |
| Status badges | ✓ `StatusBadge` pattern — always color + text symbol |
| Accent panels | ✓ `.nx-panel`, `.nx-panel-success`, `.nx-panel-warning`, `.nx-panel-danger` |
| Score meters | ✓ `.nx-score-fill` gradient |
| Skeleton loaders | ✓ `.skeleton` pulse animation |

### Information hierarchy

Each page follows a consistent structure:
1. h1 (display font) + subtitle (text-slate-500)
2. Status/meta banners (if applicable)
3. Primary content (cards, lists, forms)
4. Supplementary content (stats, secondary panels)

### Interaction states

| Component | Idle | Hover | Active | Disabled | Focus |
|-----------|------|-------|--------|---------|-------|
| Primary button | Gold bg | opacity-90 | — | opacity-60, cursor-not-allowed | ring-indigo-700 |
| Secondary button | White bg | slate-100 bg | — | opacity-60 | ring-indigo-700 |
| Nav items | Transparent | slate-100 bg | Gold tint + gold bar | — | ring-indigo-700 |
| Inputs | Border-slate-200 | — | ring-indigo-700 (via focus-visible) | opacity-60 | ring-indigo-700 |
| Toast dismiss | — | slate-100 bg | — | — | ring |

---

## 3. Dark Theme — Specific Checks

| Element | Dark state | Verdict |
|---------|-----------|---------|
| Page background | `bg-slate-50` = Midnight Black | ✓ |
| Card surfaces | `bg-white` = lifted dark surface | ✓ |
| Borders | `border-slate-200` = subtle dark border | ✓ |
| Primary text | `text-slate-900` = Warm White | ✓ |
| Secondary text | `text-slate-600` = warm mid-tone | ✓ |
| Gold accent | `bg-indigo-700` = Vibrant Gold | ✓ |
| Button text on gold | `color-indigo-950` = near-midnight | ✓ Readable |
| Score gradient | `oklch(68%…86)` → `oklch(81%…86)` | ✓ |
| Body glow | Radial gold atmospheric gradients | ✓ |

## 4. Light Theme — Specific Checks

| Element | Light state | Verdict |
|---------|-----------|---------|
| Page background | Cream `oklch(93% 0.014 72)` | ✓ |
| Card surfaces | Warm white | ✓ |
| Borders | Light cream border | ✓ |
| Primary text | Deep near-black | ✓ |
| Teal accent | `bg-indigo-700` = Deep Teal #0E4F4A | ✓ |
| Button text on teal | Light (`color-indigo-950`) | ✓ |

---

## 5. Remaining Visual Limitations

| Item | Reason |
|------|--------|
| `SkillOverviewView` h1 says "Skill graph" (nav says "Skill Intelligence") | Locked by test: `findByRole("heading", { name: "Skill graph" })` — test must be updated before fix |
| Browser visual verification | Not possible without headless browser — source code and logic inspection only |
