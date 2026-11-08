# NEXUS Phase 3 — Page Design Specifications
**Date:** 2026-11-07  
**Status:** Plan only. No code modified.

For every page: purpose, layout, components, interactions, all three states, mobile behavior, and acceptance criteria.

---

## Shell (All Authenticated Pages)

**Layout (desktop):**
```
┌─────────────────────────────────────────────────────────────┐
│ [Sidebar w-56 / w-14 collapsed]  [Main content area flex-1] │
│  NEXUS brand                      AppHeader                  │
│  ─────────────                    (breadcrumbs + actions)    │
│  Nav groups                                                  │
│  ─────────────                    <page content>             │
│  [Collapse toggle]                                          │
│  ─────────────                                              │
│  AccountMenu                                                 │
└─────────────────────────────────────────────────────────────┘
```

**Layout (mobile):**
```
┌──────────────────────────┐
│ [≡ NEXUS]      [actions] │  ← Sticky mobile header
│──────────────────────────│
│                          │
│  <page content>          │
│                          │
└──────────────────────────┘
   ↕ Drawer opens on [≡]
```

**Sidebar states:**
- Expanded: w-56, group labels + item labels visible
- Collapsed: w-14, icons only, tooltips on hover
- Mobile drawer: full-width overlay (w-64), always full labels

**Active nav item:** gold left border (dark) / teal left border (light) + tinted background

---

## 1. Dashboard — `/dashboard`

### Purpose
Single-screen career intelligence snapshot. Shows current state, recommended next action, top opportunities, and skill plan summary.

### Layout

```
PageHeader: "Dashboard" + user greeting ("Good morning, {username}")
─────────────────────────────────────────────────────
Section: Profile status (2-col grid on md+)
  [RefreshPanel card]      [ProfileSection card]
─────────────────────────────────────────────────────
Section: "Recommended opportunities"  [See all →]
  [JobCard] [JobCard] [JobCard] [JobCard]  (2-col grid on md+)
  → If no provider: provider notice + demo link
  → If empty: EmptyState with link to /opportunities
─────────────────────────────────────────────────────
Section: "Skill plan"  [Open plan →]
  → If no direction: EmptyState with links to /development and /copilot
  → If direction set: NextAction highlight + ProgressSummary + GapList (3 items)
─────────────────────────────────────────────────────
Section: "Quick actions"
  [Opportunities] [Copilot] [Applications] [Repositories]
  (2-col grid, primary CTA highlighted)
```

### Components
- `PageHeader` with user greeting (pull username from `useAuth()`)
- `Card` for profile status and refresh panel
- `StatusIndicator` dots (replace inline `StatusDot`)
- `JobCard` (existing, cleaned up)
- `EmptyState` variants
- `ProgressBar` for skill plan summary
- Quick action links as `Card` variant="interactive"

### Interactions
- Refresh evidence: POST /api/career/refresh → reload profile, jobs, plan
- Profile status links: each row links to its management page
- Job cards: navigates to /opportunities?job=:id (or opens detail inline)
- Quick actions: router navigation

### Loading state
Full-page `LoadingState` for profile; skeleton cards for jobs section.

### Error state
`ErrorState` with retry for profile load failure.

### Empty state
Per-section. New user (no analysis) sees: profile status showing all items as "not done" with action links. Quick actions visible from first visit.

### Mobile behavior
- Single column layout
- Quick actions: 1-col or 2-col depending on screen size
- Job cards: 1-col
- Profile status rows remain horizontal (label + link)

### Accessibility
- `h1` page title
- `h2` for each section
- `aria-label` for each section container
- Status dots: `aria-hidden="true"` with text label beside them (already present)

### Acceptance criteria
- [ ] Dashboard loads within 2s on dev
- [ ] User greeting shows GitHub username
- [ ] Profile status shows correct state for each row
- [ ] Up to 4 jobs shown; "See all" navigates to /opportunities
- [ ] Skill plan shows next action if direction set
- [ ] All EmptyStates provide navigation to relevant pages
- [ ] Refresh triggers analysis and reloads all data
- [ ] All interactions work in both light and dark themes

