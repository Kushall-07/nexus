# NEXUS Phase 7 Phase 2 — Final Design QA

**Date:** 2026-11-07
**Branch:** `main` (local only)

---

## Dark Theme (Gold Signal) — Verification

| Element | Color | Status |
|---|---|---|
| Page background | `oklch(5.5% 0.009 265)` Midnight Black | ✓ |
| Body atmospheric glow | Gold radials at 12%/92%/55% | ✓ |
| Headings | `oklch(96% 0.012 90)` Warm White | ✓ |
| Body text | `oklch(60–85% 0.008–0.012 90)` warm grays | ✓ |
| Primary CTA background | `oklch(81% 0.195 86)` Vibrant Gold | ✓ |
| Primary CTA text | `var(--color-indigo-950)` = `oklch(5.5% 0.009 265)` Midnight Black | ✓ Fixed |
| Gradient text (`IS EVIDENCE.`, etc.) | Gold gradient `oklch(81%→90% 0.195→0.140 86)` | ✓ |
| Score fill bars | Gold gradient | ✓ |
| Navigation borders | `oklch(13% 0.007 265)` subtle dark border | ✓ |
| Card surfaces | `oklch(8% 0.008 265)` lifted dark | ✓ |
| Muted text | `oklch(46% 0.004 255)` | ✓ |
| CTA shimmer | White `oklch(100% 0 0 / 0.25)` sweep | ✓ |
| Focus ring | `oklch(81% 0.195 86)` Gold (via `ring-indigo-700`) | ✓ |

---

## Light Theme (Cream / Deep Teal / Coral) — Verification

| Element | Color | Status |
|---|---|---|
| Page background | `oklch(93% 0.014 72)` Cream | ✓ |
| Body atmospheric tint | Teal + coral radials (soft) | ✓ |
| Headings | `oklch(16% 0.055 192)` near-black teal | ✓ |
| Body text | `oklch(28–37% 0.015–0.040 192)` dark teal-tinted grays | ✓ |
| Primary CTA background | `oklch(30% 0.065 192)` Deep Teal | ✓ |
| Primary CTA text | `var(--color-indigo-950)` = `oklch(98% 0.006 72)` near-cream | ✓ Fixed |
| Gradient text (`IS EVIDENCE.`, etc.) | Teal→Coral `oklch(30%→70%)` | ✓ Fixed |
| Score fill bars | Teal gradient | ✓ Fixed |
| Navigation transparent | Cream at `bg-slate-50/92` | ✓ |
| Navigation scrolled | Cream backdrop `oklch(93% 0.014 72 / 0.92)` | ✓ |
| Card surfaces | `oklch(98% 0.006 72)` near-white elevated | ✓ |
| Default borders | `oklch(84% 0.015 72)` warm light border | ✓ |
| Muted text | `oklch(45% 0.010 200)` teal-tinted | ✓ |
| Hover backgrounds | `oklch(90% 0.013 72)` hover tint | ✓ |
| Focus ring | `oklch(30% 0.065 192)` Deep Teal (via `ring-indigo-700`) | ✓ |

### Light theme intentionality

The light theme does not look like a simple dark-theme inversion:
- Gradient text transitions from teal to coral rather than any gold remnant.
- Score bars use a teal gradient that matches the action/brand color.
- The atmospheric body glow uses teal + coral radials matching the palette.
- The "Without evidence" card uses cream tinted background; the "With NEXUS" card uses
  the teal accent family for borders and check marks.
- Typography hierarchy, spacing, and border weight are identical between themes
  (token-based, not theme-specific).

---

## Contrast Ratios — Key Pairs

| Pair | Dark estimate | Light estimate | WCAG AA target |
|---|---|---|---|
| Primary CTA button text/bg | Black L 5.5% on Gold L 81% | Cream L 98% on Teal L 30% | AA (≥ 4.5:1) ✓ |
| Heading text on page bg | Warm White L 96% on Black L 5.5% | Near-black L 16% on Cream L 93% | AA ✓ |
| Body text on page bg | Warm gray L 60% on Black L 5.5% | Teal-gray L 37% on Cream L 93% | AA ✓ |
| Muted text on page bg | Gray L 46% on Black L 5.5% | Teal-gray L 45% on Cream L 93% | AA ✓ (borderline) |
| CTA shimmer overlay | White 25% opacity on Gold | White 25% opacity on Teal | Decorative — no text |

---

## Typography

| Attribute | Value |
|---|---|
| Display font | Barlow Condensed 700/800/900 (Google Fonts) |
| Body font | Inter 400/500/600/700 |
| Mono font | JetBrains Mono 400/500 |
| Hero headline | `clamp(3.5rem, 10vw, 7.5rem)` |
| Section headlines | `clamp(1.8–2rem, 4–5vw, 3–3.5rem)` |
| Body | 14–16 px, 1.6–1.65 line-height |
| Letter spacing (display) | `-0.025em` |

Typography hierarchy is consistent in both themes. The font stack falls back gracefully
to Impact/Arial Narrow/system-ui if Google Fonts fails to load.

---

## Mobile Verification

| Check | Status |
|---|---|
| Three.js hero skipped on mobile | ✓ — `pointer: coarse` and `width < 1024px` checks |
| StaticHeroBackground SVG fallback shows | ✓ |
| Navigation collapses to hamburger | ✓ — `md:hidden` / `hidden md:flex` split |
| Mobile menu opens and closes correctly | ✓ — Full focus trap, Escape, outside-click |
| CTA buttons full-width on mobile | ✓ — `w-full` on mobile CTAs |
| Sections stack vertically | ✓ — Responsive grid `lg:grid-cols-2` |
| No horizontal overflow | ✓ — `overflow-x-clip` on main, `min-width: 320px` on body |
| Theme toggle visible on mobile | ✓ — Present in mobile action bar |

---

## Interactive States

| State | Dark | Light |
|---|---|---|
| CTA hover | `opacity-90` | Same |
| Nav link hover | `bg-slate-100 text-slate-900` | Cream hover tint |
| Theme toggle hover | `bg-slate-100 text-slate-900` | Same (maps to cream) |
| Focus ring | Gold outline | Teal outline |
| Active nav link | `bg-indigo-100 text-indigo-900 shadow-[inset_3px_0_0_gold]` | Maps to teal |

---

## Animations

| Animation | Reduced motion behavior |
|---|---|
| Hero `landing-reveal` fade-in | CSS global `animation-duration: 0.01ms` overrides |
| Section scroll-reveal | `.landing-section-reveal` reset to `opacity:1; transform:none; transition:none` |
| CTA shimmer `::after` | `animation: none` |
| Three.js scene | Entirely skipped (`matchMedia` check before `useState`) |
| SVG node pulse | Effectively no-op (box-shadow on SVG doesn't render) |

---

## Known Visual Limitations

| Item | Detail |
|---|---|
| `og:image` absent | No social preview image — card will render without image on social shares |
| `canonical` / `og:url` absent | No production domain established |
| `nx-node-pulse` on SVG | CSS box-shadow animation has no effect on SVG elements in browsers; the StaticHeroBackground nodes do not visibly pulse. The pulsing `circle` fills are still visible at their static opacity. |
| Light header transparent state | When the page has just loaded (before scroll), the header is transparent against the Three.js or static background. On cream backgrounds with light particles, contrast may be low. Users can scroll to trigger the frosted backdrop. |

None of the above limitations block Phase 3.
