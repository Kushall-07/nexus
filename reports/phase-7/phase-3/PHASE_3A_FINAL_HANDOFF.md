# NEXUS Phase 3A — Final Handoff
**Date:** 2026-11-07  
**Status:** COMPLETE — Awaiting user approval before Phase 3B begins.

---

## Executive Summary

Phase 3A is a comprehensive audit and design blueprint for the complete redesign of the NEXUS authenticated application experience.

The audit covered every file in the repository: all 13 authenticated routes, 40+ API endpoints, the existing component system, the Gold Signal design system, 134 E2E tests, and all Phase 1 and Phase 2 prior reports.

**Nothing has been changed.** This is a planning document only.

The authenticated application is a functional, production-grade career intelligence platform with real data flowing through every page. Phase 3 is a polish and experience redesign — not a rebuild. The goal is to make the existing functionality feel like a cohesive, premium SaaS product rather than a collection of independent pages.

---

## Current State Summary

| Dimension | Current State | Phase 3 Target |
|---|---|---|
| Sidebar | Fixed w-56, no collapse | Collapsible (w-56 / w-14), tooltips |
| Nav active state | Hardcoded gold shadow (dark-only) | Token-based border (adapts to both themes) |
| Component library | 5 bespoke components | 38 purpose-built components |
| Command palette | None | Ctrl+K navigation palette |
| Job Discovery | List view, basic filters | Split-view (list + detail panel) |
| Applications | Basic list | Table with status management |
| Skill display | Cards with score meter | Category grid with ProgressBar + evidence counts |
| Gap Analysis | Gap list | Visual match/gap/unavailable distinction |
| Copilot | Basic chat | Proper chat UI with typing indicator |
| Toast system | None | useToast() + ToastProvider |
| Dialog system | None (inline alerts) | Shared Dialog component |
| Breadcrumbs | None | AppHeader + Breadcrumbs for sub-routes |
| Responsive | Works but not optimized | Purpose-built mobile layouts per page |
| TypeScript | Clean | Maintained clean throughout |
| E2E coverage | 134/134 passing | Maintained + extended for new interactions |

---

## Architecture Decisions

These decisions are based on the actual codebase and are ready for review:

### D1: No external UI library

**Rationale:** Tailwind v4 compatibility risk with shadcn/ui and Radix. The codebase is at a scale where project-local components are simpler and faster to build correctly than integrating a library that may need extensive patching.

**Alternative considered:** Install `@radix-ui/react-*` primitives selectively (no Tailwind dependency). This is viable but adds complexity for minimal gain.

### D2: No chart library

**Rationale:** The existing `ScoreMeter` component and the `nx-score-fill` CSS utility already handle skill score visualization correctly. The gap analysis and skill detail pages need bar visualizations — these are entirely achievable with CSS progress bars and Tailwind layout. No Chart.js, Recharts, or D3 needed.

**Exception:** If the user explicitly wants a skills radar chart or a job pipeline funnel, one lightweight library (Recharts) could be added in a later phase.

### D3: Command palette — navigation only

**Rationale:** Backend has no global search API. Building a command palette that navigates to routes + offers theme toggle requires zero API integration and delivers immediate value.

### D4: Token-based styling throughout

**Rationale:** The design system in `index.css` overrides Tailwind's semantic slot names. All new components must use `bg-white`, `text-indigo-700`, etc. — never raw oklch values. This ensures both themes work automatically without per-component light-mode patches.

### D5: Toast system added at app root

**Rationale:** Currently there is no feedback on async mutations (save job, delete resume, refresh analysis, save preferences). A `ToastProvider` + `useToast()` hook adds this cleanly without requiring prop-drilling or context pollution.

---

## What Phase 3 Will NOT Do

These are confirmed out-of-scope based on API capability analysis:

- Activity feed or notification bell (no backend support)
- Global cross-entity text search (no backend search API)
- Conversation history persistence in Copilot (stateless API)
- Resume templates or PDF export
- Public shareable profile
- Calendar or reminder integration
- Email notification settings
- Data export
- LLM streaming responses (not confirmed in backend)
- Fake match percentages or invented metrics
- Modification of frozen configs (scoring.json, roles.json, etc.)
- Backend changes of any kind

---

## Proposed Navigation Structure

