# NEXUS — Project Audit
## Phase 7, Phase 1: Existing Frontend and Backend Audit

**Date:** 2026-11-07  
**Audited by:** Claude Code (Phase 1 Discovery)  
**Status:** Read-only audit — no code modifications made

---

## 1. Repository Structure

```
nexus/
├── apps/
│   ├── web/                     # React 19 frontend (Vite 8, TypeScript, Tailwind CSS 4)
│   └── api/                     # Express 5 backend (TypeScript, MongoDB)
├── packages/
│   └── domain/                  # Shared scoring engine (@nexus/domain)
├── config/
│   ├── scoring.json             # FROZEN — skill scoring weights and thresholds
│   ├── roles.json               # FROZEN — 5 role definitions with requirements
│   ├── job-matching.json        # FROZEN — matching weights, aliases, prerequisites
│   ├── skills.json              # Skill taxonomy definitions
│   └── technologies.json        # Technology → skill ID mapping
├── docs/                        # Documentation
├── reports/
│   ├── phase-6d/                # Security hardening reports
│   └── phase-6e/                # Deployment readiness reports
├── scripts/                     # Utility scripts
├── .claude/skills/              # Project-level Claude Code skills
├── package.json                 # Monorepo root
├── skills-lock.json             # Installed skills manifest
└── tsconfig.json                # Root TypeScript config
```

---

## 2. Technology Stack

### Frontend (`apps/web`)
| Technology | Version | Role |
|---|---|---|
| React | 19.3.0 | UI library |
| React DOM | 19.3.0 | DOM rendering |
| React Router | 7.18.4 | Client-side routing |
| TypeScript | 7.0.2 | Type safety |
| Vite | 8.3.2 | Build tool and dev server |
| Tailwind CSS | 4.3.3 | Utility-first styling |
| @tailwindcss/vite | 4.3.3 | Tailwind Vite plugin |
| Vitest | 5.0.3 | Unit/integration testing |
| Playwright | 1.64.1 | End-to-end testing |
| @testing-library/react | 16.3.3 | Component testing |

**Key observations:**
- No UI component library (shadcn, MUI, Chakra) installed
- No state management library (Redux, Zustand, Jotai)
- No data fetching library (TanStack Query, SWR)
- Minimal dependency footprint by design
- React 19 (current stable as of audit)

### Backend (`apps/api`)
| Technology | Version | Role |
|---|---|---|
| Express | 5.2.1 | HTTP framework |
| TypeScript | 7.0.2 | Type safety |
| Mongoose | 9.10.4 | MongoDB ODM |
| jsonwebtoken | 9.0.3 | JWT session tokens |
| Zod | 4.6.5 | Schema validation |
| mammoth | 1.13.0 | DOCX parsing |
| pdf-parse | 2.4.5 | PDF parsing |
| fast-xml-parser | 5.11.2 | pom.xml parsing |
| smol-toml | 1.9.0 | pyproject.toml parsing |
| Vitest | 5.0.3 | Testing |

---

## 3. Route Inventory (Frontend)

All routes defined in `apps/web/src/App.tsx`:

| Route | Component | Purpose | Status |
|---|---|---|---|
| `/dashboard` | `DashboardPage` | Career profile overview, setup checklist | Working |
| `/` | `SkillOverviewPage` | All skills with scores by category | Working |
| `/skills/:skillId` | `SkillDetailPage` | Per-skill evidence breakdown | Working |
| `/repositories` | `RepositoriesPage` | GitHub repo selection and analysis | Working |
| `/roles` | `RolesPage` | Target role selection and gap analysis | Working |
| `/opportunities` | `OpportunitiesRoute` | Job discovery with filters | Working |
| `/applications` | `ApplicationsPage` | Saved jobs and application tracker | Working |
| `/development` | `DevelopmentPage` | Skill gap task plan with progress | Working |
| `/copilot` | `CopilotPage` | AI career copilot chat interface | Working |
| `/resume` | `ResumePage` | Resume upload, extraction, review | Working |
| `/preferences` | `PreferencesPage` | Career preferences (location, salary, type) | Working |
| `/settings` | `SettingsPage` | User settings | Working |
| `*` | `NotFound` | 404 fallback | Working |

**Current navigation structure** (from `NAV_GROUPS` in App.tsx):
- Standalone: Dashboard
- Group "Career": Opportunities, Applications, Development, Copilot
- Group "Profile": Skills, Resume, Repositories, Target role, Preferences
- Standalone: Settings

---

## 4. Frontend Component Inventory

### Core Components (`apps/web/src/components/`)

