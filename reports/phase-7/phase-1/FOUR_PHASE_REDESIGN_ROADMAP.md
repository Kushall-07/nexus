# NEXUS — Four-Phase Redesign Roadmap
## Phase 7, Phase 1

**Date:** 2026-11-07  
**Scope:** Phases 1–4 of the Phase 7 frontend redesign

---

## Overview

```
Phase 1 ─── Discovery, research, architecture, and design foundation
Phase 2 ─── Public landing page and NEXUS visual identity
Phase 3 ─── Authenticated application redesign and feature integration
Phase 4 ─── Responsive refinement, accessibility, performance, and release readiness
```

**Ordering rationale:**
- Phase 1 produces the blueprints all other phases implement
- Phase 2 (landing page) can be built independently as a new component added to `AuthGate`
- Phase 3 (authenticated app) refines and extends the existing application — depends on Phase 2 design language being confirmed
- Phase 4 is a quality pass across both phases — depends on Phase 2 and 3 being functionally complete

---

## Phase 1 — Discovery, Research, Architecture, and Design Foundation

**Status:** This phase. In progress.

### Scope

- Read and understand the existing repository in depth
- Audit all available Claude Code skills and plugins
- Research design references (Linear, shadcn/ui, Naukri, Candidate, Simplify, Kage, Sylva, Liquid Metal, Gallery Heading)
- Produce the NEXUS information architecture
- Produce the NEXUS design system blueprint
- Document the technical architecture
- Produce the four-phase implementation roadmap
- Produce the Phase 1 Final Report

### Dependencies

- Access to the NEXUS repository
- Access to Claude Code skills

### Deliverables

| Document | Location |
|---|---|
| `PROJECT_AUDIT.md` | `reports/phase-7/phase-1/` |
| `SKILLS_AND_PLUGINS_AUDIT.md` | `reports/phase-7/phase-1/` |
| `DESIGN_REFERENCE_ANALYSIS.md` | `reports/phase-7/phase-1/` |
| `PRODUCT_INFORMATION_ARCHITECTURE.md` | `reports/phase-7/phase-1/` |
| `NEXUS_DESIGN_SYSTEM.md` | `reports/phase-7/phase-1/` |
| `FRONTEND_TECHNICAL_ARCHITECTURE.md` | `reports/phase-7/phase-1/` |
| `FOUR_PHASE_REDESIGN_ROADMAP.md` | `reports/phase-7/phase-1/` |
| `PHASE_1_FINAL_REPORT.md` | `reports/phase-7/phase-1/` |

### Relevant Skills

- Explore agent (codebase reconnaissance)
- General-purpose agent (design research, backend audit)
- No implementation skills invoked (read-only phase)

### Exit Criteria

- [ ] All 8 deliverable documents created
- [ ] No application code modified
- [ ] No dependencies installed
- [ ] No git commits made
- [ ] Palette issue documented and confirmation questions raised
- [ ] Route change question documented (Phase 2 prerequisite)
- [ ] User has approved proceeding to Phase 2

---

## Phase 2 — Public Landing Page and NEXUS Visual Identity

**Depends on:** Phase 1 complete + user approval of:
1. Palette direction (Gold Signal continuation vs. new Cream/Teal/Coral)
2. Three.js vs. CSS-only hero
3. Route change approach (keep AuthGate pattern vs. dedicated `/` route)

### Scope

A complete redesign of the public-facing landing page. The existing `AuthGate.tsx` landing page is replaced with a new multi-section marketing website.

**What changes:**
- `AuthGate.tsx` landing page content replaced
- New sections written (see IA spec)
- Three.js hero scene implemented (lazy-loaded)
- New typography hierarchy for public website
- WebGL CTA button for hero (1–2 instances)
- Landing page navigation component

**What does NOT change:**
- Authentication flow (OAuth callback unchanged)
- Authenticated application routes
- Any backend code
- Design tokens in `index.css` (extend, not replace)

### Implementation Order

