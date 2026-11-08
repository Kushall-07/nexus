# NEXUS Phase 3 — Route and Page Inventory
**Date:** 2026-11-07  
**Status:** Based on actual App.tsx and feature files. No assumptions.

---

## Route Map

```
/                   → LandingPage (public, Phase 2)
/dashboard          → DashboardPage       (AuthGate protected)
/skills             → SkillOverviewPage   (AuthGate protected)
/skills/:skillId    → SkillDetailPage     (AuthGate protected)
/repositories       → RepositoriesPage   (AuthGate protected)
/roles              → RolesPage           (AuthGate protected)
/opportunities      → OpportunitiesRoute  (AuthGate protected)
/applications       → ApplicationsPage   (AuthGate protected)
/resume             → ResumePage          (AuthGate protected)
/development        → DevelopmentPage     (AuthGate protected)
/copilot            → CopilotPage         (AuthGate protected)
/preferences        → PreferencesPage    (AuthGate protected)
/settings           → SettingsPage        (AuthGate protected)
*                   → NotFound (404)
```

Redirect: `/*` unauthenticated → `/` (via AuthGate)  
Redirect: authenticated user at `/*` → `/skills` (legacy root redirect)

---

## 1. Landing Page — `/`

| Field | Value |
|---|---|
| Component | `apps/web/src/pages/landing/LandingPage.tsx` |
| Auth | Public (no AuthGate) |
| Phase | 2 (complete, do not redesign) |
| API dependencies | None |
| Layout | Full-screen, no sidebar |

**Sections:** Nav header, Three.js hero, product positioning, 4-step workflow, GitHub evidence, skill intelligence, CTA, footer.

---

## 2. Dashboard — `/dashboard`

| Field | Value |
|---|---|
| Component | `apps/web/src/features/career/DashboardPage.tsx` |
| Auth | Required |
| Layout | Shared authenticated shell, max-w-5xl |

**API dependencies:**
- `GET /api/career/profile` → `CareerProfileResponse`
- `GET /api/opportunities?limit=10` → `OpportunitySearchResponse`
- `GET /api/career/transition?direction=...` → `TransitionAnalysis` (conditional on direction)

**Current functionality:**
- Profile status card (GitHub analysis, resume, direction, preferences — each with status dot + action link)
- RefreshPanel (trigger full evidence re-analysis)
- Recommended opportunities grid (up to 4 job cards, "See all" link)
- Skill plan summary (nextAction highlight, ProgressSummary, GapList — first 3 gaps)
- Quick actions grid (4 items: opportunities, copilot, applications, repositories)

**Loading state:** `<LoadingState label="Loading your dashboard..." />`  
**Error state:** `<ErrorState error onRetry />`  
**Empty state:** Per-section — empty opportunities shows "No opportunities found" / "No provider configured"; skill plan shows "No career direction chosen"

**Tests:** `career.test.tsx` — smoke test, profile status renders

**Phase 3 redesign priorities:**
- More informative welcome header (user name from auth context)
- Better visual hierarchy — currently all sections have equal weight
- Skill plan summary needs visual differentiation from profile status
- Quick actions should feel like navigation shortcuts, not just links
- RefreshPanel is functional but visually not integrated with the page flow

---

## 3. Skills Overview — `/skills`

| Field | Value |
|---|---|
| Component | `apps/web/src/features/skills/SkillOverviewPage.tsx` → renders `SkillOverviewView.tsx` |
| Auth | Required |

**API dependencies:**
- `GET /api/skills` → Skill categories with individual skill scores

**Current functionality:**
- Trigger analysis button (POST `/api/analysis/run`)
- Skill categories (programming languages, frameworks, databases, testing, devops, AI/ML)
- Skill cards per category (name, score, ScoreMeter)
- Loading/error/empty states

**Phase 3 redesign:**
- Primary page for the "Skill Intelligence" section
- Group visualization could be improved with category headers, evidence counts
- Filter/sort capability needed (by score, by category)
- Link to skill detail from each card

---

## 4. Skill Detail — `/skills/:skillId`

| Field | Value |
|---|---|
| Component | `apps/web/src/features/skills/SkillDetailPage.tsx` → `SkillDetailView.tsx` |
| Auth | Required |

**API dependencies:**
- `GET /api/skills/:skillId` → Skill detail with per-repository contributions
- `GET /api/skills/:skillId/evidence` → Raw evidence items

