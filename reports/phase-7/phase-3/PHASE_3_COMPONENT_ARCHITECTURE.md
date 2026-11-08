# NEXUS Phase 3 — Component Architecture
**Date:** 2026-11-07  
**Status:** Plan only. No code modified.

---

## Principles

1. **Extend, don't replace.** Existing components (AccountMenu, Icons, ScoreMeter, StateViews, RepositoryLink) remain unless genuinely obsolete.
2. **Semantic tokens throughout.** All new components use `bg-white`, `text-slate-900`, `border-slate-200`, `text-indigo-700`, etc. Never hardcode oklch values in component files.
3. **No external component library installation.** The existing codebase has no shadcn/ui. Phase 3 will build the needed UI patterns as project-local components, using shadcn/ui's design patterns as reference architecture (not as an installed dependency). This avoids version conflicts with Tailwind v4.
4. **One implementation per pattern.** No competing Dialog implementations. No duplicate Select components. One shared component, used everywhere.
5. **Responsive by default.** Every new component must be designed for mobile and desktop simultaneously.
6. **Accessible by default.** Every interactive component needs keyboard navigation, focus management, and ARIA roles.

---

## Existing Components — Status

| Component | File | Phase 3 Status | Notes |
|---|---|---|---|
| AccountMenu | `components/AccountMenu.tsx` | **Restyled** | Needs avatar support; keep sign-out/switch |
| Icons | `components/Icons.tsx` | **Extend** | Add ~15 new icons for Phase 3 patterns |
| ScoreMeter | `components/ScoreMeter.tsx` | **Keep** | Used for skill scores |
| StateViews | `components/StateViews.tsx` | **Extend** | Add Skeleton variants, EmptyState variants |
| RepositoryLink | `components/RepositoryLink.tsx` | **Keep** | Used in evidence panels |
| SidebarNav | `App.tsx` (inline) | **Extract** | Move to `components/AppSidebar.tsx` |
| DesktopSidebar | `App.tsx` (inline) | **Extract + Enhance** | Collapsible, keyboard toggle |
| MobileDrawer | `App.tsx` (inline) | **Extract** | Move to `components/AppShell.tsx` |
| NexusBrand | `App.tsx` (inline) | **Extract** | Move to `components/NexusBrand.tsx` |

---

## New Components — Full List

### Shell Components

#### `AppShell` — `components/shell/AppShell.tsx`
Top-level authenticated layout wrapper. Replaces the inline shell in App.tsx.

**Props:** `children: React.ReactNode`

