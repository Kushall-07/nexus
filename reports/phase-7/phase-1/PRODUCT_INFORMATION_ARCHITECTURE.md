# NEXUS — Product Information Architecture
## Phase 7, Phase 1

**Date:** 2026-11-07

---

## 1. Navigation Structure

### 1.1 Proposed Navigation Hierarchy (Authenticated Application)

```
NEXUS
├── Overview
│   └── Dashboard (/dashboard)
│
├── Career Discovery
│   ├── Opportunities (/opportunities)
│   ├── Saved Jobs (/applications)
│   └── Development Plan (/development)
│
├── Career Intelligence
│   ├── Skill Overview (/)
│   ├── Skill Detail (/skills/:skillId)      ← nested, not in sidebar
│   ├── GitHub Evidence (/repositories)
│   └── Target Role & Gap Analysis (/roles)
│
├── Career AI
│   └── Career Copilot (/copilot)
│
└── Profile & Settings
    ├── Resume (/resume)
    ├── Preferences (/preferences)
    └── Settings (/settings)
```

**Changes from current structure:**
- Rename "Profile" group → split into "Career Intelligence" (GitHub/skills/roles) and "Profile & Settings"
- Move Development into "Career Discovery" group (it's about discovering what to work on, not about profile data)
- Group Copilot as its own section ("Career AI") — it's a distinct interaction mode

### 1.2 Navigation Labels

| Route | Current Label | Proposed Label | Rationale |
|---|---|---|---|
| `/dashboard` | Dashboard | Dashboard | No change |
| `/opportunities` | Opportunities | Opportunities | No change |
| `/applications` | Applications | Saved Jobs | Clearer for users who haven't applied yet |
| `/development` | Development | Development | No change |
| `/copilot` | Copilot | Career Copilot | More descriptive |
| `/` | Skills | Skill Profile | Distinguishes from an individual skill |
| `/repositories` | Repositories | GitHub Evidence | Communicates the product value clearly |
| `/roles` | Target role | Role & Gap Analysis | More descriptive of what the page does |
| `/resume` | Resume | Resume | No change |
| `/preferences` | Preferences | Preferences | No change |
| `/settings` | Settings | Settings | No change |

---

## 2. Public Landing Page Architecture

### 2.1 Section Structure

The landing page tells a single story: "Your GitHub repositories contain proof of your skills. NEXUS extracts that proof and connects it to the right career opportunities."

```
1. Navigation (glass header)
2. Hero (3D visualization + headline + primary CTA)
3. Product positioning ("The problem with job hunting")
4. How NEXUS works (3-step flow: Connect → Analyze → Discover)
5. GitHub evidence intelligence (what gets analyzed)
6. Skill intelligence (how skills are scored and visualized)
7. Role gap analysis (know exactly what you're missing)
8. Job discovery and matching (evidence-based job matching)
9. Career Copilot (AI-powered career guidance)
10. Trust and transparency
11. Final CTA
12. Footer
```

### 2.2 Section Specifications

#### Section 1: Navigation

**Purpose:** Wayfinding and authentication entry  
**Layout:** Fixed glass header (100% width, blurred background)  
**Elements:**
- Left: NEXUS geometric N logo + "NEXUS" in Barlow Condensed
- Center: Nothing (clean)
- Right: "Sign In" (subtle button) + "Get Started" (gold CTA)
- Mobile: Logo + hamburger → full-screen overlay menu

**UX notes:**
- Glass effect (`nx-glass`) over hero background
- Transitions to sticky on scroll with increased opacity
- No complex mega-menu — only "Sign In" and "Get Started" needed

---

#### Section 2: Hero

**Purpose:** First impression — communicate the product essence  
**Layout:** Full-viewport height, centered text over 3D background  
**Elements:**
- Background: Midnight Black with Three.js particle network (lazy-loaded)
- Particle system: Gold nodes representing repositories, skills, job opportunities
- Pointer interaction: Particles subtly attracted toward cursor
- Primary headline: "YOUR CODE TELLS A STORY" (Barlow Condensed, weight 900, ~6–8rem)
- Sub-headline: "NEXUS analyzes your GitHub repositories to surface your real career value" (Inter 400, ~1.25rem)
- Primary CTA: "Connect GitHub" (WebGL liquid-metal button or gold shimmer fallback)
- Secondary CTA: "See how it works ↓" (subtle ghost link)
- Scroll indicator: Animated chevron

**Mobile fallback:**
- Three.js replaced with static CSS gold constellation animation (existing `nx-node-pulse` system)
- Headline scales to ~3–4rem

**Performance constraints:**
- Three.js scene lazy-loaded behind React.lazy + Suspense
- WebGL unavailable → CSS gradient fallback

---

#### Section 3: Product Positioning

**Purpose:** Identify the problem NEXUS solves  
**Layout:** Two-column comparison (the problem vs. the NEXUS solution)  
**Elements:**
- Left column: "The old way" — resume keywords, keyword matching, unverified claims
- Right column: "NEXUS" — GitHub evidence, demonstrated skills, explainable matching
- Visual treatment: Problem column in muted gray tones, solution column highlighted with gold accents
- Transition: Animated reveal on scroll into view

**Copy direction:**
- "Keyword matching is guessing. NEXUS is evidence."
- "Your repositories contain the proof. We surface it."

---

#### Section 4: How NEXUS Works (3-step flow)

**Purpose:** Explain the product mechanics clearly  
**Layout:** Horizontal 3-step flow on desktop, vertical stack on mobile  
**Elements:**
Step 1 — Connect GitHub: Connect your GitHub account. NEXUS reads your public repositories.
Step 2 — Evidence Extracted: We analyze languages, frameworks, test coverage, project structure, and activity. No guessing.
Step 3 — Career Intelligence: Your evidence becomes a skill profile, role gap analysis, and job matches.

**Visual treatment:**
- Not numbered markers (01/02/03) unless presented as a genuinely sequential step — which this IS, so numbering is appropriate
- Connecting arrows or progress indicators between steps
- Icon per step: GitHub mark → analysis icon → career graph icon

---

#### Section 5: GitHub Evidence Intelligence

**Purpose:** Explain what NEXUS analyzes and how  
**Layout:** Split layout — explanation left, evidence breakdown visualization right  
**Elements:**
- Headline: "Evidence, not keywords"
- Explanation: Which signals NEXUS detects (dependencies, frameworks, test coverage, project structure, activity)
- Visualization: Animated skill signal breakdown showing a hypothetical repository analysis
- Detail: Show that NEXUS gives each signal a weight — this is transparent, not a black box

**Data displayed:**
- Signal types: Dependency detection, Framework identification, Source usage, Project structure, Testing, Documentation, Activity
- Example: "React detected as a dependency (0.2 weight) + used in source files (0.25 weight) + tested (0.1 weight) = 55% evidence score"

---

#### Section 6: Skill Intelligence

**Purpose:** Show what a skill profile looks like  
**Layout:** Full-width with a visual skill network or scored list  
**Elements:**
- Headline: "Your skills, scored by evidence"
- Skill grid or network: Show 10–15 skill names with score bars
- Score bar design: Gold gradient fill, numeric score in JetBrains Mono
- Color coding: Gold = strong evidence, Amber = partial, Gray = not analyzed

**Visual treatment:**
- Could use the gallery-heading technique here — "SKILL INTELLIGENCE" in large Barlow Condensed
- Surrounding tiles: Each shows a skill category (Frontend, Backend, Databases, etc.) with representative skills and their score levels

---

#### Section 7: Role Gap Analysis

**Purpose:** Show how NEXUS connects skills to career goals  
**Layout:** Split — target role on left, gap analysis visualization on right  
**Elements:**
- Headline: "Know exactly what you need to reach your goal"
- Role selector: Show one of the 5 available roles
- Gap visualization: Required skills vs. user's current evidence
- Color coding: Green = demonstrated, Amber = partial, Red = missing
- CTA: "Choose your target role →"

**Data:**
- Must represent the actual 5 roles from config/roles.json
- Must use the actual gap status types: demonstrated, partial, resume-claimed, missing

---

#### Section 8: Job Discovery and Matching

**Purpose:** Show the job search and matching experience  
**Layout:** Job card preview with match explanation visible  
**Elements:**
- Headline: "Jobs matched to your evidence, not just your resume"
- 3–4 job card previews (demo data, clearly labeled as illustrative)
- Match badge visible: strong/potential/stretch labels
- Match explanation preview: Show one skill component breakdown
- Filter sidebar preview (collapsed/simplified)

**Important:**
- Never show real job listings without user authentication
- Label demo cards clearly as "illustrative examples"
- Match scores must reflect realistic values based on actual scoring config

---

#### Section 9: Career Copilot

**Purpose:** Introduce the AI career assistant feature  
**Layout:** Chat interface preview  
**Elements:**
- Headline: "Your career copilot"
- Chat preview: 2–3 message exchange showing a realistic copilot interaction
- Example: User asks "What jobs match my React skills?" → Copilot returns job cards + match explanations
- Note: Copilot requires LLM provider configuration (shown in settings)

**Copy:**
- Emphasize: Copilot's answers are grounded in the user's actual GitHub evidence, not generic advice

---

#### Section 10: Trust and Transparency

**Purpose:** Address developer skepticism about data usage  
**Elements:**
- "Only reads public repositories" — GitHub public API, read-only scope
- "Evidence-based scoring" — deterministic algorithm, no ML black boxes
- "Open configuration" — scoring weights visible in product (config/scoring.json)
- "Free to use" — if accurate for the product's current state

**Visual treatment:**
- 3–4 trust items in a clean grid, icon + label + 1-sentence explanation
- NO fake testimonials, user counts, success rates, or funding references

---

#### Section 11: Final CTA

**Purpose:** Convert engaged visitors  
**Elements:**
- Headline: "Start with your GitHub. Everything else follows."
- Primary CTA: "Connect GitHub — it's free" (gold button)
- Subtext: "Public repositories only. We never store your code."

---

#### Section 12: Footer

**Elements:**
- NEXUS brand mark + tagline
- Links: GitHub (product's GitHub), Privacy policy (if exists)
- Copyright
- No complex multi-column footer — NEXUS is a product, not a company website

---

## 3. Authenticated Application Architecture

### 3.1 Application Shell

```
┌─────────────────────────────────────────────────────────────┐
│ SIDEBAR (256px / 56px collapsed)   │  MAIN CONTENT          │
│                                     │                        │
│ ┌─ NEXUS brand ─────────────────┐   │  ┌─ Breadcrumb ──────┐ │
│ │ N NEXUS                       │   │  │ Home / Page       │ │
│ │   Career Intelligence         │   │  └───────────────────┘ │
│ └───────────────────────────────┘   │                        │
│                                     │  Page title + actions  │
│ [Cmd+K to search...]               │                        │
│                                     │  Content area          │
│ OVERVIEW                            │  (max-w-5xl centered)  │
│ ○ Dashboard                         │                        │
│                                     │                        │
│ CAREER DISCOVERY                    │                        │
│ ○ Opportunities                     │                        │
│ ○ Saved Jobs                        │                        │
│ ○ Development                       │                        │
│                                     │                        │
│ CAREER INTELLIGENCE                 │                        │
│ ○ Skill Profile                     │                        │
│ ○ GitHub Evidence                   │                        │
│ ○ Role & Gap Analysis               │                        │
│                                     │                        │
│ CAREER AI                           │                        │
│ ○ Career Copilot                    │                        │
│                                     │                        │
│ PROFILE                             │                        │
│ ○ Resume                            │                        │
│ ○ Preferences                       │                        │
│                                     │                        │
│ ─────────────────────────────────── │                        │
│ [Avatar] Username                  ▼│                        │
│          Settings · Sign out        │                        │
└─────────────────────────────────────────────────────────────┘
```

**Sidebar behavior:**
- Default: Expanded (256px) on lg+ screens
- Collapse: Toggle button at sidebar top-right collapses to icon-only (56px)
- Mobile: Hidden; replaced by sticky header with hamburger → slide-in drawer
- Persistence: Collapse state persisted in localStorage

**Command palette (Cmd+K):**
- Triggers: Keyboard shortcut, clicking the search field in sidebar
- Actions: Navigate to any page, search jobs by keyword, switch target role, run analysis
- Implementation: shadcn `Command` component in `Dialog` wrapper

---

### 3.2 Page-Level UX Specifications

#### Dashboard (`/dashboard`)

**Purpose:** Career profile health overview and quick actions  
**Primary user goal:** Understand current analysis state and take next action  
**Main information:**
- Analysis date (last time GitHub analysis was run)
- Resume status (uploaded vs. not)
- Target role (selected or not)
- Career preferences (configured or not)
- Quick stats: Total skills scored, job matches available, open applications

**Key actions:**
- "Analyze Repositories" (if analysis is stale or missing)
- "Search Opportunities" (primary career action)
- "Ask Career Copilot" (AI-powered guidance)
- "View Development Plan" (if target role is selected)

**Data requirements:**
- `GET /api/career/profile` → all profile metadata
- `GET /api/skills` → total skill count + top 3 skills
- `GET /api/saved-jobs` → open application count

**Loading state:** Skeleton cards for each status panel  
**Empty state (new user):** Guided onboarding flow — "Start with your GitHub"  
**Error state:** Profile load failure with retry  
**Mobile:** Single column stack of status cards  
**Recommended layout:** 2-column on desktop (status left, quick actions right), 1-column on mobile

---

#### Opportunities (`/opportunities`)

**Purpose:** Discover jobs matched to your evidence  
**Primary user goal:** Find relevant job opportunities and save them  
**Main information:**
- Job cards with match quality, company, role, location, work mode
- Match explanation per job (expandable)
- Filter state summary ("Showing 23 results for 'React'")

**Key actions:**
- Keyword + location search (top of page)
- Filter by: work mode, employment type, experience level, job source
- Save job (PUT /api/saved-jobs/:jobId)
- View match explanation (GET /api/opportunities/:jobId/match)
- Apply externally (open job URL)

**Layout:** Filter sidebar (left, 240px) + search + results list + selected job detail panel
- Mobile: Search bar → filter sheet (bottom drawer) → full-screen list → back button for detail

**Data requirements:**
- `GET /api/opportunities?...` with filter params
- `GET /api/opportunities/:jobId/match` on job selection
- `PUT/DELETE /api/saved-jobs/:jobId` for save/unsave

**Loading state:** Skeleton cards (5–8 items)  
**Empty state:** "No jobs found" with filter reset CTA  
**Demo mode:** Clear "DEMO" banner when demo data is shown

---

#### Saved Jobs (`/applications`)

**Purpose:** Track all saved jobs and application progress  
**Primary user goal:** See where each application stands and update status  
**Main information:**
- Table of saved jobs: Company, Title, Status, Date, Notes
- Filter by status tab: All, Applied, Interviewing, Offer, Rejected

**Key actions:**
- Update status inline (StatusSelect in table row)
- Add/edit note (inline textarea)
- Remove saved job
- Filter by status tabs

**Layout:** Full-width table with sortable columns
- Mobile: Card-based list (table collapses to cards on small screens)

**Data requirements:**
- `GET /api/saved-jobs` → list of saved jobs
- `PUT /api/saved-jobs/:jobId` → update status/note
- `DELETE /api/saved-jobs/:jobId` → remove

**Empty state:** "No saved jobs yet" with link to Opportunities  
**Loading state:** Skeleton table rows

---

#### Development Plan (`/development`)

**Purpose:** Prioritized skill gap task list to reach career goal  
**Primary user goal:** Understand what to learn next and track progress  
**Main information:**
- Target role and overall readiness
- Progress bar (% of gaps addressed)
- Prioritized skill gap list with task statuses
- Each gap: skill name, current score, required score, priority, task status selector

**Key actions:**
- Update task status per skill gap
- Navigate to skill detail for more evidence
- Change target role (links to /roles)

**Data requirements:**
- `GET /api/career/transition` → transition plan with tasks
- `PUT /api/career/tasks/:skillId` → update task status
- `GET /api/career/profile` → career direction

**Empty state (no direction):** "Choose a target role to see your development plan"  
**Empty state (no gaps):** "You meet all requirements for [role]!"  
**Loading state:** Skeleton task list

---

#### Skill Profile (`/`)

**Purpose:** Overview of all detected skills with evidence scores  
**Primary user goal:** Understand current technical evidence breadth and depth  
**Main information:**
- Skills grouped by category (Frontend, Backend, Databases, etc.)
- Score per skill with colored meter (gold = strong, amber = partial)
- Analysis metadata (date, repository count, evidence count)

**Key actions:**
- Run analysis (`POST /api/analysis/run`) — recompute scores from existing evidence
- Click skill → navigate to Skill Detail
- Navigate to Repositories to add/remove analyzed repos

**Data requirements:**
- `GET /api/skills` → full skill taxonomy with scores
- `POST /api/analysis/run` → trigger re-scoring

**Empty state (no analysis):** "Run your first analysis to see skill scores"  
**Loading state:** Skeleton skill grid

---

#### Skill Detail (`/skills/:skillId`)

**Purpose:** Deep dive into a single skill's evidence  
**Primary user goal:** Understand why a skill has its current score  
**Main information:**
- Skill name, category, overall score
- Contributing repositories with per-repo evidence breakdown
- Signal types and their contributions
- Evidence items (dependency, framework, source usage, etc.)

**Key actions:**
- Navigate to contributing repository (RepositoryLink)
- Navigate back to Skill Profile
- Navigate to Role Gap Analysis

**Data requirements:**
- `GET /api/skills/:id` → skill detail with contributions
- `GET /api/skills/:id/evidence` → raw evidence items (optional detail mode)

**Empty state:** "No evidence found for this skill"

---

#### GitHub Evidence (`/repositories`)

**Purpose:** Manage which GitHub repositories are included in analysis  
**Primary user goal:** Select the right repositories and trigger analysis  
**Main information:**
- List of discovered repositories (name, language, stars, fork/archive status)
- Selection state (checked = included, unchecked = excluded)
- Analysis status per repo (analyzed, pending, not analyzed)
- GitHub API quota remaining

**Key actions:**
- Select/deselect repositories (max 15)
- Analyze individual repository (`POST /api/analysis/repositories/:id`)
- Re-discover repositories (refresh list from GitHub)
- Run scoring after analysis complete (`POST /api/analysis/run`)

**Data requirements:**
- `GET /api/github/repos` → repository list
- `GET /api/github/quota` → rate limit status
- `PATCH /api/github/repos/:id/selection` → toggle selection
- `POST /api/analysis/repositories/:id` → analyze one repo

**Empty state (no repos):** "No public repositories found on GitHub"  
**Analysis progress:** Per-repo progress indicators (pending → analyzing → complete)

---

#### Role & Gap Analysis (`/roles`)

**Purpose:** Select a target role and see the gap between current skills and requirements  
**Primary user goal:** Choose a career direction and understand the gaps  
**Main information:**
- 5 available roles with brief description
- Currently selected role
- For selected role: required skills vs. current scores
- Gap visualization: demonstrated / partial / missing per skill
- LLM-generated explanation (when available)

**Key actions:**
- Select/change target role
- Request gap explanation (LLM)
- Navigate to individual skills for more detail
- Navigate to Development Plan

**Data requirements:**
- `GET /api/roles` → role catalog
- `POST /api/gap-analysis` → compute gap for selected role
- `POST /api/gap-analysis/:id/explanation` → LLM explanation
- `GET /api/gap-analysis/:id` → retrieve stored result

**Empty state (no analysis):** "Run analysis to see gap against selected role"  
**LLM unavailable:** Show gap data without explanations, label clearly

---

#### Career Copilot (`/copilot`)

**Purpose:** AI-powered career guidance through natural language conversation  
**Primary user goal:** Get personalized career advice grounded in evidence  
**Main information:**
- Multi-turn conversation
- Rich response cards (job search results, match explanations, skill gaps)
- Suggested prompts on empty state

**Key actions:**
- Send message
- Click suggestion prompt
- Navigate from result cards to relevant pages (job → opportunities, skill → skills/:id)

**Layout:** Chat interface (not full-page immersive)
- 2/3 width message area on desktop
- Action area (suggested prompts, quick filters) on right
- Mobile: Full-width, prompts collapse above input

**Data requirements:**
- `GET /api/copilot/prompts` → suggested prompts
- `POST /api/copilot/message` → send/receive messages

**LLM unavailable state:** Show clear message that Copilot requires LLM configuration  
**Loading state:** Typing indicator (existing `nx-typing-dot`)

---

#### Resume (`/resume`)

**Purpose:** Manage resume profile for job matching  
**Primary user goal:** Upload and review extracted resume data  
**Main information:**
- Current resume status (file name, upload date)
- Extracted profile: name, title, experience, education, skills

**Key actions:**
- Upload resume file (PDF/DOCX/text)
- Review extracted data
- Edit/confirm extracted fields
- Delete resume

**Data requirements:**
- `GET /api/resume` → current resume profile
- `POST /api/resume/extract` → upload and extract
- `PUT /api/resume` → save confirmed profile
- `DELETE /api/resume` → delete

---

#### Preferences (`/preferences`)

**Purpose:** Set job search filters for opportunity matching  
**Primary user goal:** Configure what kinds of jobs to find  
**Main information:**
- Target experience level (entry/mid/senior/lead)
- Work mode preference (remote/hybrid/on-site)
- Target location
- Employment type (full-time/part-time/contract)
- Target salary range

**Data requirements:**
- `GET /api/career/profile` → current preferences
- `PUT /api/career/preferences` → update preferences

---

#### Settings (`/settings`)

**Purpose:** Account and application settings  
**Primary user goal:** Manage account, sign out  
**Key actions:**
- Sign out
- Delete account (with confirmation dialog)
- View connected GitHub account

---

## 4. User Journeys

### Journey 1: First-Time User Setup
```
Landing page → Sign In (GitHub OAuth) → Dashboard (new user state)
→ Dashboard prompts: "Connect GitHub" → Repositories page
→ Select repos → Analyze repositories → Run scoring
→ Skill Profile (scores visible) → Roles page
→ Select target role → Gap Analysis (gaps visible)
→ Development Plan (prioritized tasks)
→ Opportunities (jobs matched to evidence)
```

**Current support:** Fully supported by existing API  
**UX gap:** The onboarding flow is not guided — it requires users to discover the sequence themselves

---

### Journey 2: Job Discovery Session
```
Dashboard → "Search Opportunities" CTA → Opportunities page
→ Set filters (keywords, work mode, experience level)
→ Browse job cards → Click job → View match explanation
→ Save relevant job → Continue browsing
```

**Current support:** Fully supported  
**UX improvement opportunity:** Keyword suggestions based on user's top skills

---

### Journey 3: Career Progress Review
```
Dashboard → Skills (see scores) → Skill Detail (understand evidence)
→ Roles (view gap analysis) → Development (see task progress)
→ Update task statuses → Dashboard (updated profile completeness)
```

**Current support:** Fully supported

---

### Journey 4: Copilot Career Session
```
Dashboard → Copilot
→ Select suggested prompt "What jobs match my React skills?"
→ Copilot returns job cards
→ Click job card → navigates to Opportunities with job highlighted
→ Back to Copilot → Ask follow-up "What should I learn next?"
→ Copilot returns gap recommendations → Links to Development Plan
```

**Current support:** Requires LLM provider configuration

---

## 5. Missing Functionality (UI perspective)

| Missing Feature | Backend Support | Priority |
|---|---|---|
| Guided onboarding wizard | Partial (profile completeness API exists) | P1 |
| Command palette (Cmd+K) | Full (all navigation endpoints exist) | P1 |
| Global keyword search | No dedicated search endpoint | P2 |
| Notifications / status updates | No notification endpoint | P3 |
| Skill network graph visualization | Skill data supports it; no backend changes needed | P2 |
| Application funnel chart | Saved jobs data supports it | P3 |
| Career profile completion % | Career profile API has all fields needed | P2 |
| Compare roles side-by-side | 5 roles exist; no combined endpoint | P3 |
| "What changed since last analysis" diff | No history endpoint | P3 |

---

## 6. Interaction Model

### Primary Interaction Patterns

1. **Click-to-expand (Job cards, skill explanations)** — inline expansion within list view
2. **Tabbed sections (Gap analysis, skill categories)** — shadcn Tabs
3. **Slide-out detail panel (Job detail on wide screens)** — shadcn Sheet or Resizable
4. **Status update inline (Applications table)** — select dropdown in table row
5. **Progressive disclosure (Match explanations, evidence items)** — collapsed by default
6. **Command palette (Cmd+K)** — global modal with search input
7. **Drawer for mobile nav** — existing pattern, should be preserved

### Keyboard Navigation Requirements
- All nav items reachable by Tab
- Cmd+K triggers command palette from anywhere
- Escape closes all modals/drawers
- Arrow keys navigate within command palette results
- Enter/Space activates focused items
- Focus trapped in open modals (existing MobileDrawer already implements this)
