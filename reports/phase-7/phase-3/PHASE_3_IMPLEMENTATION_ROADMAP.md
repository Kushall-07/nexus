# NEXUS Phase 3 — Implementation Roadmap
**Date:** 2026-11-07  
**Status:** Plan only. Requires user approval before execution begins.

---

## Execution Principles

1. Each sub-phase must be fully functional before the next begins.
2. After each sub-phase, run `npm test` and `npx tsc -b --noEmit` and fix any failures.
3. No commit until user approval (Phase 3B completion or sub-phase checkpoints as directed).
4. All 134 existing E2E tests must continue passing throughout.
5. Test selector changes (asserting text content, button labels) are expected — update assertions, never delete tests.

---

## Phase 3B.1 — Application Shell Foundation

**Objective:** Replace the inline App.tsx shell with a polished, collapsible, accessible navigation shell. All pages should still render correctly afterward.

**Files to create:**
- `apps/web/src/components/shell/AppShell.tsx`
- `apps/web/src/components/shell/AppSidebar.tsx`
- `apps/web/src/components/shell/SidebarGroup.tsx`
- `apps/web/src/components/shell/SidebarItem.tsx`
- `apps/web/src/components/shell/AppHeader.tsx`
- `apps/web/src/components/shell/Breadcrumbs.tsx`
- `apps/web/src/components/shell/NexusBrand.tsx`
- `apps/web/src/components/layout/PageContainer.tsx`
- `apps/web/src/components/layout/PageHeader.tsx`
- `apps/web/src/components/layout/PageSection.tsx`
- `apps/web/src/hooks/useFocusTrap.ts` (extract from App.tsx MobileDrawer)
- `apps/web/src/hooks/useKeyboardShortcut.ts`

**Files to modify:**
- `apps/web/src/App.tsx` — replace inline shell with `<AppShell>`, preserve all routes
- Fix active nav item to use `border-l-2 border-indigo-700` instead of hardcoded shadow