**Current functionality:**
- Skill name, overall score, ScoreMeter
- Contributions by repository (ranked, with per-repo score)
- Raw evidence list (signal type, strength, explanation)
- Link back to skills overview

**Phase 3 redesign:**
- Evidence drill-down panel
- Repository links (via RepositoryLink component)
- Signal type badges (dependency / framework / sourceUsage / etc.)
- Breadcrumb: Skills > [Skill Name]

---

## 5. Repositories — `/repositories`

| Field | Value |
|---|---|
| Component | `apps/web/src/features/repositories/RepositoriesPage.tsx` → `RepositoriesView.tsx` |
| Auth | Required |

**API dependencies:**
- `GET /api/github/repositories` → User's GitHub repositories
- `POST /api/analysis/repositories/:id` → Analyze single repo

**Current functionality:**
- Repository list (name, language, fork indicator, stars)
- Analyze button per repo
- Analysis status per repo (analyzed/not analyzed/in-progress)
- Bulk analysis trigger

**Phase 3 redesign:**
- Better GitHub Evidence page design (see section 7 of this document for naming)
- Analysis status visualization (progress, last analyzed date)
- Language badges
- Link to skill detail from analyzed repo

---

## 6. Roles (Target Role & Gap Analysis) — `/roles`

| Field | Value |
|---|---|
| Component | `apps/web/src/features/roles/RolesPage.tsx` → `RolesView.tsx`, `GapResultView.tsx`, `ExplanationPanel.tsx` |
| Auth | Required |

**API dependencies:**
- `GET /api/roles` → Available roles for user (filtered by their skills)
- `GET /api/roles/:roleId` → Role detail + gap analysis
- `POST /api/roles/:roleId/explain` → LLM explanation of gaps (optional)
- `GET /api/gap-analysis/:roleId` → Detailed gap breakdown

**Current functionality:**
- Role selection list
- Selected role gap analysis (demonstrated vs required skills)
- GapResultView with matched/missing skills
- ExplanationPanel (LLM-powered, optional — degrades gracefully if LLM unavailable)

**Phase 3 redesign:**
- Role selection as dropdown or searchable list (not full page list)
- Side-by-side: demonstrated vs required
- Clear visual distinction: demonstrated / gap / unavailable-info
- Match percentage bar only if score data supports it

---

## 7. Opportunities (Job Discovery) — `/opportunities`

| Field | Value |
|---|---|
| Component | `apps/web/src/features/career/OpportunitiesRoute.tsx` → `OpportunitiesPage.tsx` |
| Auth | Required |

**API dependencies:**
- `GET /api/opportunities/providers` → Provider status (live / demo)
- `GET /api/opportunities?...` → Job search (filters: skills, direction, location, type, mode)
- `GET /api/opportunities/:jobId/match` → Match explanation (LLM-powered, optional)
- `PUT /api/saved-jobs/:jobId` / `DELETE /api/saved-jobs/:jobId` → Save/unsave

**Current functionality:**
- Provider status indicator (shows "demo" mode if no live key)
- Filter inputs (direction, location type, work mode)
- Job results list (JobCard from jobParts.tsx)
- Save/unsave action
- Match score (from API)

**Phase 3 redesign:**
- Split-view layout (list + detail panel) for desktop
- Filter panel (collapsible sidebar or popover)
- Job detail panel with full description
- Match explanation inline in detail panel
- Mobile: stacked, detail opens as overlay or separate view
- Loading skeleton cards during search

---

## 8. Applications — `/applications`

| Field | Value |
|---|---|
| Component | `apps/web/src/features/career/ApplicationsPage.tsx` |
| Auth | Required |

**API dependencies:**
- `GET /api/saved-jobs` → Saved jobs with status
- `PUT /api/saved-jobs/:jobId` → Update status/notes
- `DELETE /api/saved-jobs/:jobId` → Unsave

**Current functionality:**
- Saved jobs list with status (saved, applied, interviewed, offered, rejected)
- Status update capability
- Remove from saved

**Phase 3 redesign:**
- Table view (default) + optional board view
- Status filter (by pipeline stage)
- Notes field visibility
- Empty state (no saved jobs yet → link to Opportunities)

---

## 9. Resume — `/resume`

| Field | Value |
|---|---|
| Component | `apps/web/src/features/career/ResumePage.tsx` |
| Auth | Required |