```
Session 2.1: Landing page foundation
├── New PublicLandingPage component (replaces AuthGate content)
├── Landing page navigation header
├── Hero section (CSS-only first pass — no Three.js yet)
├── "How NEXUS Works" section
└── Trust section + Footer

Session 2.2: Visual effects
├── Three.js particle network hero (lazy-loaded)
├── WebGL CTA button (1 instance)
├── Mobile fallback (CSS constellation animation)
└── Reduced motion fallback

Session 2.3: Remaining sections
├── GitHub Evidence Intelligence section
├── Skill Intelligence section
├── Role Gap Analysis section
├── Job Discovery section
├── Career Copilot section
└── Final CTA

Session 2.4: Polish and testing
├── Responsive testing (mobile, tablet, desktop)
├── Three.js performance testing
├── WebGL fallback testing
├── Reduced motion testing
└── Basic accessibility review
```

### Design Application

Apply skills in this order:
1. **`frontend-design`** — Before writing any code: define design plan (token system, layout concept, principles), review against brief, build
2. **`taste-skill`** — Apply visual quality bar; ensure landing page reads as premium, not templated
3. **`vercel-react-best-practices`** — Apply `bundle-dynamic-imports` for Three.js; apply `bundle-barrel-imports` rule

### Technical Requirements

| Requirement | Approach |
|---|---|
| Three.js scene | `React.lazy` + `Suspense` + `HeroScene.tsx` component |
| Mobile Three.js | Skip entirely (`window.innerWidth < 1024` or `pointer: coarse`) |
| Reduced motion | Static CSS gradient only |
| WebGL unavailable | CSS gradient fallback (already in body style) |
| Three.js cleanup | `useEffect` return: `dispose()` all geometries + materials |
| Font loading | Google Fonts CDN (defer self-hosting to Phase 4) |
| Lazy loading | Only HeroScene and WebGL button components |

### Risks

| Risk | Mitigation |
|---|---|
| Three.js bundle size | Measure with `vite build --mode analyze`; target <150KB compressed |
| Three.js mobile performance | Skip entirely on mobile — use CSS fallback |
| WebGL CTA complexity | Start with enhanced CSS shimmer; add WebGL as optional enhancement |
| Landing page interfering with AuthGate | Keep AuthGate wrapper; replace only the content returned when unauthenticated |
| Existing landing page tests | Run E2E tests after each session; fix before proceeding |

### Exit Criteria

- [ ] Landing page renders correctly on mobile, tablet, desktop
- [ ] Three.js hero loads without blocking LCP
- [ ] Static fallback works on mobile and reduced-motion
- [ ] All existing E2E tests pass
- [ ] No new console errors
- [ ] Code reviewed and simplified (`simplify` skill)
- [ ] User approves visual quality before Phase 3

---

## Phase 3 — Authenticated Application Redesign

**Depends on:** Phase 2 complete + user approval of visual direction

### Scope

A comprehensive redesign of the authenticated application. The goal is to transform the existing functional-but-minimal interface into a sophisticated, information-rich career intelligence workspace.

**Major changes:**
- Collapsible sidebar with shadcn Sidebar component
- Global command palette (Cmd+K)
- Dashboard redesign with actual intelligence (stats, charts, quick actions)
- Job Discovery with improved layout (filter sidebar + list + detail panel)
- Skill Overview with visualization (score bars + chart)
- Application Tracker as proper data table
- Role & Gap Analysis with improved visualization
- Development Plan with improved progress visualization
- Career Copilot with improved chat UI
- Lucide React icon library replacing custom inline SVGs
- shadcn component system integrated with Gold Signal tokens

**What does NOT change:**
- All existing API integrations
- Authentication flow
- Business logic and scoring
- Frozen config files
- Existing route paths (with the exception of `/` → `/skills` if approved)

### Implementation Order

