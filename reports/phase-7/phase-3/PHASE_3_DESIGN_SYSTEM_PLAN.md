# NEXUS Phase 3 — Design System Plan
**Date:** 2026-11-07  
**Status:** Plan only. No code modified.

---

## Existing Design System State

The Gold Signal design system is defined entirely in `apps/web/src/index.css`. It uses Tailwind CSS v4's `@theme` directive to override the default slate and indigo palettes with NEXUS-specific values.

**What exists and works:**
- Full dark palette (Midnight Black + Warm White + Vibrant Gold)
- Full light palette (Cream + Deep Teal + Coral)
- Typography stack (Barlow Condensed / Inter / JetBrains Mono)
- Semantic utility classes (`.nx-panel`, `.nx-score-fill`, `.nx-gradient-text`, `.nx-glass`)
- Animation keyframes (fade-in, skeleton-pulse, landing-reveal, shimmer, typing-dot)
- Theme transition system (`[data-theme]` + `theme-no-transition`)
- Both themes verified in Phase 2

**What must not change:**
- The `@theme` color overrides
- The `[data-theme="light"]` overrides
- The `initTheme()` call in `main.tsx`
- The `data-theme` attribute on `<html>`

---

## Color Token Reference

This is the authoritative Phase 3 reference. All component authors must use these Tailwind classes — never raw oklch() values in component files.

### Surface and Background

| Token Class | Dark | Light | Use |
|---|---|---|---|
| `bg-slate-50` | Midnight Black `#08090B` | Cream `#F1EEE8` | Page background |
| `bg-white` | Lifted dark surface | Near-white cream | Card, panel, sidebar background |
| `bg-slate-100` | Hover tint dark | Hover tint cream | Hover backgrounds |
| `bg-indigo-50` | Very subtle gold tint | Very subtle teal tint | Active nav, highlighted section background |
| `bg-indigo-100` | Active nav gold tint | Active nav teal tint | Selected state, active nav item |

### Text

| Token Class | Dark | Light | Use |
|---|---|---|---|
| `text-slate-900` | Warm White | Near-black | Headings, primary text |
| `text-slate-800` | Strong body/subheadings | Strong body | Sub-headings, strong labels |
| `text-slate-700` | Body text (warm) | Dark body text | Body copy, description text |
| `text-slate-600` | Secondary text | Secondary text (teal cast) | Secondary labels |
| `text-slate-500` | Muted helper | Muted teal | Helper text, timestamps |
| `text-slate-400` | Icons, placeholders | Icons, placeholders | Icon color, placeholder text |

### Primary (Action)

| Token Class | Dark | Light | Use |
|---|---|---|---|
| `text-indigo-700` | Vibrant Gold | Deep Teal | Links, icons, primary accent |
| `bg-indigo-700` | Vibrant Gold bg | Deep Teal bg | Primary buttons, active indicators |
| `text-indigo-900` | Warm light gold | Near-black teal | Text on gold/teal backgrounds |
| `border-indigo-200` | Gold tint border | Teal tint border | Highlighted card borders |
| `border-indigo-700` | Gold | Deep Teal | Active nav left border |

### Borders

| Token Class | Dark | Light | Use |
|---|---|---|---|
| `border-slate-200` | Subtle dark border | Cream border | Default card/section borders |
| `border-slate-300` | Medium dark border | Stronger cream border | Dividers, stronger borders |

### Semantic States

| State | Color family | Dark example | Light example |
|---|---|---|---|
| Success / demonstrated | emerald | `text-emerald-500` | same |
| Warning / partial | amber | `text-amber-500` | same |
| Error / missing | red | `text-red-500` | same |
| AI / Copilot | violet | `text-violet-500` | same |
| Info | sky | `text-sky-500` | same |

### Focus ring (accessibility)

```
focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2
```

This applies Gold in dark mode, Deep Teal in light mode — automatically via token override.

---

## Typography

### Display text (Barlow Condensed)

```
className="font-display"
```

Use for: page titles, large metric numbers, hero text, section headlines.

Font weight: 900 (set in CSS `.font-display` class). Letter spacing: -0.025em. Line height: 0.93.

### Body text (Inter)

Default — no class needed. Applied to `<body>` in CSS.

### Monospace (JetBrains Mono)

```
className="font-mono"
```

Use for: skill scores, evidence IDs, technical labels, code snippets.

### Type scale

| Use | Tailwind size | Display font? |
|---|---|---|
| Page H1 | `text-3xl` or inline `font-size: 1.75rem` | Yes (`font-display`) |
| Section H2 | `text-base font-semibold` | No (Inter semibold) |
| Card title | `text-sm font-semibold` | No |
| Body copy | `text-sm` | No |
| Helper/meta | `text-xs` | No |
| Metric number | `text-2xl font-mono tabular-nums` | No (mono) |
| Nav group label | `text-[10px] font-semibold uppercase tracking-widest` | No |
| Badge / chip | `text-xs font-medium` | No |

---

## Spacing System

Tailwind's default spacing scale. Phase 3 conventions:

| Use | Spacing |
|---|---|
| Page top padding | `py-6` |
| Page horizontal padding | `px-4 sm:px-6` |
| Section gap | `space-y-7` (28px) |
| Card padding | `p-4` or `px-4 py-3` |
| Card internal row | `py-3` |
| Inline icon gap | `gap-2.5` |
| Sidebar padding | `px-2 py-2` |
| Sidebar nav item | `px-3 py-2` |

---

## Border Radius

