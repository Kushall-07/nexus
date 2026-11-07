# NEXUS — Design System Blueprint
## Phase 7, Phase 1

**Date:** 2026-11-07  
**Status:** Provisional — several decisions require user confirmation (see Section 2)

---

## 1. Brand Direction

NEXUS is a career intelligence workspace for software engineers. The brand must communicate:

- **Intelligence** — the product knows things about the user's skills that the user may not fully see
- **Evidence** — every claim is backed by real repository data
- **Precision** — scores, weights, and gaps are computed deterministically
- **Professional confidence** — not corporate generic; not startup-casual

The Gold Signal design system (already implemented) captures this direction correctly. Phase 7 extends and enriches it rather than replacing it.

**Core design philosophy:** Every visual element earns its place by communicating information. Decoration for its own sake is excluded. Gold is used only where it means something.

---

## 2. Palette — IMPORTANT: Unconfirmed Values

### 2.1 Supplied Palette — Issues Identified

The following palette values were supplied in the Phase 1 prompt. **Two of three values contain invalid hexadecimal characters or lengths** and cannot be used as supplied.

| Supplied Value | Issue | Status |
|---|---|---|
| Cream: `S1EEE8` | Invalid — 'S' is not a hexadecimal character (valid hex: 0–9, A–F) | **CANNOT USE** |
| Deep teal: `0E4F4A` | Valid hexadecimal, 6 characters | Valid |
| Coral: `FF67F5E` | Invalid — 7 characters (valid hex has exactly 6, or 3/8 for alpha) | **CANNOT USE** |

### 2.2 Proposed Valid Interpretations

The following are suggested corrections. **None are confirmed. User must approve before they become design tokens.**

**Cream — possible interpretations:**
- `F1EEE8` — Warm off-white with subtle beige undertone
- `E1EEE8` — Cool mint-tinted cream  
- `F5EEE8` — Very warm cream (closest to typical "cream" intent)

**Recommended interpretation: `F1EEE8`** (warm off-white, legible "cream" value)

**Coral — possible interpretations:**
- `FF67F5` — Hot pink / magenta (unlikely to be intended "coral")
- `F67F5E` — Warm coral / salmon (most likely intended "coral" value)
- `FF6757` — Bright coral-red

**Recommended interpretation: `F67F5E`** (warm coral/salmon)

### 2.3 Supplied Palette vs. Existing "Gold Signal" Palette

The supplied palette suggests a fundamentally different visual direction from the existing Gold Signal system:

