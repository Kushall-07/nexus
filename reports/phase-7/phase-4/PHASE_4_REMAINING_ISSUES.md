# Phase 4 — Remaining Issues
**Date:** 2026-11-08

---

## Issue 1 — SkillOverviewView heading does not match nav label

**Description:**  
The nav sidebar shows "Skill Intelligence" for the `/skills` route. The rendered page h1 says "Skill graph".

**Severity:** Minor (S4)

**Impact:**  
Cosmetic inconsistency. Users clicking "Skill Intelligence" in the sidebar arrive at a page titled "Skill graph". Functionally, the page is correct.

**Reason unresolved:**  
The heading "Skill graph" is required by an existing test assertion:
```tsx
// features/skills/skills.test.tsx
expect(await screen.findByRole("heading", { name: "Skill graph" })).toBeTruthy();
```
Changing the h1 to "Skill Intelligence" would break this test. The test must be updated first.

**Blocks UI redesign completion:** No

**Recommended later phase:** Update the test to `findByRole("heading", { name: "Skill Intelligence" })` and rename the h1 in the same PR.

---

## Issue 2 — Three.js hero not stoppable via CSS `prefers-reduced-motion`

**Description:**  
The CSS `@media (prefers-reduced-motion: reduce)` rule suppresses CSS animations and transitions. However, the Three.js canvas animation in the hero is controlled by JavaScript's `requestAnimationFrame` loop, which CSS rules cannot stop.

**Severity:** Minor (S4)

**Impact:**  
Users who prefer reduced motion will still see the Three.js particle animation. The fallback static constellation is CSS-based and correctly has no animation, but it is only shown when the canvas fails to load — not when the user prefers reduced motion.

**Reason unresolved:**  
Fixing this requires detecting `window.matchMedia("(prefers-reduced-motion: reduce)")` in `HeroScene.tsx` and either stopping the animation loop or reducing particle movement speed. This is a small but non-trivial change to the Three.js scene.

**Blocks UI redesign completion:** No

**Recommended later phase:** Add reduced-motion detection to `HeroScene.tsx` to stop or slow the animation loop when the user prefers reduced motion.

---

## Issue 3 — No automated accessibility scan (axe/pa11y)

**Description:**  
No automated accessibility testing tool was run against the rendered application.

**Severity:** Minor (S4) — documentation gap only

**Impact:**  
Automated tools can catch contrast issues and ARIA errors that manual code inspection may miss.

**Reason unresolved:**  
Browser automation (headless Chrome, Playwright with axe) was not available in the Phase 4 environment.

**Blocks UI redesign completion:** No

**Recommended later phase:** Run `@axe-core/playwright` as part of the E2E test suite.

---

## Issue 4 — No route-level code splitting

**Description:**  
All page components (except `HeroScene`) are bundled into the main `index.js` chunk (458.66 kB, 126.54 kB gzip).

**Severity:** Minor (S4)

**Impact:**  
First-load performance is slightly higher than it would be with lazy-loaded routes. The impact is minimal at 126 kB gzip.

**Reason unresolved:**  
The existing bundle size is acceptable and optimization would require wrapping each page component in `React.lazy()` and `<Suspense>` — a larger refactor.

**Blocks UI redesign completion:** No

**Recommended later phase:** Add route-level `React.lazy` splits to reduce initial bundle if the app grows further.