**Shell features delivered:**
- Collapsible sidebar (expanded w-56 / collapsed w-14)
- Tooltips on collapsed sidebar items
- Keyboard shortcut `[` or `\` to toggle sidebar
- Mobile header + drawer (extracted from App.tsx)
- Skip-to-main preserved
- Both themes work correctly
- AppHeader with page title slot

**Verification:**
```bash
npm test                     # 134+ tests pass
npx tsc -b --noEmit          # 0 errors
npm run build                # Build succeeds
```

**E2E notes:** Sidebar smoke tests will need assertion updates (new aria-labels, new HTML structure). Do not delete them — update selectors.

---

## Phase 3B.2 — Shared UI Primitives

**Objective:** Build the reusable UI components needed by multiple pages.

**Files to create:**
- `apps/web/src/components/ui/Badge.tsx`
- `apps/web/src/components/ui/Card.tsx`
- `apps/web/src/components/ui/Dialog.tsx`
- `apps/web/src/components/ui/ProgressBar.tsx`
- `apps/web/src/components/ui/StatusIndicator.tsx`
- `apps/web/src/components/ui/Tooltip.tsx`
- `apps/web/src/components/ui/Toast.tsx`
- `apps/web/src/contexts/ToastContext.tsx`
- `apps/web/src/hooks/useToast.ts`

**Files to modify:**
- `apps/web/src/components/StateViews.tsx` — add EmptyState.Icon variant, add Skeleton component
- `apps/web/src/main.tsx` — wrap app in `ToastProvider`

**Features delivered:**
- Badge with semantic variants (success/warning/error/ai/info)
- Card with default/interactive/highlighted variants
- Dialog (modal with focus trap, Escape to close, portal)
- ProgressBar (wraps nx-score-fill logic from ScoreMeter)
- StatusIndicator (replaces inline StatusDot)
- Tooltip (hover/focus, used for collapsed sidebar items)
- Toast system (success/error/info, auto-dismiss)

**Verification:** Visual review in both themes. No TypeScript errors.

---

## Phase 3B.3 — Dashboard Redesign

**Objective:** Redesign DashboardPage to use new shell and components. Add user greeting.

**Files to modify:**
- `apps/web/src/features/career/DashboardPage.tsx`
  - Pull username from `useAuth()` context
  - Replace inline `StatusDot` with `StatusIndicator`
  - Replace inline `h1` with `PageHeader` component
  - Replace section headings with `PageSection` component
  - Add `PageContainer` wrapper
  - Add `useToast()` for refresh success feedback

**Expected outcome:**
- Dashboard feels like a coherent workspace overview
- User greeting personalizes the experience
- All existing data (profile, jobs, plan, quick actions) still displayed correctly
- Loading and empty states consistent with new patterns

**Verification:**
```bash
npm test                 # career.test.tsx still passes
```

---

## Phase 3B.4 — Form & Interaction Primitives

**Objective:** Build the form components needed by search, filters, and selection pages.

**Files to create:**
- `apps/web/src/components/ui/SearchInput.tsx`
- `apps/web/src/components/ui/Select.tsx`
- `apps/web/src/components/ui/MultiSelect.tsx`
- `apps/web/src/components/ui/FilterPopover.tsx`
- `apps/web/src/components/ui/Tabs.tsx`

**Verification:** Visual review. TypeScript clean. Focus management tested.

---

## Phase 3B.5 — Job Discovery Redesign

**Objective:** Redesign OpportunitiesRoute/OpportunitiesPage with split-view layout.

**Files to create:**
- `apps/web/src/components/layout/SplitView.tsx`
- `apps/web/src/features/career/JobDetailPanel.tsx`

**Files to modify:**
- `apps/web/src/features/career/OpportunitiesRoute.tsx`
- `apps/web/src/features/career/OpportunitiesPage.tsx`
- `apps/web/src/features/career/jobParts.tsx` (add `selected` prop to JobCard)

**Features delivered:**
- Desktop split view: list (w-80–96) + detail panel (flex-1)
- Mobile: list first, tap → full detail overlay
- Filter panel (direction, location, type, mode)
- Save/unsave with Toast feedback
- Provider badge (live/demo)
- Match score displayed
- Match explanation (LLM-conditional, collapsed by default)

**Verification:**
```bash
npm test                 # career.test.tsx opportunities tests pass
```

---

## Phase 3B.6 — Applications Tracker Redesign

**Objective:** Redesign ApplicationsPage with DataTable and status management.

**Files to create:**
- `apps/web/src/components/ui/DataTable.tsx`

**Files to modify:**
- `apps/web/src/features/career/ApplicationsPage.tsx`

**Features delivered:**
- DataTable with Company, Role, Status, Date, Actions columns
- Status update via Select dropdown per row
- Remove from saved with confirmation
- Status filter (client-side)
- Stats row (saved/applied/in-progress counts)
- Mobile card-stack layout

---

## Phase 3B.7 — Career Intelligence Pages Redesign

**Objective:** Redesign Skill Intelligence, GitHub Evidence, and Role & Gap Analysis.

### Skill Intelligence

**Files to modify:**
- `apps/web/src/features/skills/SkillOverviewPage.tsx`
- `apps/web/src/features/skills/SkillOverviewView.tsx`
- `apps/web/src/features/skills/SkillDetailPage.tsx`
- `apps/web/src/features/skills/SkillDetailView.tsx`

**Files to create:**
- `apps/web/src/features/skills/SkillCard.tsx`
- `apps/web/src/features/skills/EvidenceRow.tsx`

**Features:** Category grid, SkillCard with ProgressBar, skill detail with evidence list, Breadcrumbs.

### GitHub Evidence

**Files to modify:**
- `apps/web/src/features/repositories/RepositoriesPage.tsx`
- `apps/web/src/features/repositories/RepositoriesView.tsx`

**Features:** Repo list with analysis status, language badges, analyze button with toast feedback.

### Role & Gap Analysis

**Files to create:**
- `apps/web/src/features/roles/RoleCard.tsx`
- `apps/web/src/features/roles/GapBar.tsx`

**Files to modify:**
- `apps/web/src/features/roles/RolesPage.tsx`
- `apps/web/src/features/roles/RolesView.tsx`
- `apps/web/src/features/roles/GapResultView.tsx`

**Features:** Role selector dropdown, gap visualization, matched/gap/unavailable distinction, LLM explanation panel.

---

## Phase 3B.8 — AI & Profile Pages Redesign

### Career Copilot

**Files to create:**
- `apps/web/src/features/career/CopilotMessage.tsx`

**Files to modify:**
- `apps/web/src/features/career/CopilotPage.tsx`

**Features:** Chat-style UI, prompt chips, typing indicator (using nx-typing-dot), LLM unavailable state.

### Resume

**Files to modify:**
- `apps/web/src/features/career/ResumePage.tsx`

**Features:** Upload zone, extract flow, edit mode, delete with dialog confirmation.

### Preferences

**Files to modify:**
- `apps/web/src/features/career/PreferencesPage.tsx`

**Features:** MultiSelect chips for employment type/work mode, location tag input, save with toast.

### Settings

**Files to modify:**
- `apps/web/src/features/settings/SettingsPage.tsx`

**Features:** Theme toggle, account section, sign-out/switch-account actions.

---

## Phase 3B.9 — Command Palette & Global Interactions

**Objective:** Add command palette + global keyboard shortcuts.

**Files to create:**
- `apps/web/src/components/ui/CommandPalette.tsx`
- `apps/web/src/hooks/useCommandPalette.ts`

**Files to modify:**
- `apps/web/src/components/shell/AppShell.tsx` — register Ctrl/Cmd+K listener
- `apps/web/src/components/shell/AppHeader.tsx` — add CommandPaletteButton (shows shortcut hint)

**Features delivered:**
- Ctrl+K / Cmd+K activates palette
- 11+ navigation commands
- "Toggle theme" action command
- Search/filter commands by label
- Keyboard navigation (↑↓ / Enter / Escape)
- Accessible (aria-modal, focus trap, focus restore)

---

## Phase 3B.10 — Integration QA and Polish

**Objective:** Responsive QA, accessibility audit, theme QA, performance review.

**Tasks:**
1. Test all pages at 375px, 768px, 1024px, 1440px
2. Verify keyboard navigation throughout
3. Verify both themes on all pages
4. Run full E2E suite → fix any broken assertions
5. Run `npx tsc -b --noEmit` → 0 errors
6. Run `npm run build` → 0 warnings in output
7. Verify no console errors in production build preview
8. Check ARIA landmark roles on all pages
9. Verify focus rings visible in both themes
10. Verify reduced-motion behavior

**Deliverables:** All QA reports, final handoff report.

---

## Implementation Sequence Summary

| Phase | Focus | Estimated complexity | Dependencies |
|---|---|---|---|
| 3B.1 | App shell | High | None |
| 3B.2 | UI primitives | Medium | 3B.1 |
| 3B.3 | Dashboard | Low | 3B.1, 3B.2 |
| 3B.4 | Form primitives | Medium | 3B.2 |
| 3B.5 | Job Discovery | High | 3B.1, 3B.2, 3B.4 |
| 3B.6 | Applications | Medium | 3B.2, 3B.4 |
| 3B.7 | Career Intelligence | Medium | 3B.1, 3B.2 |
| 3B.8 | AI & Profile | Medium | 3B.2, 3B.4 |
| 3B.9 | Command Palette | Medium | 3B.1 |
| 3B.10 | QA & Polish | High | All above |

---

## Testing Strategy

### Unit / Component Tests (Vitest)
- Extend existing `career.test.tsx`, `skills.test.tsx`, `roles.test.tsx` for new component APIs
- Add tests for: CommandPalette keyboard nav, Dialog focus trap, Toast queue

### E2E Tests (Playwright)
- All existing 134 tests must continue passing (update selectors as needed)
- Add tests for: sidebar collapse/expand, command palette, job detail split view, save/unsave flow
- Do not add E2E tests that require real LLM responses

### Manual QA Checklist (3B.10)
- [ ] Desktop sidebar: expand, collapse, tooltips
- [ ] Mobile drawer: open, close, focus trap
- [ ] Command palette: open, navigate, execute, close
- [ ] Job discovery: filter, select job, save, unsave
- [ ] Applications: status update, remove
- [ ] Skill detail: breadcrumb, evidence tab
- [ ] Role analysis: select role, view gaps, unavailable info distinct from gaps
- [ ] Copilot: send message, rate limit error, unavailable state
- [ ] Resume: upload, extract, edit, save, delete
- [ ] Preferences: set, save, re-load
- [ ] Settings: theme toggle, sign out
- [ ] Dark theme: all pages
- [ ] Light theme: all pages
- [ ] Mobile (375px): all pages
- [ ] Keyboard-only navigation: all pages