**API dependencies:**
- `GET /api/resume` → Current resume content
- `POST /api/resume/extract` → Extract from file (binary upload)
- `PUT /api/resume` → Save resume
- `DELETE /api/resume` → Delete resume

**Current functionality:**
- Resume upload + text extraction (PDF/DOCX)
- Manual edit of extracted text
- Version history (version number + savedAt date)
- Delete resume

**Phase 3 redesign:**
- Clear empty state (no resume uploaded)
- Upload zone (drag/drop + file picker)
- Extract → preview → save flow
- Version badge

---

## 10. Development (Skill Plan) — `/development`

| Field | Value |
|---|---|
| Component | `apps/web/src/features/career/DevelopmentPage.tsx` |
| Auth | Required |

**API dependencies:**
- `GET /api/career/transition?direction=...` → Skill plan + gap list
- `PUT /api/career/direction` → Set career direction
- `PUT /api/career/tasks/:skillId` → Mark skill task complete

**Current functionality:**
- Career direction selector (from available directions/roles)
- Progress summary (ProgressSummary component)
- Gap list with per-skill tasks
- Mark task complete

**Phase 3 redesign:**
- Clearer direction selection UX
- Progress visualization (optional chart if supported)
- Gap items with priority ordering
- "Complete" action with optimistic UI update

---

## 11. Copilot — `/copilot`

| Field | Value |
|---|---|
| Component | `apps/web/src/features/career/CopilotPage.tsx` |
| Auth | Required |

**API dependencies:**
- `GET /api/copilot/prompts` → Available prompt suggestions
- `POST /api/copilot/message` → AI response (rate limited: 20/min)

**Current functionality:**
- Prompt suggestion list
- Message input
- AI response display
- Rate limit error handling
- Graceful degradation when LLM not configured

**Phase 3 redesign:**
- Chat-style UI (messages, response bubbles)
- Typing indicator (`nx-typing-dot` already in CSS)
- Prompt suggestion chips
- Clear "AI unavailable" state if LLM not configured
- No conversation persistence (not supported by API)

---

## 12. Preferences — `/preferences`

| Field | Value |
|---|---|
| Component | `apps/web/src/features/career/PreferencesPage.tsx` |
| Auth | Required |

**API dependencies:**
- `GET /api/career/profile` → Current preferences
- `PUT /api/career/preferences` → Update preferences

**Current functionality:**
- Employment type selection (full-time, part-time, contract, internship)
- Work mode selection (remote, hybrid, on-site)
- Location preferences
- Save preferences

**Phase 3 redesign:**
- Multi-select chips / toggle groups
- Inline save confirmation
- Clear empty state before first save

---

## 13. Settings — `/settings`

| Field | Value |
|---|---|
| Component | `apps/web/src/features/settings/SettingsPage.tsx` |
| Auth | Required |

**API dependencies:** None currently identified (settings may be client-side only)

**Current functionality (to be verified):** 
- Theme toggle (connects to `lib/theme.ts`)
- Likely GitHub account info display
- Session/sign-out action

**Phase 3 redesign:**
- Theme toggle as proper toggle or segmented control
- Account section (GitHub username, avatar, sign-out)
- Grouped settings sections

---

## Proposed Information Architecture for Phase 3

| Sidebar Group | Label | Routes | Nav Label |
|---|---|---|---|
| Workspace | — | /dashboard | Dashboard |
| Career Discovery | Career | /opportunities | Opportunities |
| Career Discovery | Career | /applications | Saved & Applied |
| Career Intelligence | Intelligence | /skills | Skill Intelligence |
| Career Intelligence | Intelligence | /skills/:id | (sub-route, no nav item) |
| Career Intelligence | Intelligence | /roles | Role & Gap Analysis |
| Career Intelligence | Intelligence | /development | Skill Plan |
| Career Intelligence | Intelligence | /repositories | GitHub Evidence |
| AI & Profile | Profile | /copilot | Career Copilot |
| AI & Profile | Profile | /resume | My Resume |
| AI & Profile | Profile | /preferences | Preferences |
| System | — | /settings | Settings |

**Note on /skills/:skillId:** This is a child route of /skills. It should not appear in the sidebar nav. Breadcrumbs should show: Skill Intelligence > [Skill Name].

**Note on route URLs:** No URL changes are proposed. All existing bookmarks/deep links remain valid.