**Responsibilities:**
- Desktop sidebar (persistent, collapsible)
- Mobile header + drawer
- Skip-to-main link
- Provides `SidebarContext` (collapsed state)
- Keyboard shortcut: `[` or `\` to toggle sidebar (matches Linear)

**Desktop layout:**
```
[Sidebar: w-56 or w-14 collapsed] [Main content flex-1]
```

**Mobile layout:**
```
[Sticky header with hamburger]
[Drawer overlay on open]
[Main content full-width]
```

---

#### `AppSidebar` — `components/shell/AppSidebar.tsx`
Navigation sidebar.

**Props:** `collapsed: boolean`, `onToggle: () => void`

**Sections:**
1. Brand mark (NexusBrand — expands to full name, collapses to icon only)
2. Navigation (SidebarGroup + SidebarItem per route group)
3. Collapse toggle button (at bottom of nav area)
4. Account footer (AccountMenu)

**States:**
- Expanded: w-56, label visible
- Collapsed: w-14, icon only, tooltip on hover

**Accessibility:**
- `aria-label="Primary navigation"`
- Each nav item: `aria-current="page"` when active
- Collapse button: descriptive aria-label ("Collapse sidebar" / "Expand sidebar")
- Tooltips on collapsed items (via Tooltip component)

---

#### `SidebarGroup` — `components/shell/SidebarGroup.tsx`
Navigation group wrapper.

**Props:** `label?: string`, `children: React.ReactNode`, `collapsed?: boolean`

Renders group label (hidden when collapsed) + children.

---

#### `SidebarItem` — `components/shell/SidebarItem.tsx`
Individual navigation link.

**Props:** `to: string`, `icon: React.ReactNode`, `label: string`, `collapsed?: boolean`, `end?: boolean`

**Active state:**
- `bg-indigo-100 text-indigo-900` (token-based — adapts to light/dark)
- Left border: `border-l-2 border-indigo-700` (replaces current shadow hack)
- Icon: `text-indigo-700` when active, `text-slate-400` otherwise

---

#### `AppHeader` — `components/shell/AppHeader.tsx`
Top bar visible on all pages (above main content, below sidebar on mobile).

**Props:** `children?: React.ReactNode` (page-specific actions), `breadcrumbs?: BreadcrumbItem[]`

**Sections:**
- Left: Breadcrumbs or page title
- Right: CommandPaletteButton + (optional page actions) + ThemeToggle

**Responsive:** Full bar on desktop; simplified on mobile (title + action trigger)

---

#### `Breadcrumbs` — `components/shell/Breadcrumbs.tsx`
Page location indicator.

**Props:** `items: { label: string; to?: string }[]`

Renders: `Parent > Child` with links for all but the last item.

Usage: `Skills > React` on `/skills/react`.

---

### Layout Primitives

#### `PageContainer` — `components/layout/PageContainer.tsx`
Standard page wrapper.

**Props:** `children: React.ReactNode`

Applies consistent max-width, padding. Replaces the inline `max-w-5xl px-4 py-6 sm:px-6` pattern.

**Note:** Some pages (Opportunities split view) may need a wider container or no max-width cap. PageContainer should accept a `wide?: boolean` prop.

---

#### `PageHeader` — `components/layout/PageHeader.tsx`
Consistent page title + subtitle area.

**Props:** `title: string`, `subtitle?: string`, `actions?: React.ReactNode`

Renders: `h1 font-display` + optional subtitle + optional right-aligned actions.

---

#### `PageSection` — `components/layout/PageSection.tsx`
Section within a page.

**Props:** `label: string`, `children: React.ReactNode`, `action?: React.ReactNode`

Renders section heading + "See all" or similar action link.

---

#### `SplitView` — `components/layout/SplitView.tsx`
Two-panel split layout for Job Discovery.

**Props:** `list: React.ReactNode`, `detail: React.ReactNode`, `detailVisible: boolean`

**Desktop:** `[list flex-shrink-0 w-80 md:w-96] [detail flex-1]`, detail always visible  
**Mobile:** Only list shown by default; when job selected, navigate to detail overlay

---

### Data Display

#### `Card` — `components/ui/Card.tsx`
Reusable card surface. Replaces ad-hoc `rounded-xl border border-slate-200 bg-white` patterns.

**Props:** `children`, `className?`

Variants: `default`, `interactive` (hover effect), `highlighted` (indigo-tinted for primary actions)

---

#### `Badge` — `components/ui/Badge.tsx`
Status badge with semantic color variants.

**Props:** `variant: "default" | "success" | "warning" | "error" | "ai" | "info"`, `children`

Maps to: slate / emerald / amber / red / violet / sky color families.

---

#### `StatusIndicator` — `components/ui/StatusIndicator.tsx`
Dot indicator (replaces inline `StatusDot` in DashboardPage).

**Props:** `status: "ok" | "partial" | "none"`, `label?: string`

---

#### `DataTable` — `components/ui/DataTable.tsx`
Sortable, filterable table for Applications page.

**Props:** `columns: Column[]`, `data: T[]`, `onRowClick?: (row: T) => void`

Responsive: table on desktop, card-stack on mobile.

---

#### `ProgressBar` — `components/ui/ProgressBar.tsx`
Horizontal progress bar. Wraps the existing `nx-score-fill` CSS.

**Props:** `value: number` (0–100), `label?: string`, `size?: "sm" | "md"`

---

#### `Tooltip` — `components/ui/Tooltip.tsx`
Hover/focus tooltip.

**Props:** `content: React.ReactNode`, `children: React.ReactElement`

Required for collapsed sidebar items. Also useful for score explanations.

**Implementation:** CSS-based positioning with `role="tooltip"` and `aria-describedby`.

---

#### `EmptyState` variants — extension of `StateViews.tsx`

New variants:
- `EmptyState.Icon` — with large icon, title, description, optional CTA
- `EmptyState.Minimal` — compact, inline (for sub-sections)

---

### Form & Interaction

#### `Dialog` — `components/ui/Dialog.tsx`
Modal dialog with focus trap and Escape handling.

**Props:** `open: boolean`, `onClose: () => void`, `title: string`, `children`

Reuses the existing MobileDrawer focus-trap logic (extract into shared `useFocusTrap` hook).

---

#### `CommandPalette` — `components/ui/CommandPalette.tsx`
Global keyboard-activated command palette.

**Activation:** `Ctrl+K` (Windows/Linux) / `Cmd+K` (macOS)

**Commands (navigation only — no backend search):**
- Navigate to Dashboard
- Navigate to Opportunities
- Navigate to Saved & Applied
- Navigate to Skill Intelligence
- Navigate to Role & Gap Analysis
- Navigate to Skill Plan
- Navigate to GitHub Evidence
- Navigate to Career Copilot
- Navigate to My Resume
- Navigate to Preferences
- Navigate to Settings
- Toggle theme

**Interface:**
- Modal overlay
- Search input (filters commands by label)
- Keyboard navigation (↑↓ arrows, Enter to execute, Escape to close)
- Focus returned to trigger element on close
- No backend API calls

---

#### `Select` — `components/ui/Select.tsx`
Custom accessible select/dropdown.

**Props:** `value`, `onChange`, `options: { value, label }[]`, `placeholder?`, `disabled?`

Needed for: direction selection (Development page), role selection (Roles page), status update (Applications).

---

#### `MultiSelect` — `components/ui/MultiSelect.tsx`
Multi-value selection with toggle chips.

**Props:** `value: string[]`, `onChange`, `options`, `placeholder?`

Needed for: employment type, work mode, locations (Preferences page).

---

#### `SearchInput` — `components/ui/SearchInput.tsx`
Search input with clear button and debounced onChange.

**Props:** `value`, `onChange`, `placeholder?`, `debounceMs?: number` (default 300)

---

#### `FilterPopover` — `components/ui/FilterPopover.tsx`
Collapsible filter panel (popover on desktop, sheet on mobile).

**Props:** `children`, `label?: string`, `activeCount?: number`

Used in: Opportunities page, Applications page.

---

#### `Tabs` — `components/ui/Tabs.tsx`
Accessible tab navigation.

**Props:** `tabs: { id, label }[]`, `activeTab`, `onChange`

Used in: Skill detail (evidence / contributions tabs), possibly Applications (table / board).

---

#### `Toast` — `components/ui/Toast.tsx`
Brief notification for async feedback.

**Props:** `message: string`, `variant: "success" | "error" | "info"`  
**API:** `useToast()` hook + `ToastProvider` at app root

Needed for: save job, unsave job, resume save, evidence refresh complete, preferences saved.

---

### Domain-Specific Components

#### `JobCard` — extension of `features/career/jobParts.tsx`
Existing JobCard enhanced for split-view context.

**Props:** `item: OpportunityItem`, `selected?: boolean`, `onSelect?: () => void`

**States:** default, hover, selected (highlighted border)

---

#### `JobDetailPanel` — `features/career/JobDetailPanel.tsx`
Full job detail display for split-view right panel.

**Props:** `item: OpportunityItem`, `isSaved: boolean`, `onSave: () => void`, `onUnsave: () => void`

**Sections:** Company + title header, job metadata (location, type, mode, salary if present), description, match score + explanation (LLM-conditional), apply link.

---

#### `SkillCard` — `features/skills/SkillCard.tsx`
Skill in overview grid.

**Props:** `skill: SkillItem`, `onClick?: () => void`

Displays: skill name, category icon, score, ProgressBar, evidence count.

---

#### `EvidenceRow` — `features/skills/EvidenceRow.tsx`
Single evidence item in skill detail.

**Props:** `evidence: EvidenceItem`

Displays: signal type badge, strength, explanation, repository link.

---

#### `RoleCard` — `features/roles/RoleCard.tsx`
Role selector card.

**Props:** `role: RoleOption`, `selected: boolean`, `onSelect: () => void`

---

#### `GapBar` — `features/roles/GapBar.tsx`
Single skill gap visualization row.

**Props:** `skill: GapSkill`, `type: "matched" | "gap" | "unavailable"`

Renders different visual treatment for each type. "unavailable" must NOT look like a gap.

---

#### `CopilotMessage` — `features/career/CopilotMessage.tsx`
Chat message bubble.

**Props:** `role: "user" | "assistant"`, `content: string`, `timestamp?: Date`

Assistant messages use violet accent. User messages use slate.

---

## Component Directory Structure (Proposed)

```
apps/web/src/
├── components/
│   ├── shell/
│   │   ├── AppShell.tsx
│   │   ├── AppSidebar.tsx
│   │   ├── SidebarGroup.tsx
│   │   ├── SidebarItem.tsx
│   │   ├── AppHeader.tsx
│   │   ├── Breadcrumbs.tsx
│   │   └── NexusBrand.tsx
│   ├── layout/
│   │   ├── PageContainer.tsx
│   │   ├── PageHeader.tsx
│   │   ├── PageSection.tsx
│   │   └── SplitView.tsx
│   ├── ui/
│   │   ├── Badge.tsx
│   │   ├── Card.tsx
│   │   ├── CommandPalette.tsx
│   │   ├── DataTable.tsx
│   │   ├── Dialog.tsx
│   │   ├── FilterPopover.tsx
│   │   ├── MultiSelect.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── SearchInput.tsx
│   │   ├── Select.tsx
│   │   ├── StatusIndicator.tsx
│   │   ├── Tabs.tsx
│   │   ├── Toast.tsx
│   │   └── Tooltip.tsx
│   ├── AccountMenu.tsx       (existing — restyled)
│   ├── Icons.tsx             (existing — extended)
│   ├── RepositoryLink.tsx    (existing — keep)
│   ├── ScoreMeter.tsx        (existing — keep)
│   └── StateViews.tsx        (existing — extend)
│
├── hooks/
│   ├── useApiResource.ts     (existing — keep)
│   ├── useFocusTrap.ts       (new — extract from MobileDrawer)
│   ├── useCommandPalette.ts  (new — Cmd+K state)
│   └── useToast.ts           (new — toast queue management)
│
└── contexts/
    └── ToastContext.tsx       (new — provides useToast)
