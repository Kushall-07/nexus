# NEXUS Phase 3 — Risks and Dependencies
**Date:** 2026-11-07  
**Status:** Plan only. No code modified.

---

## Dependency Map

```
Phase 3B.1 (Shell)
  └── Phase 3B.2 (UI Primitives)
       ├── Phase 3B.3 (Dashboard)
       ├── Phase 3B.4 (Form Primitives)
       │    ├── Phase 3B.5 (Job Discovery)
       │    ├── Phase 3B.6 (Applications)
       │    └── Phase 3B.8 (AI & Profile)
       └── Phase 3B.7 (Career Intelligence)
            └── (no dependency on 3B.4)
Phase 3B.9 (Command Palette) depends only on 3B.1
Phase 3B.10 (QA) depends on all above
```

---

## Risk Register

### R1 — Active nav item light theme regression

**Category:** Design / CSS  
**Probability:** Medium  
**Impact:** Medium  

**Description:**  
The current active nav item uses `shadow-[inset_3px_0_0_oklch(81%_0.195_86)]` — a hardcoded dark-theme gold value. This renders incorrectly in light theme (gold border on cream background has insufficient contrast).

**Mitigation:**  
Phase 3B.1 replaces this with `border-l-2 border-indigo-700`. The `indigo-700` token automatically resolves to Deep Teal in light mode via the `[data-theme="light"]` override in index.css.

**Verification:** Run both themes in E2E desktop project; visually confirm active item border is gold (dark) and teal (light).

---

### R2 — Tailwind v4 incompatibility with potential dependencies

**Category:** Technical / Packages  
**Probability:** Low–Medium  
**Impact:** High  

**Description:**  
If Phase 3 adds any new npm packages (e.g., Radix UI, shadcn/ui, Headless UI), they may declare Tailwind v3 peer dependency requirements, breaking the `@theme` token system or causing conflicting PostCSS configs.

**Mitigation:**  
Phase 3 builds all UI patterns as project-local components. No new UI libraries are installed. Only packages without Tailwind peer dependencies (e.g., `cmdk` for command palette input utilities) may be considered — and only if thoroughly vetted.

**Recommendation:** Implement the command palette without `cmdk` using a native `<input>` with filtered list. This eliminates R2 entirely for the command palette.

---

### R3 — E2E test selector breakage

**Category:** Testing  
**Probability:** High  
**Impact:** Low (contained)  

**Description:**  
Phase 3 redesigns the sidebar, adds breadcrumbs, changes heading structure, and adds new interactive elements. Playwright tests that assert on specific text content, button labels, or CSS classes will fail.

**Mitigation:**  
After each sub-phase, run `npx playwright test` and update selectors. Use `data-testid` attributes where selectors are too fragile (e.g., command palette commands).

**Rule:** Never delete a failing E2E test. Always fix the assertion or add `data-testid`.

---

### R4 — Sidebar collapse state affecting page layout

**Category:** Technical / Layout  
**Probability:** Medium  
**Impact:** Medium  

**Description:**  
The main content area width depends on the sidebar width. When the sidebar collapses from w-56 to w-14, the content area widens. Pages with specific max-width constraints (max-w-5xl) will be unaffected, but split-view layouts (Opportunities) need to remain usable at both sidebar states.

**Mitigation:**  
The sidebar collapse state is managed in `AppShell` via React context. `SplitView` and other layout components can consume this context to adjust their own min/max widths if needed. At the typical 1024px viewport width, `w-56` sidebar + `max-w-5xl` content fits without truncation.

---

### R5 — LLM-conditional features confusing users

**Category:** UX  
**Probability:** Medium  
**Impact:** Medium  

**Description:**  
The LLM integration is optional. Features like gap explanation, match explanation, and copilot all depend on environment variables that are not set in all deployment contexts. A user who loads the app without LLM configured must not see broken UI or fake responses.

**Mitigation:**  
1. Every LLM-dependent feature has an explicit "unavailable" state that explains the situation.
2. The Copilot page shows an availability indicator at the top.
3. Match explanation and gap explanation show as "not available" if the API returns an error.
4. No feature pretends to have generated a response without actually calling the LLM.

**Implementation pattern:**
```typescript
// API returns a specific error code when LLM not configured
if (error.code === "LLM_NOT_CONFIGURED") {
  return <LlmUnavailableNotice />;
}
```

---

### R6 — SavedJob data model limitations

**Category:** Backend / Data  
**Probability:** Low  
**Impact:** Low  

**Description:**  
The `/api/saved-jobs` endpoint returns `applicationStatus` as a string enum. If the status enum values differ from what Phase 3 assumes (saved/applied/interviewed/offered/rejected), status badge rendering will be incorrect.

**Mitigation:**  
Before implementing the Applications page, read the actual `saved-job.model.ts` to verify enum values. Build the status badge mapping from verified values only.

---

### R7 — Command palette conflicting with browser shortcuts

