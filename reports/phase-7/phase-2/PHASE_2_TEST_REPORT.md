# NEXUS Phase 7 Phase 2 — Test Report

**Date:** 2026-11-07  
**Result:** 134/134 passing

---

## Summary

```
Test Files  10 passed (10)
      Tests  134 passed (134)
   Duration  27.89s
```

No failures or errors.

---

## Test File Changes

### `src/test-setup.ts` — Browser API stubs added

jsdom does not implement `window.matchMedia` or `IntersectionObserver`. Both are called by LandingPage components (`HeroSection` and `useScrollReveal`) in contexts where the window exists but these APIs are not polyfilled.

```typescript
if (typeof window !== "undefined") {
  // window.matchMedia stub
  if (typeof window.matchMedia !== "function") { ... }
  // IntersectionObserver stub
  if (typeof window.IntersectionObserver === "undefined") { ... }
}
```

The `typeof window !== "undefined"` outer guard ensures these stubs don't throw in the `App.test.tsx` node-environment test (which uses `renderToStaticMarkup`).

### `src/App.test.tsx`

**Changed assertion:**
- `"GitHub Evidence Engine"` → `"IS EVIDENCE"` — The old assertion matched the authenticated shell sidebar tagline. The landing page at `/` now contains "IS EVIDENCE" in the hero headline.

### `src/App.interaction.test.tsx`

**4 skill-overview tests changed from `mount()` to `mount("/skills")`:**
- "renders API data and opens a skill's detail"
- "shows the no-evidence state for a skill without a score"
- "shows an error and recovers on retry"
- "shows Not yet analyzed and never a score before any analysis exists"

The default path `/` now renders LandingPage. Skills overview tests need `/skills`.

**Unauthenticated test kept at `mount()` (path `/`):**
- "shows the sign-in prompt for an unauthenticated session" — LandingPage at `/` renders `FinalCTASection` with a "Sign in with GitHub" link pointing to `/api/auth/github`. The assertion `.length.toBeGreaterThan(0)` passes. No `/api/skills` calls are made since LandingPage doesn't fetch skills data.

### `src/auth/account-menu.test.tsx`

**Default mount path changed from `"/"` → `"/skills"`:**

Using `"/"` rendered LandingPage which has no `AccountMenu`. Using `/dashboard` caused `DashboardPage` to make API calls not covered by the stub, producing unexpected `role="alert"` elements. `/skills` only requires `/api/skills` (covered by the stub with `{ analysis: null, categories: [] }`).

**Expired-session test changed to `mount("/skills")` explicitly:**
```typescript
it("returns to the signed-out state when a data request reports an expired session", async () => {
  routes["/api/skills"] = () => fail(401, "UNAUTHORIZED", "Invalid or expired session.");
  mount("/skills");  // SkillOverviewPage fetches /api/skills, triggering the 401
```

**Cancelled sign-in test behavior:** `window.history.replaceState(null, "", "/?auth_error=cancelled")` sets the real `window.location`. `AuthContext.consumeCancelledNotice()` reads this and sets `notice`. After redirect to `/`, `LandingPage` renders `AuthNotice` which displays the notice message. `screen.findByText(/sign-in was cancelled/)` finds it.

### `src/features/skills/skills.test.tsx`

**Back link assertion updated:**
- `expect(html).toContain('href="/"')` → `'href="/skills"'`

The `SkillDetailView` back link was changed to `/skills` in Phase 2.

### `src/features/repositories/repositories.test.tsx`

No test file changes needed. The `"navigates to the Skill Graph after scoring"` test passed after updating the `RepositoriesView.tsx` link from `to="/"` to `to="/skills"` and fixing the `matchMedia` stub.

---

## Non-breaking Console Warnings

```
Not implemented: HTMLCanvasElement's getContext() method
```

Three.js is lazy-loaded via `React.lazy`. In tests where LandingPage renders at `/` (unauthenticated redirect), `useThreeJs` is `false` (jsdom: `typeof window !== "undefined"` but `window.innerWidth === 0 < 1024`), so `HeroScene` is not mounted. These warnings originate from other components that may instantiate canvas elsewhere and are pre-existing.

---

## Coverage Impact

The route migration adds LandingPage to integration test coverage:
- Unauthenticated session flow: LandingPage renders at `/` after auth 401
- Cancelled sign-in notice: `AuthNotice` shown via `useAuth().notice`
- Theme state: validated through `getStoredTheme()` SSR guard
- Three.js load path: validated offline (lazy chunk only on desktop)