| Use | Class |
|---|---|
| Cards, panels | `rounded-xl` |
| Buttons | `rounded-lg` |
| Badges | `rounded-full` or `rounded-md` |
| Input fields | `rounded-lg` |
| Small interactive items (chips) | `rounded-md` |

---

## Shadow / Elevation

| Level | Class | Use |
|---|---|---|
| None | — | Default cards on dark bg |
| Subtle | `shadow-sm` | Cards that need slight lift on light bg |
| Modal / overlay | `shadow-2xl` | Drawers, dialogs |
| Glass | `.nx-glass` class | Landing page only; do not use in authenticated app |

---

## Component Visual Patterns

### Card

```jsx
<div className="rounded-xl border border-slate-200 bg-white">
  <div className="border-b border-slate-200 px-4 py-3">
    <h2 className="text-sm font-semibold text-slate-900">Section Title</h2>
  </div>
  <div className="px-4 py-3">
    {/* content */}
  </div>
</div>
```

### Interactive card / link card

```jsx
<div className="group rounded-xl border border-slate-200 bg-white px-4 py-3 
                transition-colors hover:border-indigo-300 hover:bg-indigo-50 
                focus-visible:ring-2 focus-visible:ring-indigo-700 cursor-pointer">
```

### Primary button

```jsx
<button className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold 
                   transition-opacity hover:opacity-90 
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2"
        style={{ color: "var(--color-indigo-950)" }}>
  Label
</button>
```

**Note:** The button text color must use `var(--color-indigo-950)` inline style — Midnight Black in dark mode, Near-cream in light mode. This cannot be expressed as a Tailwind class because the light theme changes `--color-indigo-950` to near-cream for maximum contrast on teal buttons.

### Secondary button

```jsx
<button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700
                   transition-colors hover:bg-slate-100 hover:text-slate-900
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2">
  Label
</button>
```

### Active nav item

```jsx
<NavLink className={({ isActive }) => 
  isActive 
    ? "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium bg-indigo-100 text-indigo-900 border-l-2 border-indigo-700"
    : "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
}>
```

**Note on current active state:** App.tsx uses `shadow-[inset_3px_0_0_oklch(81%_0.195_86)]` which hardcodes the dark-mode gold color. Phase 3 must replace this with `border-l-2 border-indigo-700` which adapts via the token override.

### Panel accent

```jsx
<div className="nx-panel rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
  {/* gold accent left border in dark, teal in light */}
</div>
```

Variants: `.nx-panel-success`, `.nx-panel-warning`, `.nx-panel-danger` (from index.css)

---

## Gold Usage Guidelines

Gold (Vibrant Gold in dark / Deep Teal in light via `indigo-700`) must feel deliberate, not decorative.

**Use gold/teal for:**
- Active navigation item (border + icon color)
- Primary CTA buttons
- Primary links (`text-indigo-700`)
- Key metric emphasis
- Score meter fill
- Focus rings

**Do NOT use gold/teal for:**
- Section headers
- Body text
- Card borders (use slate-200)
- Status states (use emerald/amber/red)
- Decorating every card or badge
- Background fills on large areas

---

## Animation Guidelines

Existing animations (from index.css) to preserve:
- `fade-in` (0.22s) — applied to `main > *` automatically
- `skeleton-pulse` — loading state
- `landing-reveal` / `landing-section-reveal` — landing page ONLY, do not use in auth app
- `shimmer` / `nx-cta-shimmer` — landing CTA only
- `typing-dot` — Copilot chat typing indicator

New animations for authenticated app:
- Sidebar collapse transition: `transition-[width]` with duration-200
- Toast slide-in: `translate-x-full → translate-x-0`, 150ms
- Dialog scale-in: `scale-95 opacity-0 → scale-100 opacity-100`, 150ms
- Command palette: `opacity-0 → opacity-100`, 100ms

**Reduced motion:** All new animations must check `prefers-reduced-motion`. The global rule in index.css handles most cases.

---

## Theme Toggle Implementation

Existing `lib/theme.ts` exports:
- `getStoredTheme(): "dark" | "light" | null`
- `setTheme(theme: "dark" | "light"): void`
- `toggleTheme(): void`
- `initTheme(): void` (called in main.tsx before React mounts)

Phase 3 ThemeToggle component should:
1. Read current theme from `document.documentElement.getAttribute("data-theme")`
2. Call `toggleTheme()` on click
3. Show appropriate icon (sun for dark→light, moon for light→dark)
4. Use `theme-no-transition` class during toggle to prevent flash
5. Update `aria-label` to describe the action ("Switch to light mode")

---

## Design System Extension Points

If Phase 3 needs new visual patterns, extend index.css in the following sections:

1. **New semantic utilities** (like `.nx-panel-ai` for Copilot) — add after the panel variants section
2. **New animations** — add before the reduced-motion block
3. **Light theme adjustments** — add to the `[data-theme="light"]` block

Do not create a new CSS file. Keep the design system in one place.

---

## What Phase 3 Must NOT Do

- Do not install shadcn/ui (Tailwind v4 compatibility issues; risk outweighs benefit for this project's scale)
- Do not install Radix UI primitives (same reason — custom implementations are simpler for this codebase)
- Do not install Recharts / Chart.js / D3 (not needed if we use CSS-based progress visualization + ScoreMeter patterns)
- Do not create a parallel design token file (globals.css, tokens.css, etc.)
- Do not use CSS modules — stick with Tailwind utilities
- Do not add `@layer components` rules for one-off components — inline Tailwind utilities are sufficient