---

## 2. Skill Intelligence — `/skills`

### Purpose
Comprehensive view of demonstrated technical skills organized by category.

### Layout

```
PageHeader: "Skill Intelligence"  [Refresh analysis]
─────────────────────────────────────────────────────
Search + Filter bar: [🔍 Filter by name]  [Sort: Score ▼]
─────────────────────────────────────────────────────
Category: "Languages" (n skills)
  [SkillCard] [SkillCard] [SkillCard] [SkillCard]  (3-4 col grid)
─────────────────────────────────────────────────────
Category: "Frameworks" (n skills)
  [SkillCard] [SkillCard] ...
(repeat for all categories)
─────────────────────────────────────────────────────
  → If no analysis: EmptyState with "Analyze repositories" CTA
```

### SkillCard
- Skill name (semibold)
- Category badge (xs, colored)
- Score (mono, tabular)
- ProgressBar (using nx-score-fill)
- Evidence count (xs, muted)
- Clickable → `/skills/:skillId`

### Interactions
- Click skill card → navigate to `/skills/:skillId`
- Filter input → client-side filter of rendered skills (no API call)
- Sort dropdown → client-side sort by score / name
- Refresh → POST /api/analysis/run → reload GET /api/skills

### Loading state
Skeleton grid of SkillCard placeholders (3–4 per row).

### Error state
`ErrorState` with retry.

### Empty state (no analysis)
"No skills detected yet. Analyze your GitHub repositories to see your skill profile."  
CTA: "Analyze repositories" → /repositories

### Mobile
2-column grid on mobile.

### Accessibility
- Category headings use `h2`
- Each SkillCard is a `<button>` or `<a>`
- Filter input: labeled
- Sort: accessible select

### Acceptance criteria
- [ ] All skill categories from /api/skills are shown
- [ ] Scores match API response (no rounding beyond what API returns)
- [ ] Filter reduces visible skills in real-time
- [ ] Sort reorders within categories
- [ ] Clicking a skill navigates to /skills/:skillId
- [ ] Empty state shows for user with no analysis
- [ ] Refresh triggers scoring and reloads

---

## 3. Skill Detail — `/skills/:skillId`

### Purpose
Detailed view of one skill: how it was detected, which repos contributed, raw evidence.

### Layout

```
Breadcrumbs: Skill Intelligence > {Skill Name}
PageHeader: "{Skill Name}"  [Score: 87]  [back to Skills]
─────────────────────────────────────────────────────
Section: "Contributing repositories" (sorted by contribution)
  For each repo:
    [Repo name + link]  [Contribution bar]  [Score]
─────────────────────────────────────────────────────
Tabs: [Evidence Items]  [Raw data]  (or just one list)
  For each evidence:
    [Signal type badge] [Strength] [Explanation] [Repo link]
─────────────────────────────────────────────────────
  → If skill not found: 404 message + back link
```

### Components
- `Breadcrumbs`
- `PageHeader`
- `RepositoryLink` (existing)
- `ProgressBar` for contribution strength
- `Badge` for signal types (dependency, framework, sourceUsage, testing, etc.)
- `Tabs` (optional — may be unnecessary if evidence is short)
- `EvidenceRow`

### Interactions
- Repository links → open GitHub in new tab
- Back link → /skills
- Evidence rows: static (no drill-down needed)

### Loading state
Skeleton: score placeholder, 3 repo rows, 5 evidence rows.

### Error state
404-style message if skillId not found.

### Mobile
Single column, full-width rows. Score prominent at top.

### Acceptance criteria
- [ ] Breadcrumb shows "Skill Intelligence > {name}"
- [ ] Repository contributions match /api/skills/:skillId response
- [ ] Evidence items match /api/skills/:skillId/evidence response
- [ ] Signal type badges render correctly for all types
- [ ] Repository links open GitHub correctly
- [ ] Back navigation works

---

## 4. GitHub Evidence — `/repositories`

### Purpose
Show which GitHub repositories were analyzed and their analysis status. Enable re-analysis. Connect repository data to skill evidence.