```

---

## Hooks to Extract / Create

| Hook | Purpose | Extracted from |
|---|---|---|
| `useFocusTrap(ref, active)` | Focus trap for dialogs and drawers | `MobileDrawer` in App.tsx |
| `useKeyboardShortcut(key, handler)` | Register global key listener | New |
| `useCommandPalette()` | Open/close state + commands | New |
| `useToast()` | Show/dismiss toast messages | New |

---

## Component Complexity Estimates

| Category | Count | Effort |
|---|---|---|
| Shell components | 7 | High (3B.1) |
| Layout primitives | 4 | Low (3B.1) |
| Data display | 7 | Medium (across 3B.2–3B.5) |
| Form & interaction | 8 | Medium–High (across 3B.1–3B.6) |
| Domain-specific | 8 | Medium (3B.3–3B.5) |
| Hooks | 4 | Low–Medium |
| **Total** | **38** | |

---

## Anti-Patterns to Avoid

- Do not create multiple Dialog implementations. One Dialog, used everywhere.
- Do not create inline focus-trap logic in multiple components. Extract `useFocusTrap`.
- Do not hardcode oklch values in component files. Use Tailwind semantic classes.
- Do not add `any` types unless genuinely unavoidable.
- Do not create generic "layout component" that is a thin wrapper around a div with no reuse value.
- Do not build components for hypothetical future pages. Only build what Phase 3 actually uses.