| Component | File | Purpose |
|---|---|---|
| Icons | `Icons.tsx` | 15 inline SVG icons — no external icon library |
| AccountMenu | `AccountMenu.tsx` | User profile dropdown (GitHub avatar, sign out) |
| StateViews | `StateViews.tsx` | LoadingState, SkeletonBlock, CardSkeleton, EmptyState, ErrorState |
| ScoreMeter | `ScoreMeter.tsx` | Evidence score bar (gold/amber/red gradient fill) |
| RepositoryLink | `RepositoryLink.tsx` | Safe GitHub URL renderer |

### Feature Components (`apps/web/src/features/`)

| Feature | Key Components |
|---|---|
| `career/` | DashboardPage, OpportunitiesPage, ApplicationsPage, DevelopmentPage, CopilotPage, PreferencesPage, ResumePage, jobParts.tsx (JobCard, MatchBadge, etc.) |
| `repositories/` | RepositoriesPage, RepositoriesView |
| `roles/` | RolesPage, RolesView, GapResultView, ExplanationPanel |
| `settings/` | SettingsPage |
| `skills/` | SkillOverviewPage, SkillDetailPage, SkillOverviewView, SkillDetailView |

### App Shell Components (`apps/web/src/App.tsx`)

| Component | Purpose |
|---|---|
| AppShell | Root layout with sidebar and routing |
| DesktopSidebar | Fixed-width 224px sidebar (lg+) |
| MobileHeader | Sticky header with hamburger (mobile) |
| MobileDrawer | Slide-in drawer navigation (mobile) |
| SidebarNav | Navigation link groups with active states |
| NexusBrand | NEXUS logo + tagline lockup |

### Auth (`apps/web/src/auth/`)
- `AuthContext.tsx` — GitHub OAuth state machine (loading/authenticated/unauthenticated/error)
- `AuthGate.tsx` — Protected route wrapper and landing page renderer

---

## 5. Existing Design System ("Gold Signal")

### Identity
The existing design system is named **"Gold Signal"** (documented in `apps/web/src/index.css`).

### Color Palette (Tailwind CSS 4, OKLCH color space)

| Token | OKLCH | Approximate Hex | Semantic Role |
|---|---|---|---|
| `slate-50` | `oklch(5.5% 0.009 265)` | `#08090B` | Page background (Midnight Black) |
| `white` | `oklch(8% 0.008 265)` | `#0F1012` | Card/surface background (lifted dark) |
| `slate-200` | `oklch(13% 0.007 265)` | `#1D1F22` | Borders (subtle) |
| `slate-400` | `oklch(32% 0.005 260)` | `#4A4D52` | Icons, placeholder text |
| `slate-500` | `oklch(46% 0.004 255)` | `#6B6F75` | Muted/helper text |
| `slate-600` | `oklch(60% 0.008 90)` | `#8E9090` | Secondary text (warm cast) |
| `slate-900` | `oklch(96% 0.012 90)` | `#F5F3EF` | Primary text (Warm White) |
| `indigo-700` | `oklch(81% 0.195 86)` | `#F6C900` | PRIMARY — Vibrant Gold |
| `emerald-500` | `oklch(61% 0.158 162)` | `~#2DB36A` | Success/demonstrated evidence |
| `amber-500` | `oklch(66% 0.178 65)` | `~#C98A1A` | Warning/partial evidence |
| `red-500` | `oklch(59% 0.210 26)` | `~#D94040` | Error/missing/blocked |
| `violet-500` | `oklch(59% 0.215 293)` | `~#8B6ED9` | AI/Copilot feature color |

**Note:** The semantic slot names (`slate-*`, `indigo-*`) are intentionally remapped. `indigo-700` is NOT indigo — it is Vibrant Gold. This reuse allows all components using `bg-indigo-700` or `text-indigo-700` to automatically use the brand color without per-component changes.

### Typography

| Font | Variable | Weights | Use |
|---|---|---|---|
| Barlow Condensed | `--font-display` | 700/800/900 | Hero, section headings, large metrics, brand name |
| Inter | `--font-body` | 400/500/600/700 | Body text, navigation, labels, buttons |
| JetBrains Mono | `--font-mono` | 400/500 | Scores, evidence IDs, code labels, technical data |

Loaded via Google Fonts CDN in `index.html`.

### Custom CSS Utilities