### Layout

```
PageHeader: "GitHub Evidence"  [Analyze all]
─────────────────────────────────────────────
GitHub connection: [Connected as @username] or [Connect GitHub]
─────────────────────────────────────────────
Search: [🔍 Filter repositories]
Repository list:
  For each repo:
    [Repo name + link]  [Languages...]  [Status badge]  [Analyze →]
    └ Analyzed: "Analyzed on Nov 5" | Not analyzed: "Not analyzed" (amber)
─────────────────────────────────────────────
  → If no repos: "No repositories accessible"
```

### Components
- `PageHeader`
- `SearchInput` (client-side filter)
- Repository row with `RepositoryLink`, language `Badge`, status `Badge`, analyze `Button`
- `StatusIndicator` for analysis state

### Interactions
- Analyze button → POST /api/analysis/repositories/:id → update repo status
- Analyze all → trigger analysis for all unanalyzed repos (sequential or batch)
- Filter → client-side by name

### Loading state
Skeleton list (5 rows).

### Error state
`ErrorState` for list load failure.

### Empty state
"No repositories found on your GitHub account."

### Mobile
Single column, full-width rows. Language badges truncated.

### Acceptance criteria
- [ ] All accessible repositories listed
- [ ] Analysis status shown (analyzed / not analyzed / in-progress)
- [ ] Language badges display top 2–3 languages
- [ ] Analyze button triggers analysis and updates status
- [ ] Filter reduces visible repos

---

## 5. Role & Gap Analysis — `/roles`

### Purpose
Select a target role and see a detailed comparison between the user's demonstrated skills and the role's requirements.

### Layout

```
PageHeader: "Role & Gap Analysis"
─────────────────────────────────────────────
Role selector: [Dropdown: Select a role ▼]
  → Shows role name, brief description when selected
─────────────────────────────────────────────
(When role selected:)
Match overview: [Match: 72%]  [X matched]  [Y gaps]  [Z hard blockers]
─────────────────────────────────────────────
Section: "Matched skills" (emerald)
  [SkillRow + score + evidence count]
Section: "Skill gaps" (red/amber)
  [SkillRow + gap size + "insufficient evidence" label if applicable]
Section: "Hard blockers" (red, prominent)
  [Blocker items from frozen config]
─────────────────────────────────────────────
LLM Explanation panel (if LLM available):
  [Get AI explanation of gaps]  → shows ExplanationPanel
─────────────────────────────────────────────
```

### Critical distinction: "gap" vs "unavailable information"
Evidence absence ≠ skill absence. The API response includes a distinction between "gap" (evidence shows skill is weak) and "unavailable" (insufficient evidence to score). These must render with different visual treatments.

- Genuine gap: red/amber indicator + "Gap: X points"
- Unavailable info: slate indicator + "Insufficient evidence to evaluate"

### Components
- `Select` for role selection (using existing roles from /api/roles)
- `RoleCard` (brief role info when selected)
- `GapBar` for each skill row
- `Badge` variants for matched/gap/unavailable/hard-blocker
- `ExplanationPanel` (existing — keep)

### Interactions
- Role select → GET /api/roles/:roleId → render gap analysis
- "Get AI explanation" → POST /api/roles/:roleId/explain → show ExplanationPanel
- Skill rows: potentially linkable to /skills/:skillId

### Loading state
Loading spinner after role selection.

### Error state
"Could not load analysis for this role." + retry.

### Empty state (no role selected)
"Select a role above to see how your skills compare." + role selector.

### Mobile
Single column. Role selector full-width. GapBars stack vertically.

### Acceptance criteria
- [ ] All roles from /api/roles appear in selector
- [ ] Matched skills shown correctly with scores
- [ ] Genuine gaps distinguished visually from unavailable-info
- [ ] Hard blockers prominently displayed
- [ ] LLM explanation panel conditionally shown
- [ ] "AI unavailable" shown gracefully when LLM not configured
- [ ] Frozen role definitions not modifiable from UI

---

## 6. Job Discovery — `/opportunities`

### Purpose
Find relevant job opportunities matched to the user's evidence-based skill profile.

