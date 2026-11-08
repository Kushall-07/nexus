# Phase 4F — Frontend Performance Report
**Date:** 2026-11-08  
**Status:** Complete

---

## 1. Production Build Results

```
dist/index.html                      1.99 kB │ gzip:   0.93 kB
dist/assets/index-C7eDild0.css      47.75 kB │ gzip:   9.54 kB
dist/assets/index-CjdSGH54.js      458.66 kB │ gzip: 126.54 kB
dist/assets/HeroScene-BteR7wHw.js  536.80 kB │ gzip: 133.14 kB

Build time: 337ms
Compiler: Vite 8 + Rolldown
```

Build is successful with no errors. The chunk size warning for `HeroScene` is expected and intentional — see Section 3.

---

## 2. Bundle Analysis

### Chunk breakdown

| Chunk | Raw | Gzip | Contents |
|-------|-----|------|---------|
| `index.css` | 47.75 kB | 9.54 kB | Gold Signal design system, all Tailwind utilities, custom classes |
| `index.js` | 458.66 kB | 126.54 kB | React, React Router, all app components except Three.js hero |
| `HeroScene.js` | 536.80 kB | 133.14 kB | Three.js + hero particle system |

### Main bundle composition (estimated)

The `index.js` gzip size of 126.54 kB is reasonable for a full SaaS application shell with:
- React 19 + React Router
- Full authenticated app (~12 pages)
- Command palette
- Toast system
- All career feature components

The Three.js chunk is correctly isolated and only loaded when the landing page mounts.

---

## 3. Three.js Lazy Loading

Three.js is loaded via dynamic import in a separate Vite chunk:

```tsx
// HeroScene component loaded lazily
const HeroScene = React.lazy(() => import('./HeroScene'));
```

This means:
- The 536.80 kB Three.js bundle is **not downloaded on page load** for authenticated users
- It is only fetched when the landing page (`/`) is rendered
- Authenticated users who go directly to `/dashboard` never download Three.js
- The chunk is properly code-split by Vite

---

## 4. Route-Level Code Splitting

Currently, all application routes are bundled into `index.js`. Route-level code splitting (lazy loading each page component) is not implemented.

**Impact:** The main JS bundle is 126.54 kB gzipped. This is acceptable for the current scope.

**Note:** The Vite chunk size warning relates to `HeroScene.js` (pre-gzip: 536.80 kB). This is a known Three.js characteristic and cannot be meaningfully reduced without switching rendering strategies.

---

## 5. CSS Performance

| Concern | Status |
|---------|--------|
| No unused base Tailwind CSS | Tailwind v4 uses content scanning, only includes used classes — ✓ |
| No duplicate CSS | Single `index.css` output — ✓ |
| No CSS-in-JS runtime | Pure Tailwind + static CSS — ✓ |
| Font preconnect | `<link rel="preconnect" href="https://fonts.googleapis.com" />` — ✓ |
| Font display strategy | `display=swap` in Google Fonts URL — ✓ |

---

## 6. Runtime Performance Considerations

### React rendering

No unnecessary re-renders identified:

- `useApiResource` hook manages fetch state without prop drilling
- Toast deduplication prevents duplicate notification renders
- Sidebar state uses `useCallback` for the toggle function
- `useState` with initializer functions for localStorage reads (avoids re-read on re-render)

### API requests

Each page fetches its own data via `useApiResource`. No shared request caching layer exists, but this is by design — data freshness is preferred over caching for a career intelligence tool.

No repeated API requests on re-render detected (dependencies array correctly specified).

### Event listener cleanup

| Component | Listener | Cleanup |
|-----------|---------|---------|
| `AppShell` (Ctrl+K) | `keydown` | `return () => document.removeEventListener(…)` — ✓ |
| `MobileDrawer` (outside click) | `mousedown` | `return () => document.removeEventListener(…)` — ✓ |
| `MobileDrawer` (Escape) | `keydown` | `return () => document.removeEventListener(…)` — ✓ |
| `CommandPalette` (Escape/Tab) | `keydown` | `return () => document.removeEventListener(…)` — ✓ |

No memory leaks from unremoved event listeners.

### Three.js cleanup

Three.js canvas cleans up on unmount via `useEffect` return function in `HeroScene.tsx`.

---

## 7. Console Warnings

The only console messages observed during test runs are:

```
Not implemented: HTMLCanvasElement's getContext() method
```

These appear in the jsdom test environment (8 times) because jsdom does not implement WebGL. These are expected and harmless in tests. They will not appear in a real browser.

No React warnings (propTypes, key, etc.) were observed.

---

## 8. Image Loading

No `<img>` tags are used in the authenticated application. All imagery is:
- SVG icons (inline, no network request)
- CSS gradient backgrounds (zero load)
- Three.js canvas (JavaScript-rendered, one chunk)

---

## 9. Optimizations Applied

None were required — the existing implementation is already well-optimized.

---

## 10. Remaining Limitations

| Item | Impact | Recommendation |
|------|--------|----------------|
| No route-level code splitting | Slightly larger initial JS | Low priority; 126 kB gzip is acceptable |
| No service worker / offline support | No offline capability | Outside Phase 4 scope |
| No LCP/FID/CLS measurement | Cannot measure Core Web Vitals | Requires browser DevTools or Lighthouse |
| `HeroScene.js` chunk size warning | Vite warns at >500 kB raw | Expected; Three.js minimum size; `HeroScene` is lazy |