```
Session 3.1: Foundation — component system and shell
├── shadcn initialization (init command, token mapping)
├── Gold Signal CSS variables mapped to shadcn variables
├── Sidebar with collapse state (shadcn Sidebar)
├── Lucide React icons replacing Icons.tsx
├── Command palette (shadcn Command + Dialog)
└── App shell updated

Session 3.2: Dashboard and navigation
├── Dashboard redesign (profile stats, quick actions, skill summary)
├── Breadcrumb component
├── Page header template (title + actions)
└── Account menu redesign (shadcn DropdownMenu)

Session 3.3: Job Discovery and Applications
├── Opportunities page layout (filter sidebar + job list)
├── Job card redesign (shadcn-compatible)
├── Job detail panel (shadcn Sheet)
├── Application Tracker redesign (shadcn Table)
├── Status filter tabs
└── Application status update (inline select)

Session 3.4: Career Intelligence pages
├── Skill Overview redesign (category tabs + score visualization)
├── Skill Detail redesign (evidence breakdown)
├── GitHub Evidence page redesign (repo list, analysis status)
├── Role & Gap Analysis redesign (gap visualization)
└── Development Plan redesign (progress bar, task list)

Session 3.5: Career Copilot and remaining pages
├── Copilot chat interface redesign (shadcn chat primitives)
├── Resume page redesign
├── Preferences page redesign (better form layout)
├── Settings page redesign
└── 404 page

Session 3.6: Skill network graph
├── Canvas 2D skill network visualization
├── Interactive nodes (hover = skill details, click = navigate)
├── Category clustering
└── Integration into Skill Overview page
```

### Design Application