| Class | Purpose |
|---|---|
| `.font-display` | Barlow Condensed, weight 900, tight letter-spacing |
| `.font-mono` | JetBrains Mono |
| `.nx-score-fill` | Gold gradient bar fill for ScoreMeter |
| `.nx-panel` / `.nx-panel-success` / `.nx-panel-warning` / `.nx-panel-danger` | 3px left-border accent for data panels |
| `.nx-glass` | Dark translucent glass card surface |
| `.nx-gradient-text` | Gold gradient text fill |
| `.nx-cta-shimmer` | Shimmer sweep animation on CTA buttons |
| `.nx-node-pulse` | Pulsing glow animation for constellation nodes |
| `.nx-typing-dot` | Copilot typing indicator bounce animation |
| `.skeleton` | Skeleton loading pulse animation |
| `.skip-to-main` | Keyboard navigation skip link |
| `.landing-reveal` | Section fade-in animation for landing page |

### Animations
- `fade-in` (0.22s) — applied to all `main > *` on page load
- `skeleton-pulse` (1.6s) — loading placeholders
- `landing-reveal` (0.6s cubic-bezier(0.16, 1, 0.3, 1)) — landing page staggered reveals
- `shimmer` (2.4s) — CTA button shine
- `orbit-slow` — constellation node orbit
- `pulse-gold` (2.4s) — node glow pulse
- `line-draw` — SVG stroke draw animation
- `typing-dot` (1.4s) — copilot indicator

**All animations disabled when `prefers-reduced-motion: reduce` is set.**

### App Shell Layout
- Desktop sidebar: `w-56` (224px), fixed position, full viewport height
- Content area: `max-w-5xl` (80rem) centered, `px-4 py-6`
- Sidebar nav active state: gold left-inset border shadow + gold tinted background
- Background: Midnight Black with 3 radial gradient gold atmospheric glows

---

## 6. Existing Functionality Status

### Authentication
| Feature | Status |
|---|---|
| GitHub OAuth flow | Working |
| Session cookies (JWT) | Working |
| Session revocation | Working |
| `/api/auth/me` session restore | Working |
| Logout | Working |
| Account deletion | Working |

### GitHub Integration
| Feature | Status |
|---|---|
| Repository discovery (up to 300) | Working |
| Repository selection (max 15) | Working |
| Per-repository deep analysis | Working |
| Language/dependency/framework detection | Working |
| Activity/testing/documentation signals | Working |
| GitHub API quota display | Working |

### Skill Intelligence
| Feature | Status |
|---|---|
| Evidence extraction (Phase 4) | Working |
| Skill scoring engine (Phase 5) | Working |
| Skill overview with categories | Working |
| Per-skill detail with evidence breakdown | Working |
| Scoring config frozen | Working |

### Role and Gap Analysis
| Feature | Status |
|---|---|
| 5 role definitions (config/roles.json) | Working |
| Gap analysis computation | Working |
| Per-gap LLM explanations | Working (requires LLM provider) |
| Development task tracking | Working |
| Priority gap ordering | Working |

### Job Discovery
| Feature | Status |
|---|---|
| Multi-provider job search | Working (requires API keys) |
| Demo fixtures fallback | Working |
| Keyword/location/mode/type filtering | Working |
| Match scoring per job | Working |
| Match label (strong/potential/stretch/blocked) | Working |
| Match component explanations | Working |

### Career Profile
| Feature | Status |
|---|---|
| Career preferences storage | Working |
| Resume upload (PDF/DOCX/text) | Working |
| Resume parsing via LLM | Working (requires LLM provider) |
| Career direction selection | Working |
| Learning task tracking | Working |
| GitHub profile refresh | Working |

### AI Copilot
| Feature | Status |
|---|---|
| Multi-turn chat interface | Working |
| Suggested prompts | Working |
| Job search via chat | Working (requires LLM provider) |
| Match explanations via chat | Working (requires LLM provider) |
| Career gap recommendations | Working (requires LLM provider) |

### Application Tracking
| Feature | Status |
|---|---|
| Save/unsave jobs | Working |
| Status stages (7 states) | Working |
| Notes per application | Working |
| Status date tracking | Working |

---

## 7. API Integration Mapping (Frontend → Backend)