### Layout (desktop — split view)

```
┌─────────────────────────────────────────────────────────────────┐
│ PageHeader: "Job Discovery"                     [Provider badge] │
│─────────────────────────────────────────────────────────────────│
│ [🔍 Search...]  [Filters ▼ (n active)]                         │
│─────────────────────────────────────────────────────────────────│
│ [Results list w-80–96]  │  [Job detail panel flex-1]           │
│  ┌──────────────────┐   │  ┌─────────────────────────────────┐ │
│  │ JobCard selected │   │  │ Company + Title                 │ │
│  │ ─────────────── │   │  │ Location · Type · Mode · Match  │ │
│  │ JobCard         │   │  │ ─────────────────────────────── │ │
│  │ JobCard         │   │  │ Description                     │ │
│  │ JobCard         │   │  │ [Save] [Apply externally ↗]    │ │
│  └──────────────────┘   │  └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Layout (mobile)
Single column. Job list shown first. Selecting a job opens full-screen detail view (or bottom sheet).

### Filter panel
Collapsible (via `FilterPopover` or inline panel):
- Direction/role filter
- Location type (remote/hybrid/on-site)
- Employment type (full-time/part-time/contract)
- Clear all filters

### Job card (list item)
- Company name + job title
- Location + work mode (chips)
- Match score badge (emerald/amber based on score threshold)
- Salary if available
- Posted date (days ago)
- Saved indicator (bookmark icon)

### Job detail panel
- Company + title (prominent)
- Full metadata row (location, type, mode, salary, posted date)
- Match score + "Match explanation" (LLM-conditional collapse)
- Full job description (scrollable)
- Action buttons: [Save / Saved ✓] [Apply on {source} ↗]
- Provider badge (live / demo indicator)

### Interactions
- Select job → update detail panel (no page navigation)
- Save/unsave → PUT/DELETE /api/saved-jobs/:id → update icon state
- Filter change → GET /api/opportunities with new params
- Apply → open external URL in new tab
- Match explanation → GET /api/opportunities/:id/match (LLM-conditional)

### Loading state
Skeleton job cards in list; shimmer in detail panel.

### Error state
"Could not load opportunities." + retry.

### Empty state
"No opportunities match your current filters." + clear filters link.  
No provider: "Live job listings require a provider key on the server. [Explore demo listings →]"

### Mobile
Swipe or tap to open detail. Full-screen detail view with back button.

### Acceptance criteria
- [ ] Split view works on desktop (≥1024px)
- [ ] Mobile shows list → tap → full detail
- [ ] Filters update results without page reload
- [ ] Save/unsave is immediate with optimistic update
- [ ] Provider demo badge visible when in demo mode
- [ ] Match score from API displayed accurately
- [ ] No invented match percentages
- [ ] External apply link opens new tab

---

## 7. Saved & Applied — `/applications`

### Purpose
Manage saved jobs and track application status.

### Layout

```
PageHeader: "Saved & Applied"
─────────────────────────────────────────────────────────
Stats row: [Saved: n] [Applied: n] [In progress: n]
─────────────────────────────────────────────────────────
Filter bar: [Status: All ▼]  [🔍 Search by title/company]
─────────────────────────────────────────────────────────
Applications table:
  Company | Role | Status | Saved on | Notes | Actions
  ──────── ──────── ──────── ──────── ──────── ────────
  Acme    FE Dev  Applied  Nov 3     ...      [⋮ menu]
  ...
─────────────────────────────────────────────────────────
  → Empty: "No saved jobs yet"