| | Supplied Direction | Existing Gold Signal |
|---|---|---|
| Background | Implied light/cream surfaces | Midnight Black (#08090B) |
| Primary text | Implied dark text on light bg | Warm White (#F5F3EF) |
| Accent | Deep teal (#0E4F4A) + Coral | Vibrant Gold (#F6C900) |
| Temperature | Warm/organic | Dark/technical |
| Contrast mode | Light theme | Dark theme |

**These are two distinct design directions.** Proceeding without confirmation risks implementing the wrong palette. 

**Question for user confirmation (required before Phase 2):**

> The supplied palette (Cream/Teal/Coral) suggests a light-themed, warmer, more organic visual direction — quite different from the existing "Gold Signal" dark palette already in the codebase. 
> 
> Please confirm:
> 1. Are the corrected hex values `F1EEE8` (Cream), `0E4F4A` (Teal), `F67F5E` (Coral) the intended values?
> 2. Is this a new palette to **replace** Gold Signal, or to **complement** it (e.g., light mode)?
> 3. Or should Gold Signal (Midnight Black / Warm White / Vibrant Gold) remain the primary palette?

---

### 2.4 Provisional Palette Architecture (Gold Signal Continuation)

For planning purposes, this document treats the existing Gold Signal palette as primary. If the supplied palette is confirmed as a replacement, this section will be updated.

#### Core Brand Colors

| Token | OKLCH | Approx Hex | Role |
|---|---|---|---|
| `brand-midnight` | `oklch(5.5% 0.009 265)` | `#08090B` | Page background |
| `brand-surface` | `oklch(8% 0.008 265)` | `#0F1012` | Card/panel surface |
| `brand-warm-white` | `oklch(96% 0.012 90)` | `#F5F3EF` | Primary text |
| `brand-gold` | `oklch(81% 0.195 86)` | `#F6C900` | Primary accent, CTAs, scores |

#### Semantic Palette

| Token | Value | Use |
|---|---|---|
| `color-background` | `brand-midnight` | Page background |
| `color-surface` | `brand-surface` | Card, panel, sidebar surfaces |
| `color-surface-elevated` | `oklch(11% 0.008 265)` | Elevated surface above surface |
| `color-text-primary` | `brand-warm-white` | Headings, primary labels |
| `color-text-secondary` | `oklch(60% 0.008 90)` | Body text, descriptions |
| `color-text-muted` | `oklch(46% 0.004 255)` | Helper text, placeholders |
| `color-text-disabled` | `oklch(32% 0.005 260)` | Disabled/inactive |
| `color-border` | `oklch(13% 0.007 265)` | Default borders |
| `color-border-strong` | `oklch(20% 0.006 265)` | Emphasized borders |
| `color-accent` | `brand-gold` | Gold — primary interactive color |
| `color-accent-hover` | `oklch(79% 0.198 86)` | Gold hover state |
| `color-accent-subtle` | `oklch(9% 0.030 86)` | Very subtle gold tint background |
| `color-success` | `oklch(61% 0.158 162)` | Demonstrated evidence, positive |
| `color-warning` | `oklch(66% 0.178 65)` | Partial evidence, caution |
| `color-error` | `oklch(59% 0.210 26)` | Missing evidence, errors, blockers |
| `color-info` | `oklch(61% 0.154 236)` | Informational states |
| `color-ai` | `oklch(59% 0.215 293)` | Copilot / AI feature indicator |

#### Evidence Strength Colors (Critical to Product)

| Strength | Token | Display Color | NEXUS Meaning |
|---|---|---|---|
| Demonstrated | `color-success` | Emerald | GitHub evidence score ≥ minimumScore |
| Partial | `color-warning` | Amber | Evidence exists but below threshold |
| Claimed (resume only) | `color-ai` | Violet | Resume says so but no GitHub evidence |
| Missing | `color-error` | Red | Required skill, no evidence |
| Not analyzed | `color-text-muted` | Gray | No repositories analyzed for this skill |

#### Light Mode Consideration

The current Gold Signal system is dark-only. If a light mode is desired in Phase 4, the semantic tokens should map differently:

```css
@media (prefers-color-scheme: light) {
  --color-background: #FAFAF9;    /* Near white */
  --color-surface: #FFFFFF;       /* White */
  --color-text-primary: #0F1012;  /* Near black */
  --color-accent: #C49600;        /* Darker gold for contrast on white */
}
```

**Recommendation:** Implement dark mode first. Add light mode in Phase 4 if requested.

---

## 3. Typography

### 3.1 Font Stack

| Font | Role | Weights | Source |
|---|---|---|---|
| **Barlow Condensed** | Display — hero headlines, section titles, big metrics | 700, 800, 900 | Google Fonts (can self-host) |
| **Inter** | Body — navigation, body text, labels, buttons, form inputs | 400, 500, 600, 700 | Google Fonts (can self-host) |
| **JetBrains Mono** | Mono — scores, evidence IDs, technical labels, code | 400, 500 | Google Fonts (can self-host) |

**Rationale for this stack:**
- Barlow Condensed creates distinctive visual impact at large sizes; uncommon in SaaS but appropriate for a "technical evidence" product
- Inter is the gold standard for legible UI text; not unusual but not a cliché in this context
- JetBrains Mono is a developer-familiar monospaced font; using it for scores and IDs reinforces the "technical precision" message

### 3.2 Type Scale

| Level | Font | Weight | Size | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|---|
| `display-xl` | Barlow Condensed | 900 | 6–8rem | 0.90 | -0.025em | Hero headline |
| `display-lg` | Barlow Condensed | 900 | 4rem | 0.92 | -0.025em | Section hero |
| `display-md` | Barlow Condensed | 800 | 2.5rem | 0.95 | -0.020em | Page titles |
| `display-sm` | Barlow Condensed | 700 | 1.75rem | 1.0 | -0.015em | Card/section heads |
| `h1` | Inter | 700 | 1.5rem | 1.3 | -0.01em | App page headings |
| `h2` | Inter | 600 | 1.25rem | 1.4 | -0.005em | Section headings |
| `h3` | Inter | 600 | 1.0rem | 1.5 | 0 | Subsection headings |
| `body-lg` | Inter | 400 | 1.0rem | 1.6 | 0 | Long-form text |
| `body` | Inter | 400 | 0.875rem | 1.5 | 0 | UI text, descriptions |
| `body-sm` | Inter | 400 | 0.8125rem | 1.5 | 0 | Helper text, captions |
| `label` | Inter | 500 | 0.8125rem | 1.3 | 0 | Input labels, nav items |
| `label-sm` | Inter | 500 | 0.75rem | 1.3 | 0 | Micro labels, badges |
| `nav-group` | Inter | 600 | 0.625rem | 1.2 | 0.08em | Sidebar group labels (tracked) |
| `code` | JetBrains Mono | 400 | 0.875rem | 1.5 | 0 | Score values, evidence IDs |
| `score` | JetBrains Mono | 500 | 0.9375rem | 1.0 | 0 | Numeric scores (tabular-nums) |

**Rules:**
- Never use Barlow Condensed below 1.5rem — it loses its character
- Apply `tabular-nums` feature-settings to all score/metric displays
- Keep body text below 80 characters per line (use `max-w-prose` or equivalent)
- Do not use tracking on body text
- Limit to two font families per page section

---

## 4. Spacing System

### 4.1 Base Scale (rem, 4px base unit)

```
0.25rem =  4px   — micro gap
0.5rem  =  8px   — tight spacing (icon padding, dense lists)
0.75rem = 12px   — small spacing (compact nav items)
1rem    = 16px   — base unit (most element padding)
1.25rem = 20px   — section padding small
1.5rem  = 24px   — card/panel padding
2rem    = 32px   — section spacing
3rem    = 48px   — large section gap
4rem    = 64px   — major section break
6rem    = 96px   — hero section padding
8rem    = 128px  — large hero
```

### 4.2 Layout Dimensions

| Dimension | Value | Use |
|---|---|---|
| Sidebar expanded | 256px (16rem) | Desktop authenticated sidebar |
| Sidebar collapsed | 56px (3.5rem) | Icon-only compact sidebar |
| Content max-width | 80rem (1280px) | Page content area |
| Content padding | 1rem / 1.5rem | Mobile / desktop horizontal padding |
| Nav item height | 2.25rem (36px) | Sidebar navigation items |
| Touch target min | 2.75rem (44px) | Mobile interactive elements |
| Input height | 2.25rem (36px) | Form inputs |
| Button height | 2.25rem (36px) | Standard buttons |
| Card padding | 1.5rem | Standard card interior padding |
| Section gap | 2rem desktop / 1.5rem mobile | Between content sections |

### 4.3 Responsive Breakpoints

| Breakpoint | Width | Context |
|---|---|---|
| sm | 640px | Compact content adjustments |
| md | 768px | Two-column layouts begin |
| lg | 1024px | Sidebar appears, desktop layout |
| xl | 1280px | Wider content area |
| 2xl | 1536px | Maximum content expansion |

---

## 5. Layout System

### 5.1 Authenticated Application Grid

**Desktop (lg+):**
- Sidebar: `256px` fixed left column
- Content: Flexible right column
- Content inner: `max-w-5xl` (80rem) centered within content column
- Content padding: `px-6 py-6`

**Mobile (<lg):**
- Full-width single column
- Sticky header (mobile only)
- Content padding: `px-4 py-5`
- Navigation: Drawer overlay

### 5.2 Landing Page Layout

**Hero:**
- Full viewport height (`100vh`)
- Background: Midnight Black + Three.js scene
- Content: Centered column (max-w-3xl) with text and CTA
- Responsive: Same structure at all sizes

**Content sections:**
- Full-width outer container
- Inner max-width: `max-w-6xl` (72rem) for most sections
- Section padding: `py-16 px-6` desktop / `py-12 px-4` mobile
- Alternating left-aligned and center-aligned content

**Two-column sections:**
- `grid grid-cols-1 md:grid-cols-2 gap-12` (default)
- Content-rich sections: `grid grid-cols-1 lg:grid-cols-5 gap-8` (60/40 split)

---

## 6. Component Inventory

### 6.1 Core Components Required

#### Button System

| Variant | Use | Style |
|---|---|---|
| `primary` | Main actions (Analyze, Connect GitHub, Save Job) | Gold background, Midnight Black text, shimmer |
| `secondary` | Supporting actions (View Details, Edit) | Gold border, gold text, transparent bg |
| `ghost` | Tertiary/nav actions (Cancel, Clear filter) | No border, text only, hover tint |
| `destructive` | Dangerous actions (Delete Account, Remove) | Red background, requires confirmation |
| `icon` | Icon-only controls | 36px square, tooltip required |
| `hero-cta` | Landing page primary (Connect GitHub) | WebGL effect or enhanced shimmer |

**Sizes:** sm (28px height) / default (36px) / lg (44px)  
**States:** default / hover / active/pressed / loading (spinner) / disabled / focus-visible

#### Input System

| Component | Use |
|---|---|
| `Input` | Text inputs (search, keyword, location) |
| `Select` | Dropdowns (work mode, experience level, status) |
| `Textarea` | Long text (notes, job descriptions) |
| `Checkbox` | Multi-select filters, repository selection |
| `Switch` | Boolean preferences (remote required) |
| `SearchInput` | Search with clear button and icon |
| `ComboBox` | Searchable select (target role, skill filter) |

#### Navigation

| Component | Use |
|---|---|
| `Sidebar` | Authenticated app navigation |
| `SidebarGroup` | Grouped nav sections with labels |
| `SidebarItem` | Individual nav link with icon and active state |
| `CommandPalette` | Cmd+K global search/navigation |
| `Breadcrumb` | Nested page context (e.g., Skills → Python) |
| `Tabs` | Section navigation within pages |
| `MobileNav` | Drawer overlay for mobile |

#### Content Display

| Component | Use |
|---|---|
| `Card` | Surface container (not overused — specific cases) |
| `DataTable` | Application tracker, evidence items |
| `SkillCard` | Skill name + score + evidence bar |
| `JobCard` | Job listing with match badge and metadata |
| `MatchBadge` | Strong/potential/stretch/blocked label |
| `ScoreMeter` | Evidence score bar (existing — keep) |
| `ProgressBar` | Development plan completion |
| `Badge` | Status labels, skill tags, source labels |
| `Avatar` | User GitHub avatar with fallback initials |

#### Overlay/Feedback

| Component | Use |
|---|---|
| `Dialog` | Confirmation dialogs (delete, role selection) |
| `Sheet` | Side panels (job detail on wide screens) |
| `Drawer` | Mobile navigation, filters, job detail |
| `Toast` | Save confirmations, analysis status updates |
| `Tooltip` | Evidence explanations, match detail popups |
| `Popover` | Inline filter menus, date pickers |

#### Loading/State

| Component | Use |
|---|---|
| `Skeleton` | Loading placeholders for all content |
| `Spinner` | Inline loading (button loading state) |
| `EmptyState` | Pages with no data yet |
| `ErrorState` | API failure states with retry |
| `ProgressIndicator` | Repository analysis progress |

#### Charts (Phase 3)

| Component | Use |
|---|---|
| `BarChart` | Skill scores by category |
| `RadarChart` | Role requirements vs. user scores |
| `FunnelChart` | Application pipeline stages |
| `AreaChart` | Career progress over time (future) |

---

## 7. Motion System

### 7.1 Principles

1. Motion communicates state change — not decoration
2. One orchestrated entrance per page load is enough
3. Hover transitions: 100–150ms ease-out
4. Page transitions: 220ms cubic-bezier(0.16, 1, 0.3, 1)
5. Modal enter: 200ms ease-out scale + opacity
6. Data entry (scores, graphs): 400ms ease-out with slight overshoot
7. All motion disabled when `prefers-reduced-motion: reduce`

### 7.2 Animation Tokens

| Animation | Duration | Easing | Use |
|---|---|---|---|
| `anim-instant` | 0ms | — | State change without animation |
| `anim-fast` | 100ms | ease-out | Hover states |
| `anim-base` | 150ms | ease-out | Focus, active states |
| `anim-enter` | 220ms | cubic-bezier(0.16, 1, 0.3, 1) | Page content, card reveal |
| `anim-modal` | 200ms | ease-out | Dialog/sheet open |
| `anim-data` | 400ms | ease-out | Score bars, progress bars |
| `anim-pulse` | 1600ms | ease-in-out | Skeleton loading |
| `anim-shimmer` | 2400ms | ease-in-out | CTA button shimmer |

### 7.3 Three.js / WebGL Motion

Separated from CSS animations. WebGL scenes:
- Must initialize with a fade-in (opacity 0 → 1 over 500ms)
- Must handle visibility changes (pause when tab not focused)
- Must handle resize (debounced rerender)
- Must clean up on unmount (disposar all geometries/materials)
- Must fall back gracefully when WebGL is unavailable

---

## 8. Iconography

### 8.1 Current State

NEXUS currently uses 15 custom inline SVG icons (defined in `Icons.tsx`). This is sufficient for Phase 1 but insufficient for a full redesign.

### 8.2 Recommendation: Lucide React

**Adopt Lucide React** as the primary icon library for Phase 3+.

Rationale:
- Consistent 24×24 stroke-based icons
- 1500+ icons covering all needed use cases
- Current 15 custom icons can be replaced with Lucide equivalents
- `currentColor` by default — works with Gold Signal semantic colors
- Used as the default in shadcn/ui

**Icon usage rules:**
- Never mix Lucide with other icon families
- Size with `h-4 w-4` (16px) for nav items, `h-5 w-5` (20px) for page headers
- Always `aria-hidden="true"` on decorative icons
- Always pair with text label or `aria-label` for icon-only buttons

### 8.3 Custom Icons to Keep

| Custom Icon | Lucide Equivalent | Decision |
|---|---|---|
| `IconNexus` (geometric N) | None — brand mark | Keep as custom SVG |
| `IconDashboard` | `LayoutDashboard` | Replace with Lucide |
| `IconBriefcase` | `Briefcase` | Replace with Lucide |
| `IconClipboard` | `ClipboardList` | Replace with Lucide |
| `IconTrendingUp` | `TrendingUp` | Replace with Lucide |
| `IconChat` | `MessageSquare` | Replace with Lucide |
| `IconStar` | `Star` or `Sparkles` | Replace with Lucide |
| `IconDocument` | `FileText` | Replace with Lucide |
| `IconCode` | `Code2` | Replace with Lucide |
| `IconTarget` | `Target` | Replace with Lucide |
| `IconSliders` | `SlidersHorizontal` | Replace with Lucide |
| `IconGear` | `Settings` | Replace with Lucide |
| `IconMenu` | `Menu` | Replace with Lucide |
| `IconClose` | `X` | Replace with Lucide |
| `IconChevronRight` | `ChevronRight` | Replace with Lucide |

---

## 9. Accessibility Requirements

### Mandatory Standards

| Requirement | Standard | Notes |
|---|---|---|
| Color contrast | WCAG 2.1 AA (4.5:1 body, 3:1 large) | Gold on Midnight Black must pass |
| Keyboard navigation | All interactive elements reachable by Tab | Existing skip-to-main link preserved |
| Focus visibility | Visible focus ring on all interactive elements | Existing `focus-visible:ring-2 ring-indigo-700` preserved |
| Reduced motion | All animations disabled via `prefers-reduced-motion` | Existing global rule preserved |
| Screen reader support | Semantic HTML + ARIA labels | All icons with `aria-hidden`, buttons with `aria-label` |
| Touch targets | Minimum 44×44px on mobile | Nav items, buttons must meet this |
| Form labels | All inputs labeled (via `<label>` or `aria-label`) | Required for screen reader users |
| Dialog focus trap | Focus contained within open dialogs | Existing mobile drawer implements this |
| Heading hierarchy | No skipped heading levels (h1 → h2 → h3) | Enforce in page templates |

### Gold Signal Contrast Verification (Provisional)

| Foreground | Background | Ratio | Passes AA? |
|---|---|---|---|
| Warm White (#F5F3EF) | Midnight Black (#08090B) | ~18:1 | ✓ |
| Vibrant Gold (#F6C900) | Midnight Black (#08090B) | ~11:1 | ✓ |
| Midnight Black on Gold | Vibrant Gold (#F6C900) | ~11:1 | ✓ |
| Secondary text (~#8E9090) | Midnight Black (#08090B) | ~5:1 | ✓ (AA) |
| Muted text (~#6B6F75) | Midnight Black (#08090B) | ~3.5:1 | ✓ (large text only) |

**Note:** Muted text color passes only for large text (18px+). Do not use it for body text at small sizes.

---

## 10. Responsive Design Strategy

### 10.1 Breakpoint Behavior

| Component | Mobile (<768px) | Tablet (768–1024px) | Desktop (1024px+) |
|---|---|---|---|
| Sidebar | Hidden, drawer | Hidden, drawer | Fixed 256px or 56px collapsed |
| Job Discovery | Search → filter sheet → list | Filter sidebar 200px + list | Filter sidebar 240px + list + detail panel |
| Skill Overview | Single column stacked | Two-column grid | Three-column grid |
| Application Tracker | Card list | Compact table | Full table with all columns |
| Gap Analysis | Stacked skill list | Side-by-side | Side-by-side with explanation panel |
| Copilot | Full-width chat | Full-width chat | 2/3 chat + 1/3 prompts/actions |
| Dashboard | Single column cards | Two-column cards | Two-column with side panel |
| Hero (landing) | Static constellation, 100vh | Static or reduced Three.js | Full Three.js, 100vh |
| Landing sections | Single column | Single/Two column | Two/Three column |

### 10.2 Mobile-First Principles

1. Touch targets minimum 44px height for all interactive elements
2. Bottom sheet pattern for filters and secondary actions (shadcn Drawer)
3. Swipe-to-dismiss not required but beneficial for drawers
4. Font sizes scale up at mobile to maintain readability (1rem min body)
5. No hover-dependent interactions — all hover reveals must have tap equivalent

---

## 11. Dark Mode Notes

The current design is dark-only. For Phase 4 consideration:

**If light mode is added:**
- Background: Off-white `#FAFAF9` → Card surface `#FFFFFF`
- Text: Near-black `#0F1012` → Muted `#6B7280`
- Gold accent: Darken to `#C49600` for sufficient contrast on white backgrounds
- Borders: Light gray `#E5E7EB`
- Keep the Gold Signal brand identity — the gold accent still works on light backgrounds

**Recommendation:** Dark mode is a differentiator for NEXUS. It reinforces the "technical product for developers" positioning. Implement light mode only if explicitly requested.