The sidebar nav group labels change to reflect the product's career intelligence positioning:

| Current | Proposed | Routes |
|---|---|---|
| (ungrouped) | (ungrouped) | /dashboard |
| Career | Career | /opportunities, /applications |
| Profile | Intelligence | /skills, /roles, /development, /repositories |
| (ungrouped) | Copilot | /copilot |
| (ungrouped) | Profile | /resume, /preferences |
| (ungrouped) | (ungrouped) | /settings |

**Route URLs are unchanged.** No deep links break.

---

## Phase 3B Sequence (Approved Sequence)

1. **3B.1** — Application shell (sidebar with collapse, extract from App.tsx)
2. **3B.2** — Shared UI primitives (Badge, Card, Dialog, Toast, Tooltip, ProgressBar)
3. **3B.3** — Dashboard redesign
4. **3B.4** — Form/interaction primitives (Select, MultiSelect, SearchInput, FilterPopover, Tabs)
5. **3B.5** — Job Discovery split-view redesign
6. **3B.6** — Applications tracker redesign
7. **3B.7** — Career Intelligence pages (Skills, GitHub Evidence, Role & Gap Analysis)
8. **3B.8** — AI & Profile pages (Copilot, Resume, Preferences, Settings)
9. **3B.9** — Command palette + keyboard shortcuts
10. **3B.10** — QA, accessibility audit, final test run

---

## Git Status at Phase 3A Completion

```
Branch: main
Commit: cdf6867 — feat(web): finalize Phase 2 landing page
Status: Clean working tree
Ahead of origin: 1 commit (Phase 2 not yet pushed)
Changed files: 0
```

No application source code was modified during Phase 3A.

---

## Reports Produced

All reports in `reports/phase-7/phase-3/`:

| File | Contents |
|---|---|
| `PHASE_3_PROJECT_AUDIT.md` | Full codebase audit: structure, tech stack, design system, components |
| `PHASE_3_ROUTE_AND_PAGE_INVENTORY.md` | Every route: component, auth, APIs, states, Phase 3 notes |
| `PHASE_3_API_CAPABILITY_MATRIX.md` | Every proposed feature mapped to actual backend support |
| `PHASE_3_COMPONENT_ARCHITECTURE.md` | Full component plan: 38 components across 5 categories |
| `PHASE_3_DESIGN_SYSTEM_PLAN.md` | Token reference, button patterns, color guidelines |
| `PHASE_3_PAGE_DESIGN_SPECIFICATIONS.md` | Per-page layout, components, interactions, all states, mobile, A/C |
| `PHASE_3_IMPLEMENTATION_ROADMAP.md` | 10-phase build sequence with files and verification steps |
| `PHASE_3_RISKS_AND_DEPENDENCIES.md` | 10 risks + 7 decisions awaiting user input |
| `PHASE_3A_FINAL_HANDOFF.md` | This document |

---

## Approval Gate

**Phase 3B implementation cannot begin until the user explicitly approves this blueprint.**

To approve, the user should:
1. Review the reports above
2. Confirm or adjust the proposed navigation structure
3. Answer the 7 optional decisions in `PHASE_3_RISKS_AND_DEPENDENCIES.md` (D1–D7) if they have preferences
4. Reply with approval (e.g., "Approved — start Phase 3B")

After approval:
- Phase 3B.1 (shell foundation) begins immediately
- Each sub-phase is verified with `npm test` and `npx tsc -b --noEmit` before proceeding
- No commit or push until user requests it

---

## Questions for the User

Before Phase 3B begins, it would help to know:

1. **Nav group labels:** Keep "Career" and "Profile" group labels, or use the new "Intelligence" group for the skills/roles/repositories section?

2. **Applications default view:** Start with table view only, or build both table and Kanban board in Phase 3B?

3. **Skills visualization:** Category grid with progress bars (no chart library), or would you like a skills radar/bar chart?

4. **Phase 2 push timing:** Should Phase 2 be pushed to `origin/main` before Phase 3B starts, or will you push both together at the end?

5. **Any pages to prioritize?** If you want Job Discovery or Skill Intelligence before the shell polish, the sequence can be adjusted.

None of these are blockers for approval. The defaults from this plan are well-reasoned and can proceed without answers.