| Page / Component | API Calls |
|---|---|
| SkillOverviewPage | `GET /api/skills`, `POST /api/analysis/run` |
| SkillDetailPage | `GET /api/skills/:id` |
| RepositoriesPage | `GET /api/github/repos`, `GET /api/github/quota`, `PATCH /api/github/repos/:id/selection`, `POST /api/analysis/repositories/:id` |
| RolesPage | `GET /api/roles`, `POST /api/gap-analysis`, `POST /api/gap-analysis/:id/explanation` |
| DashboardPage | `GET /api/career/profile` |
| OpportunitiesPage | `GET /api/opportunities`, `PUT /api/saved-jobs/:id`, `DELETE /api/saved-jobs/:id` |
| ApplicationsPage | `GET /api/saved-jobs`, `PUT /api/saved-jobs/:id`, `DELETE /api/saved-jobs/:id` |
| DevelopmentPage | `GET /api/career/profile`, `GET /api/career/transition`, `PUT /api/career/tasks/:skillId` |
| CopilotPage | `GET /api/copilot/prompts`, `POST /api/copilot/message` |
| ResumePage | `GET /api/resume`, `POST /api/resume/extract`, `PUT /api/resume`, `DELETE /api/resume` |
| PreferencesPage | `GET /api/career/profile`, `PUT /api/career/preferences` |
| AuthContext | `GET /api/auth/me`, `POST /api/auth/logout` |

---

## 8. Backend Route Inventory