**Category:** UX / Accessibility  
**Probability:** Low  
**Impact:** Low  

**Description:**  
`Ctrl+K` is used by some browsers (e.g., Firefox) for the address bar. The command palette should still work but may require the user to focus the page first.

**Mitigation:**  
Use `addEventListener("keydown", handler)` with `e.preventDefault()` only when the event is handled. Document the shortcut in the UI as "⌘K" / "Ctrl+K" with a small chip in the AppHeader.

---

### R8 — Phase 2 commit not pushed to origin

**Category:** Git / Deployment  
**Probability:** N/A — known state  
**Impact:** Informational  

**Description:**  
Commit `cdf6867` (Phase 2 final landing page) is local only. `origin/main` is 1 commit behind `main`.

**Current action:** None — waiting for user approval to push. Phase 3 builds on top of Phase 2. Phase 2 must be pushed before Phase 3 is committed.

**Resolution:** When user approves Phase 3B completion commit, push both Phase 2 and Phase 3 together, or push Phase 2 first and Phase 3 as a separate commit.

---

### R9 — TypeScript type coverage for API responses

**Category:** Code Quality / TypeScript  
**Probability:** Medium  
**Impact:** Medium  

**Description:**  
Some API responses may have more fields than the current `api/types.ts` and `api/career-types.ts` type definitions capture. New Phase 3 UI that accesses new fields (e.g., job description, repository language list) may need type additions.

**Mitigation:**  
When implementing each page, read the actual backend route handler and response shape. Add types to the web API type files as needed. Never use `any` to bypass missing types.

---

### R10 — Performance: large skills list

**Category:** Performance  
**Probability:** Low  
**Impact:** Low  

**Description:**  
If a user has evidence for 50+ skills, the Skill Intelligence grid may render a large list synchronously.

**Mitigation:**  
The grid uses CSS grid — rendering performance should be acceptable. If profiling reveals jank, virtualize the list with a simple windowing approach. Do not add heavy virtualization libraries preemptively.

---

## External Dependencies

| Dependency | Version | Phase 3 Usage | Notes |
|---|---|---|---|
| React | 19 | All components | No upgrade needed |
| TypeScript | ~5.6 | All files | No upgrade needed |
| Vite | 8 | Dev server + build | No upgrade needed |
| Tailwind CSS | 4 | All styling | No upgrade needed |
| React Router | 6 | Navigation, command palette routing | No upgrade needed |
| Three.js | — | Landing page ONLY | Do not expand usage into authenticated app |
| Vitest | — | Unit tests | No upgrade needed |
| Playwright | — | E2E tests | No upgrade needed |

**New packages being considered:**
None. All UI components built from scratch using project-local TypeScript + Tailwind.

---

## Decisions Required from User

The following items are design decisions that must be confirmed before or during Phase 3B implementation. They are not blockers for Phase 3A audit completion.

| # | Decision | Options | Recommendation |
|---|---|---|---|
| D1 | Sidebar collapse behavior | Persistent across page loads (localStorage) vs. reset on each session | Persist to localStorage |
| D2 | Command palette activation key | Ctrl/Cmd+K (Linear convention) vs. different shortcut | Ctrl/Cmd+K |
| D3 | Job detail panel on mobile | Full-screen overlay vs. bottom drawer vs. new route | Full-screen overlay (simpler, no route change) |
| D4 | Applications default view | Table vs. Kanban | Table (fully supported); Kanban as optional toggle |
| D5 | Skill visualization | Category grids only vs. optional bar chart | Category grids (no chart library needed) |
| D6 | "Skill Intelligence" nav label | "Skills" (current) vs. "Skill Intelligence" (new) | Keep "Skills" for brevity |
| D7 | Phase 2 push timing | Push Phase 2 before Phase 3 implementation vs. push both together | Push Phase 2 first, then Phase 3 |

These do not need to be answered before Phase 3A is approved. They should be resolved early in Phase 3B.

---

## Phase 3A STOP CONDITION

This report completes the Phase 3A audit and design blueprint.

**No application code has been modified.**  
**No packages have been installed.**  
**No commits have been made.**

The following reports are complete:
1. `PHASE_3_PROJECT_AUDIT.md` ✅
2. `PHASE_3_ROUTE_AND_PAGE_INVENTORY.md` ✅
3. `PHASE_3_API_CAPABILITY_MATRIX.md` ✅
4. `PHASE_3_COMPONENT_ARCHITECTURE.md` ✅
5. `PHASE_3_DESIGN_SYSTEM_PLAN.md` ✅
6. `PHASE_3_PAGE_DESIGN_SPECIFICATIONS.md` ✅
7. `PHASE_3_IMPLEMENTATION_ROADMAP.md` ✅
8. `PHASE_3_RISKS_AND_DEPENDENCIES.md` ✅
9. `PHASE_3A_FINAL_HANDOFF.md` → (created next)

**Awaiting user approval to begin Phase 3B implementation.**
