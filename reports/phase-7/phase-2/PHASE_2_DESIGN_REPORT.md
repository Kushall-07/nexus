# NEXUS Phase 7 Phase 2 — Design Report

**Date:** 2026-11-07

---

## Design System: Gold Signal

### Color Palette

The landing page inherits NEXUS's Gold Signal system defined in `index.css`:

| Token | OKLCH | Hex approx | Role |
|---|---|---|---|
| `indigo-700` (remapped) | `oklch(81% 0.195 86)` | Vibrant Gold | Primary accent |
| `slate-50` | `oklch(5.5% 0.009 265)` | Midnight Black | Dark canvas |
| `slate-900` | `oklch(96% 0.004 265)` | Warm White | Primary text |
| `slate-700` | `oklch(78% 0.006 265)` | Muted text | — |

### Light Theme (`[data-theme="light"]`)

| Token | OKLCH | Role |
|---|---|---|
| Background | `oklch(93% 0.014 72)` | Warm Cream `#F1EEE8` |
| Primary text | `oklch(20% 0.015 265)` | Deep charcoal |
| Accent | `oklch(30% 0.065 192)` | Deep Teal `#0E4F4A` |
| Coral accent | `oklch(70% 0.148 36)` | Coral `#F67F5E` |

Theme persists via `localStorage` key `nexus-theme`. Applied via `data-theme="light"` on `<html>`. Initial apply uses a double-rAF transition suppressor to prevent flash.

---

## Landing Page Visual Architecture

### Section Order

1. **LandingNav** — sticky glass header (blurs on scroll), auth-aware CTAs
2. **HeroSection** — full-viewport, particle network behind centered headline
3. **PositioningSection** — evidence vs keywords contrast cards
4. **HowItWorksSection** — 4-step numbered process
5. **EvidenceSection** — signal weight bars (illustrative)
6. **SkillIntelligenceSection** — 8 skill cards with scored/unscored/gap states
7. **TrustSection** — 4 trust signals in grid
8. **FinalCTASection** — primary GitHub sign-in CTA

### Hero Typographic Treatment

```
YOUR CODE
IS EVIDENCE.
```

- Font: `Barlow Condensed` (display, `font-display`), weight 700–900
- Size: `clamp(3.5rem, 10vw, 7.5rem)`, line-height 0.90
- "IS EVIDENCE." wrapped in `nx-gradient-text` (gold → warm white gradient)
- Entrance: CSS `@keyframes landing-reveal` (fade + 20px upward translate, 0.6s ease-out)

### Particle Network (Three.js Hero)

Three particle types mapped to the NEXUS information architecture:
- **Repositories** (38 particles): Small, dim — `aSize` range 1.5–2.5
- **Skills** (38 particles): Medium, gold-tinted — `aSize` range 3.0–5.0
- **Opportunities** (19 particles): Large, bright — `aSize` range 5.5–8.5

Custom `ShaderMaterial` vertex shader scales `gl_PointSize` by `aSize * (900.0 / -mvPos.z)`.

Connections: `THREE.LineSegments` with dynamic `aAlpha` attribute. Only particles within `CONNECTION_DISTANCE` (25 units) are connected. Pivot group rotates at `ROTATION_SPEED = 0.00015 rad/frame`.

Pointer attraction: Ray from camera through mouse position to z=0 plane. Particles within `POINTER_RADIUS` (22 units) are pulled toward the intersection point with `POINTER_STRENGTH = 0.045`.

### Static Fallback (CSS/SVG)

Rendered for:
- Mobile (`pointer: coarse` or `window.innerWidth < 1024`)
- Reduced motion (`prefers-reduced-motion: reduce`)
- SSR and test environments (`typeof window === "undefined"` or `matchMedia` unavailable)
- WebGL load failures (Three.js `React.lazy` Suspense fallback)

SVG with 15 pre-positioned nodes and 17 edges, using `nx-node-pulse` CSS animation (pre-existing).

### Scroll Reveal

`useScrollReveal()` hook wraps `IntersectionObserver`. When element enters viewport at ≥8% threshold, adds `is-visible` class. The CSS transition moves the section from `opacity: 0; transform: translateY(32px)` to visible. Skipped when `prefers-reduced-motion: reduce`.

---

## Typography

| Usage | Family | Size | Weight |
|---|---|---|---|
| Hero h1 | Barlow Condensed | clamp(3.5–7.5rem) | 900 |
| Section h2 | Barlow Condensed | clamp(2.2–3.5rem) | 800 |
| Body | System sans-serif | 1rem–1.2rem | 400 |
| Nav | System sans-serif | 0.875rem | 500–600 |

---

## Responsive Behavior

- **Desktop (≥1024px)**: Three.js particle network hero, full multi-column section layouts
- **Tablet (768–1023px)**: Static SVG hero, 2-column grids collapse
- **Mobile (<768px)**: Static SVG hero, single-column layout, hamburger nav menu

The Three.js hero is gated behind both `pointer: coarse` (touch device) AND `innerWidth < 1024` checks, ensuring battery and performance impact is limited to desktop users.

---

## Accessibility

- Skip-to-main link: `<a href="#hero-content" className="skip-to-main">`
- `aria-hidden="true"` on all decorative SVG/Three.js elements
- Keyboard-navigable nav with `focus-visible:ring-2 focus-visible:ring-indigo-700`
- `AuthNotice` shown with `role="status"` for screen reader announcement
- Color contrast: Tailwind text utilities maintain WCAG AA for body text
- Reduced motion: Three.js disabled; scroll reveal transitions disabled