### Full API Surface

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/ready` | Readiness check (MongoDB) |
| GET | `/api/auth/github` | Initiate GitHub OAuth |
| GET | `/api/auth/github/callback` | OAuth callback |
| GET | `/api/auth/me` | Get session user |
| POST | `/api/auth/logout` | Sign out |
| DELETE | `/api/auth/account` | Delete account |
| GET | `/api/github/repos` | List user repositories |
| GET | `/api/github/repos/:id` | Get repository detail |
| PATCH | `/api/github/repos/:id/selection` | Toggle repo selection |
| GET | `/api/github/quota` | GitHub API quota |
| POST | `/api/analysis/repositories/:id` | Analyze repository |
| POST | `/api/analysis/run` | Run skill scoring |
| GET | `/api/skills/` | List all skills with scores |
| GET | `/api/skills/:id` | Get skill detail |
| GET | `/api/skills/:id/evidence` | Get skill evidence items |
| GET | `/api/roles/` | List roles |
| GET | `/api/roles/:id` | Get role detail |
| POST | `/api/gap-analysis/` | Create gap analysis |
| GET | `/api/gap-analysis/:id` | Get gap analysis |
| POST | `/api/gap-analysis/:id/explanation` | Generate LLM explanation |
| GET | `/api/career/profile` | Get career profile |
| PUT | `/api/career/preferences` | Update preferences |
| PUT | `/api/career/direction` | Set career direction |
| GET | `/api/career/transition` | Get transition plan |
| PUT | `/api/career/tasks/:skillId` | Update task status |
| POST | `/api/career/refresh` | Refresh GitHub profile |
| GET | `/api/resume/` | Get resume |
| POST | `/api/resume/extract` | Extract resume from file |
| PUT | `/api/resume/` | Save resume |
| DELETE | `/api/resume/` | Delete resume |
| GET | `/api/opportunities/providers` | Provider status |
| GET | `/api/opportunities/` | Search jobs |
| GET | `/api/opportunities/:jobId/match` | Explain job match |
| GET | `/api/saved-jobs/` | List saved jobs |
| PUT | `/api/saved-jobs/:jobId` | Save/update job |
| DELETE | `/api/saved-jobs/:jobId` | Remove saved job |
| GET | `/api/copilot/prompts` | Get suggested prompts |
| POST | `/api/copilot/message` | Send copilot message |

---

## 9. Data Models

| Collection | Purpose | Key Fields |
|---|---|---|
| `users` | Core user identity | githubId, username, encryptedGithubToken |
| `repositories` | GitHub repo metadata + analysis state | userId, fullName, selected, analyzed, scoringObservations |
| `repositoryEvidence` | Phase 4 evidence items | userId, repositoryId, skillId, signal, normalizedStrength |
| `analyses` | Phase 5 skill scoring results | userId, scoringVersion, result (skillScores[]) |
| `gap_analyses` | Phase 7 role match results | userId, roleId, result (roleMatchResult) |
| `saved_jobs` | Application tracker | userId, jobId, job snapshot, status, note |
| `career_profiles` | Preferences, resume, learning | userId, preferences, resume, learning, refresh |
| `revoked_sessions` | JWT blacklist | fingerprint (SHA-256), expiresAt (TTL) |

---

## 10. Frozen Business Logic

The following are **frozen** — must not be modified during the redesign:

### `config/scoring.json`
- Signal weights: dependency 0.2, framework 0.2, sourceUsage 0.25, projectStructure 0.1, testing 0.1, documentation 0.05, activity 0.1
- Meaningful signal threshold: 0.25
- Breadth factors: 0.5 / 0.75 / 1.0 (for 1/2/3+ meaningful signals)
- Repository substance formula
- Top 5 repositories per skill, rank decay 0.6

### `config/roles.json`
- 5 roles: Software Engineer, Full-Stack Developer, Backend Engineer, AI Engineer, ML Engineer
- Each role: skill requirements with weights and minimum scores

### `config/job-matching.json`
- Component weights (requiredSkills 0.35, githubProjects 0.25, resume 0.2, preferences 0.1, experienceEligibility 0.1)
- Match labels: strong ≥70, potential ≥45
- Hard blocker level gap: 2 experience levels
- Skill aliases and prerequisites

---

## 11. Existing Tests

| Location | Type | Coverage |
|---|---|---|
| `apps/web/src/**/*.test.tsx` | Unit/Integration (Vitest + RTL) | Auth, skills, roles, career features, app interactions |
| `apps/web/src/api/client.test.ts` | Unit | API client |
| `apps/api/tests/` | Integration (Vitest + Supertest) | API endpoints |
| `apps/web/e2e/` | E2E (Playwright) | Full user flows |

---

## 12. Current Frontend Quality Assessment

### Strengths
1. **Intentional dark-first design** — The "Gold Signal" palette is distinctive and professional
2. **Cohesive color system** — OKLCH ensures perceptual uniformity; semantic slot remapping is clever
3. **Purposeful typography** — Three-font system (display/body/mono) is well-matched to content types
4. **Accessibility foundations** — Skip link, focus rings, reduced motion, ARIA labels all present
5. **Custom animation system** — Subtle and purposeful; no excessive effects
6. **Zero external UI library** — No dependency bloat; full design control
7. **Custom inline SVG icons** — No icon library dependency
8. **Working glass effect** — `nx-glass` creates genuine depth without being excessive
9. **Atmospheric background** — Three radial gold glows add depth to dark canvas

### Limitations for Phase 7 Redesign
1. **Landing page needs upgrade** — Current AuthGate landing page (SVG constellation) is functional but not immersive enough for a commercial product
2. **Limited sidebar** — Fixed 224px with no collapse capability
3. **No command palette** — No global Cmd+K search/navigation
4. **No global search** — Navigation relies entirely on sidebar
5. **No breadcrumbs** — Nested pages have no contextual navigation
6. **Card overuse** — Some pages default to card-in-card patterns
7. **Dashboard is sparse** — Shows setup checklist but limited actual intelligence
8. **No data visualizations** — Skill data presented as text lists + score bars only
9. **No page transitions** — Each route change is abrupt
10. **Typography hierarchy** — Could be more pronounced for display/section headings

### Missing Features (UI-only)
- Global search / command palette
- Notifications panel
- Collapsible sidebar
- Chart/visualization components
- Skill network graph
- Match confidence visualization
- Progress/completion metrics on overview

---

## 13. Dependencies on External Services

| Service | Purpose | Required for |
|---|---|---|
| GitHub OAuth | Authentication | Core — required |
| GitHub REST API | Repository discovery and analysis | Core — required |
| MongoDB | Database | Core — required |
| Google Fonts CDN | Barlow Condensed, Inter, JetBrains Mono | UI — can self-host |
| LLM Provider (Groq/Gemini/OpenAI-compatible) | Gap explanations, resume extraction, copilot | Optional — graceful degradation |
| Job Providers (JSearch, Adzuna, Remotive, etc.) | Job listings | Optional — demo fixtures available |

---

## 14. Risks

| Risk | Severity | Notes |
|---|---|---|
| Tailwind CSS 4 slot remapping | Medium | `indigo-700` = Gold not Indigo. Shadcn requires careful integration to avoid color conflicts |
| No data fetching library | Medium | Custom `useApiResource` hook lacks caching, background refresh, deduplication |
| Google Fonts CDN dependency | Low | Can be self-hosted; affects font loading on first visit |
| Three.js / WebGL in Vite | Low | No current 3D dependency; will need lazy loading strategy for Phase 2 |
| No SSR | Low | Pure SPA; fine for authenticated app but may affect SEO for landing page |
| Icon system (inline SVG) | Low | Currently 15 icons; scaling to full app needs more icons — recommend adopting Lucide |

---

## 15. Summary

The NEXUS application is a **substantially complete, production-quality career intelligence platform** with sophisticated backend engineering. The frontend is intentional and distinctive but limited in its design vocabulary — it has a strong design foundation (Gold Signal) but needs:

1. An immersive public landing experience
2. A richer authenticated application design (data visualizations, command palette, collapsible sidebar)
3. More typographic variety and visual hierarchy
4. Better page-level layouts (not everything in a max-w-5xl content column)
5. Proper component system for scalability (shadcn or custom)

The existing code is well-structured and preservation is straightforward — the redesign should layer on top of the Gold Signal foundation rather than replace it.