```

### Status stages
`saved` → `applied` → `interviewed` → `offered` → `rejected`

Rendered as colored `Badge` per row.

### Row actions (via ⋮ dropdown or inline)
- Change status (Select dropdown)
- Edit notes (inline textarea)
- View job details (links to /opportunities?job=:id)
- Remove from saved

### Mobile
Card-stack layout (not table). One card per saved job, status badge, action menu.

### Acceptance criteria
- [ ] All saved jobs from /api/saved-jobs rendered
- [ ] Status update via PUT /api/saved-jobs/:id works
- [ ] Remove via DELETE /api/saved-jobs/:id works
- [ ] Stats row reflects actual counts
- [ ] Filter by status works (client-side)
- [ ] Empty state shown when no saved jobs

---

## 8. Skill Plan — `/development`

### Purpose
Choose a career direction and get a prioritized skill development plan.

### Layout

```
PageHeader: "Skill Plan"
─────────────────────────────────────────────────────
Direction selector: [Currently: Full-stack Engineer ▼]  [Change]
─────────────────────────────────────────────────────
Progress summary:
  [n skills to develop] [n completed] [n% progress]
  Overall progress bar
─────────────────────────────────────────────────────
Section: "Gaps to address" (sorted by priority)
  For each gap:
    [Skill name]  [Gap size]  [Suggested action]  [Mark complete ✓]
─────────────────────────────────────────────────────
  → If no direction: EmptyState with direction selector
```

### Interactions
- Change direction → `Select` → PUT /api/career/direction → reload plan
- Mark task complete → PUT /api/career/tasks/:skillId → update local state optimistically
- Each gap row: link to /skills/:skillId for context

### Loading state
Spinner after direction change.

### Empty state
"Choose a career direction to see your personalized skill development plan."

### Mobile
Single column. Progress bar full-width. Gap rows stack.

### Acceptance criteria
- [ ] Direction selector shows all available directions
- [ ] Plan loads after direction selection
- [ ] Progress summary reflects actual gaps vs completed
- [ ] Mark complete updates task state
- [ ] Gaps link to skill detail pages

---

## 9. Career Copilot — `/copilot`

### Purpose
AI-powered career guidance conversation interface. Single-turn (no persistence).

### Layout

```
PageHeader: "Career Copilot"
  [AI availability indicator: ● Available / ○ Unavailable]
─────────────────────────────────────────────────────
Suggested prompts (shown when no active conversation):
  [Prompt chip 1] [Prompt chip 2] [Prompt chip 3] [Prompt chip 4]
─────────────────────────────────────────────────────
Message area (scrollable):
  [AssistantMessage: intro / last response]
  [UserMessage: sent prompt]
  [TypingIndicator while loading]
─────────────────────────────────────────────────────
Message composer (sticky bottom):
  [Text area: "Ask about your career..."] [Send ↑]
─────────────────────────────────────────────────────
Disclaimer: "Single-turn conversation. History is not saved."
```

### Message components
- User message: right-aligned, `bg-indigo-100 text-indigo-900`
- Assistant message: left-aligned, `bg-white border border-slate-200`
- Typing indicator: 3 dots, using `.nx-typing-dot` animation
- Rate limit error: amber notice

### LLM unavailable state
When /api/copilot/prompts returns no prompts or /api/copilot/message returns a configuration error:  
"Career Copilot is not available. Contact your NEXUS administrator to configure an AI provider."

### Interactions
- Select prompt chip → populate composer, optionally auto-send
- Submit message → POST /api/copilot/message → show response
- Rate limit error → amber notice: "Rate limit reached. Please wait before sending another message."

### Mobile
Full-screen chat layout. Composer sticky at bottom. Prompts hidden when conversation active.

### Acceptance criteria
- [ ] Prompts from /api/copilot/prompts displayed as chips
- [ ] Message sent on submit
- [ ] Typing indicator shows while awaiting response
- [ ] Response displayed as assistant message
- [ ] Rate limit error handled gracefully
- [ ] LLM unavailable state shown clearly (no fake response)
- [ ] No conversation persistence fabricated

---

## 10. Resume — `/resume`

### Purpose
Upload, extract, and manage the user's resume for career profile completeness.

### Layout

```
PageHeader: "My Resume"
─────────────────────────────────────────────────────
(No resume state):
  Upload zone: "Drop PDF or DOCX here, or click to browse"
  [Upload file]
─────────────────────────────────────────────────────
(Resume uploaded):
  Metadata: Version {n} · Saved {date}
  [Resume content text area — read-only view]
  Actions: [Edit] [Delete resume]