Apply skills in this order per session:
1. **`shadcn`** — Component initialization, token mapping, component addition
2. **`frontend-design`** — Visual direction for each page; review against brief before building
3. **`vercel-react-best-practices`** — Apply optimization rules throughout
4. **`web-design-guidelines`** — Spot checks during each session (not a full review yet — that's Phase 4)

### Technical Requirements

| Requirement | Approach |
|---|---|
| shadcn initialization | `npx shadcn@latest init` with Gold Signal preset |
| Component additions | Add components incrementally as needed |
| Lucide icons | `npm install lucide-react` (requires approval) |
| TanStack Query | Add for server state caching (Phase 3B) |
| Sidebar state | `useLocalStorage` hook for collapse persistence |
| Command palette | shadcn Command + Dialog, keyboard shortcut hook |
| Skill network | Canvas 2D with requestAnimationFrame |
| Table sorting | Client-side sorting for Application Tracker |

### Risks

| Risk | Mitigation |
|---|---|
| shadcn color conflicts with Gold Signal | Thorough token mapping before adding components |
| Component scope creep | Implement only what's listed; resist adding unrequested features |
| Existing tests breaking | Run tests after each session; fix before proceeding |
| shadcn bundle size | Measure bundle before and after; use dynamic imports for heavy components |
| Accessibility regressions | Use `shadcn` accessibility-first components; verify with axe |

### Exit Criteria

- [ ] All authenticated pages redesigned
- [ ] Command palette functional with keyboard shortcut
- [ ] Collapsible sidebar working on desktop
- [ ] All existing E2E tests passing
- [ ] No accessibility regressions (manual check + axe)
- [ ] No console errors
- [ ] Bundle size within targets
- [ ] User approves all pages before Phase 4

---

## Phase 4 — Responsive Refinement, Accessibility, Performance, and Release Readiness

**Depends on:** Phase 3 complete

### Scope

A comprehensive quality pass across the entire application (landing page + authenticated app). This phase fixes all known issues, verifies all requirements, and prepares the product for real user traffic.

### Implementation Order

```
Session 4.1: Responsive testing and fixes
├── Test all pages at mobile (375px, 390px, 430px)
├── Test at tablet (768px, 1024px)
├── Fix all responsive layout issues
├── Fix all touch target size issues
└── Verify mobile navigation (drawer) behavior

Session 4.2: Accessibility audit
├── Run web-design-guidelines skill across all pages
├── Run axe-playwright E2E accessibility checks
├── Fix all WCAG 2.1 AA failures
├── Verify keyboard navigation (Tab, Shift+Tab, Escape, Enter)
├── Verify screen reader flow (VoiceOver/NVDA spot check)
└── Verify reduced motion on all animated elements

Session 4.3: Performance optimization
├── Measure bundle size with vite bundle analyzer
├── Add code splitting where bundles exceed 50KB
├── Measure Core Web Vitals (LCP, FID, CLS, INP)
├── Verify Three.js loads lazily and doesn't block LCP
├── Verify skill/job lists render smoothly
└── Consider self-hosting fonts if CDN latency is measurable

Session 4.4: Final polish
├── Fix any remaining visual inconsistencies
├── Verify consistent spacing and typography across all pages
├── Verify color contrast for all text/background combinations
├── Add any missing loading states or error states
├── Run simplify skill on changed code
└── Full E2E test run

Session 4.5: Release readiness
├── Verify all existing tests pass
├── Add any missing tests for new features (command palette, sidebar)
├── Environment variable documentation update
├── Build verification (tsc -b + vite build, no errors)
└── Deployment documentation (if needed)
```

### Design Application

1. **`web-design-guidelines`** — Full audit of all pages; fix all reported issues
2. **`vercel-react-best-practices`** — Final optimization pass
3. **`simplify`** (built-in) — Code quality review

### Exit Criteria

- [ ] All pages responsive and correct at 375px, 768px, 1024px, 1280px
- [ ] All WCAG 2.1 AA failures resolved
- [ ] All existing tests passing
- [ ] New tests added for new features
- [ ] Bundle size within targets (critical path <100KB gzip)
- [ ] Core Web Vitals in green range
- [ ] No console errors or TypeScript errors
- [ ] `tsc -b && vite build` exits with code 0
- [ ] User approves final quality

---

## Dependency Graph

```
Phase 1
  ├── All reports complete ──────────────────────────────► Phase 2
  └── User confirms palette + Three.js + route approach

Phase 2  
  ├── Landing page functional + visual quality approved ──► Phase 3
  └── All existing E2E tests pass

Phase 3
  ├── shadcn component system active
  ├── All authenticated pages redesigned ────────────────► Phase 4
  └── All existing E2E tests pass

Phase 4
  └── All quality criteria met ──────────────────────────► Release
```

---

## Estimated Session Boundaries

| Phase | Sessions | Notes |
|---|---|---|
| Phase 1 | 1 | This session (complete) |
| Phase 2 | 3–4 | Landing page + Three.js effects |
| Phase 3 | 5–7 | Full authenticated app redesign |
| Phase 4 | 2–3 | Quality pass |
| **Total** | **11–15** | Depends on scope decisions |

Sessions are independent and each should leave the application in a working, testable state. No session should end with broken tests or non-compiling code.

---

## Skills Assignment by Phase

| Skill | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|---|---|---|---|---|
| `frontend-design` | Reference only | ✓ Primary | ✓ Primary | ✓ Review |
| `shadcn` | Reference only | Minimal | ✓ Primary | ✓ Review |
| `vercel-react-best-practices` | Reference only | ✓ Checks | ✓ Checks | ✓ Optimization |
| `web-design-guidelines` | Reference only | Spot checks | Spot checks | ✓ Full audit |
| `taste-skill` | Reference only | ✓ Landing quality | ✗ | ✗ |
| `nateherk-design:scroll-craft` | Reference only | Optional | ✗ | ✗ |
| `simplify` (built-in) | ✗ | Per session | Per session | ✓ Full pass |

---

## What Is Out of Scope for All Phases

The following are explicitly out of scope for the Phase 7 redesign:

1. **Backend API changes** — All existing endpoints preserved. New endpoints only if the frontend design requires a genuinely missing capability (e.g., a combined profile stats endpoint for the Dashboard).

2. **Business logic changes** — config/scoring.json, config/roles.json, config/job-matching.json are frozen.

3. **New product features** — No new product capabilities are added. The redesign surfaces existing capabilities more effectively.

4. **Breaking changes to routes** — Existing route paths preserved unless the user approves a specific route change.

5. **Authentication changes** — The GitHub OAuth flow remains unchanged.

6. **Database schema changes** — Existing MongoDB models unchanged.

7. **New job provider integrations** — Job provider configuration unchanged.

8. **Light mode** — Dark-only unless explicitly requested.

9. **Paid service provisioning** — No new APIs, infrastructure, or paid services.

10. **Internationalization (i18n)** — Not in scope.