─────────────────────────────────────────────────────
(Editing):
  [Editable text area]
  [Save] [Cancel]
```

### Interactions
- File drop / click upload → POST /api/resume/extract → show extracted text
- Edit → enable textarea
- Save → PUT /api/resume → show success toast
- Delete → confirm dialog → DELETE /api/resume → return to empty state

### Loading state
Spinner during extract and save operations.

### Empty state
Upload zone with guidance.

### Mobile
Full-width text area. File upload button (no drag-drop on mobile — just file picker).

### Acceptance criteria
- [ ] File upload and extraction work
- [ ] Extracted text shown in view-only state
- [ ] Edit mode enables text changes
- [ ] Save persists changes via PUT /api/resume
- [ ] Delete removes resume with confirmation
- [ ] Version number and date shown

---

## 11. Preferences — `/preferences`

### Purpose
Set career work preferences (employment type, work mode, location).

### Layout

```
PageHeader: "Preferences"
─────────────────────────────────────────────────────
Section: "Employment type"
  [Toggle chip: Full-time] [Part-time] [Contract] [Internship]
Section: "Work mode"
  [Toggle chip: Remote] [Hybrid] [On-site]
Section: "Locations"
  [Text input + add tag chip]
─────────────────────────────────────────────────────
[Save preferences]
```

### Interactions
- Toggle chips → multi-select, local state
- Add location → type + Enter/button
- Remove location → × on chip
- Save → PUT /api/career/preferences → success toast

### Loading state
Spinner on save.

### Mobile
Full-width chip groups.

### Acceptance criteria
- [ ] Existing preferences pre-populated on load
- [ ] Multi-select chips work for all sections
- [ ] Save persists via PUT /api/career/preferences
- [ ] Success confirmed via toast

---

## 12. Settings — `/settings`

### Purpose
Manage account settings and application preferences.

### Layout

```
PageHeader: "Settings"
─────────────────────────────────────────────────────
Section: "Account"
  GitHub: [@username] [Avatar]
  [Sign out] [Switch GitHub account]
─────────────────────────────────────────────────────
Section: "Appearance"
  Theme: [Dark ●] [Light ○]  (or toggle switch)
─────────────────────────────────────────────────────
Section: "About"
  NEXUS version + environment info (non-sensitive)
```

### Interactions
- Theme toggle → `toggleTheme()` from lib/theme.ts → immediate visual update
- Sign out → POST /api/auth/logout → redirect to /
- Switch account → GET /api/auth/github?switch=1 → OAuth flow

### Mobile
Full-width sections.

### Acceptance criteria
- [ ] GitHub username displayed
- [ ] Theme toggle changes theme immediately
- [ ] Theme persists on page reload
- [ ] Sign out works and redirects
- [ ] Switch account initiates OAuth

---

## Command Palette (Global)

### Activation
`Ctrl+K` (Windows/Linux) / `Cmd+K` (macOS)

### Layout

```
[Overlay backdrop]
┌─────────────────────────────────┐
│ 🔍 Search commands...           │
│─────────────────────────────────│
│ Navigate to                     │
│  > Dashboard                    │
│  > Opportunities               │
│  > Skill Intelligence          │
│  > ...                          │
│─────────────────────────────────│
│ Actions                         │
│  > Toggle theme                 │
└─────────────────────────────────┘
```

### Commands
All navigation-only. No backend search.

### Keyboard
- ↑↓ to navigate
- Enter to execute
- Escape to close
- Type to filter

### Accessibility
- `role="dialog" aria-modal="true" aria-label="Command palette"`
- Focus trap while open
- Focus returned to trigger on close
- Each command item: `role="option"` within `role="listbox"`

### Mobile
Smaller modal (90vw, top-centered). Same keyboard behavior not needed; tap to execute.

### Acceptance criteria
- [ ] Opens on Ctrl+K / Cmd+K
- [ ] All 11+ navigation commands present
- [ ] Type filtering reduces visible commands
- [ ] Enter navigates to selected command
- [ ] Escape closes palette
- [ ] Focus restored on close
- [ ] Visible in both themes
