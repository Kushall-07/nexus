# Phases 11–13 — Career Copilot, Opportunity Engine and release readiness

NEXUS v1 answers "what do my projects demonstrate?". This extension adds a Career Profile and an Opportunity Engine around that Evidence Engine, without changing it.

```
Evidence Engine (frozen)      Career Profile                Opportunity Engine
GitHub evidence, scores  -->  resume claims, preferences -->  providers -> normalize -> match -> explain
config/scoring.json           career_profiles collection      config/job-matching.json
config/roles.json             saved_jobs collection           demo fixtures when no provider
```

**Frozen, unmodified:** `config/scoring.json`, `config/roles.json`, `packages/domain`, the evidence aggregation and the gap-analysis engine. New code reads their outputs (Evidence Scores, the role catalog as a baseline) and never alters their meaning. `tests/career/job-matcher.test.ts` pins SHA-256 hashes of the two config files.

## Module map (API: `apps/api/src/career/`)

| Module | Role |
| --- | --- |
| `types.ts` | Normalized job, preferences and resume-profile contracts (zod) |
| `skill-vocabulary.ts` | Controlled alias table → canonical skill ids (never executes text) |
| `matching/job-matcher.ts`, `matching-config.ts` | Pure deterministic matcher; config in `config/job-matching.json` (versioned) |
| `jobs/adapters.ts` | Remotive, Adzuna, JSearch adapters + normalization |
| `jobs/demo-provider.ts` | Invented, labelled fixtures (`isDemo: true`, links to `example.com`) |
| `jobs/job-service.ts` | Registry, cache, dedupe, partial-failure handling, demo/live separation |
| `jobs/text.ts` | HTML → plain text, safe URL check, skill extraction |
| `resume/upload.ts`, `resume/extractor.ts` | Validation, in-memory parsing, deterministic extraction |
| `transition/*` | Career-transition gap engine, prerequisites, task templates |
| `copilot/*` | Deterministic intent rules, optional LLM interpretation, orchestration |
| `refresh.service.ts` | Coordinates the existing GitHub analysis + scoring services |
| `career-store.ts` | The only module touching the new collections; every query scoped by `userId` |
| `career.controller.ts`, `career.routes.ts` | Authenticated HTTP surface |

Frontend: `apps/web/src/features/career/` (Dashboard, Opportunities, Applications, Resume, Development, Preferences, Copilot) wired into the existing shell in `App.tsx`.

## Data flow

1. **Search**: `GET /api/opportunities` → job service (live providers, or demo only when `source=demo`) → normalize → dedupe → match each job against `loadProfileContext(userId)` → rank → response. Live and demo results are never mixed.
2. **Match**: GitHub Evidence Scores (≥ `githubSupportMinScore`) count as supported. Resume skills count as *claims* with partial credit. Nothing else is credited.
3. **Track**: saving creates a record from the server's own copy of the job (a client cannot supply job content).
4. **Copilot**: message → validated intent → the same services as the UI → structured cards + UI actions.

## Job-provider adapter contract

```ts
interface JobProvider {
  id; label;
  status(): { configured: boolean; hint?: string };   // never contains a credential
  search(query: JobSearchQuery, now: Date): Promise<NormalizedJob[]>;
}
```

- Hard-coded upstream hosts (no user/model-controlled URL → no SSRF); `redirect: "error"`; per-request timeout (`JOB_PROVIDER_TIMEOUT_MS`); 2 MB body cap; no retries.
- Failures are typed (`rate_limited`, `timeout`, `network`, `auth`, `bad_response`, `upstream`) and only the kind is logged/returned.
- Malformed entries (no title/id/valid http(s) link) are skipped, never repaired. Predicted salaries (Adzuna) are dropped rather than shown as stated pay. Descriptions are converted to plain text and rendered as text.
- Results are cached in memory per provider+query for `JOB_CACHE_TTL_SECONDS`; failures are never cached. **Review each provider's terms before raising the TTL.**
- **The three live adapters were written from each provider's public documentation and exercised only against recorded-shape fixtures. They have not been run against the real services (no credentials were available).**

## Matching formula (`config/job-matching.json`, version 1.0.0)

Initial weights (a separate model from the frozen Evidence scoring): required skills 35%, GitHub project evidence 25%, resume experience 20%, preferences 10%, experience/eligibility 10%.

- A component that cannot be computed (no resume, no comparable preference, no stated level) is **excluded and the remaining weights are renormalized** — absence is neither rewarded nor punished. Missing salary/location is never a mismatch.
- No score is produced (`insufficient-evidence`) when the user has neither GitHub analysis nor resume, when the listing has no recognisable required skills, or when computable weight < `minimumAvailableWeight` (0.5).
- Resume-only skills earn `resumeOnlySkillCredit` (0.6) of a required skill and zero GitHub-evidence credit.
- Labels: `strong` ≥ 70, `potential` ≥ 45, else `stretch`. A **hard blocker** (level gap ≥ 2, or student-only listing for a non-student) sets the label `blocked` and is shown separately from the score; unresolved eligibility questions are listed.
- Confidence (`high`/`medium`/`low`) reflects how many independent sources (GitHub, resume) and required skills the score rests on. The score is a similarity heuristic, not a hiring probability, and the UI says so.

## Resume processing

1. `POST /api/resume/extract` (raw body, `X-File-Name` header, limit `RESUME_MAX_BYTES`): extension **and** file signature must agree (PDF `%PDF-`, DOCX zip). DOCX central directory is checked (≤ 1000 entries, ≤ 50 MB expanded) before parsing to stop zip bombs. Parsing is in memory with a 15 s timeout, ≤ 12 PDF pages and ≤ 200k characters. Scanned/image-only files fail with an explanation (no OCR).
2. The deterministic extractor returns a **draft only** (nothing stored). Name, contact, education, experience, projects, skills, certifications and links are taken only from text present.
3. The user reviews/edits; `PUT /api/resume` validates and stores **normalized fields only** (no file, no raw text), incrementing `version`. The previous resume stays active until this write succeeds, so cancelling or a failed extraction/validation changes nothing.
4. `DELETE /api/resume` removes only the resume fields. GitHub evidence, saved jobs, preferences and learning progress are untouched.
5. Provenance: skills carry `resume | user-corrected | user-confirmed`. Parsed text is never treated as verified. Other fields are not individually tracked (limitation).

## Career transition and learning plan

`GET /api/career/transition` combines (1) the versioned role catalog as a baseline (read-only), (2) a single bounded job search as employer demand (a skill absent from the baseline is added only if it appears in ≥ 2 and ≥ 30% of at least 3 sampled listings), and (3) the user's evidence. Each gap has a status (`demonstrated`, `partial`, `resume-claimed`, `missing`, `unverified`), a priority, unmet prerequisites (ordered first), why it matters, and a concrete learn/build/verify task with a rough effort range where defensible. Task status (`planned`, `in_progress`, `completed`, `skipped`) is stored per user and **never counts as evidence**. Demo-derived demand is labelled as fixtures.

## Career Copilot

Deterministic rules handle: job search (type, mode, level, location, "meet most requirements"), set direction, transition/compare, skill gaps, project suggestion, match explanation, refresh request, resume replace/delete requests, help. Unsupported input gets a supported-actions reply. If `LLM_PROVIDER`/`LLM_API_KEY` is configured (the existing provider), it is used **only** to interpret an otherwise-unrecognized message: the model sees only the user's message (never job text, resumes or profile data), its JSON is validated against a closed schema, directions are checked against the controlled vocabulary, and any failure falls back to the rules. The Copilot never deletes data or starts GitHub fetches itself — it returns UI actions the user confirms.

## API endpoints (all require a session)

| Method & path | Purpose |
| --- | --- |
| `GET /api/opportunities` | Search/rank (`keywords, location, workMode, employmentType, experienceLevel, limit, page, source=live\|demo`) |
| `GET /api/opportunities/providers` | Provider configuration status (no secrets) |
| `GET /api/opportunities/:jobId/match` | Match explanation |
| `GET /api/saved-jobs`, `PUT/DELETE /api/saved-jobs/:jobId` | Save, track (`status, note, statusDate, dismissed`), remove |
| `GET /api/career/profile`, `PUT /api/career/preferences`, `PUT /api/career/direction` | Profile, preferences, direction |
| `GET /api/career/transition`, `PUT /api/career/tasks/:skillId` | Plan, task status |
| `POST /api/career/refresh` | Re-analyze selected repos, then re-score (3 per 10 min) |
| `GET /api/resume`, `POST /api/resume/extract`, `PUT /api/resume`, `DELETE /api/resume` | Resume lifecycle |
| `POST /api/copilot/message`, `GET /api/copilot/prompts` | Copilot |

## Profile refresh

Reuses `analyzeSelectedRepository` and `scoreUserEvidence`. A new immutable Analysis is created only after every selected repository was analyzed (repositories GitHub no longer exposes are skipped and reported). On any other failure scoring is not run, the last analysis remains the latest, and status `failed` marks the profile stale. Only one refresh per user runs at a time. No new GitHub scope or private-repository access.

## Persistence and retention

| Collection | Contents | Deleted by |
| --- | --- | --- |
| `career_profiles` (1/user) | preferences, active resume fields, direction, task statuses, refresh status | resume: `DELETE /api/resume`; the rest persists until the account data is removed |
| `saved_jobs` | job snapshot (description truncated to 2000 chars), status, note, date, dismissed | `DELETE /api/saved-jobs/:jobId` |

Uploaded files and extracted raw text are never stored or logged. `DELETE /api/auth/account` (body `{"confirmation":"DELETE MY DATA"}`) removes the user, repositories, analyses, evidence, gap analyses, career profile and saved jobs, ends the session, and is limited to 3 per 10 minutes. Saved-job snapshots keep provider content the user chose to save; check provider terms for your deployment.

## Security notes

Authentication and ownership on every route (user id comes from the session, never the request); strict zod schemas (unknown keys rejected); per-user rate limits; 413/415/422 for oversized/mismatched/unreadable uploads; provider keys only in server env and only sent to the provider host; log redaction (provider failures log the kind only); external links open with `noopener noreferrer nofollow` and are limited to http(s); provider/resume/job text is data — it is rendered as text, never as HTML, and never reaches the LLM.

Known limits: rate limiting is per process; the in-memory job index and cache reset on restart (saved jobs do not); no OCR; the skill vocabulary is a fixed alias table so unusual technologies appear only as free-text; the matcher knows nothing about seniority beyond title keywords.

## Environment variables (all optional)

| Variable | Enables | Obtain |
| --- | --- | --- |
| `REMOTIVE_ENABLED=true` | Remotive remote listings (no key) | Read Remotive's API terms and attribution requirements first |
| `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` (+ `ADZUNA_COUNTRY`, default `us`) | Adzuna | developer.adzuna.com |
| `JSEARCH_API_KEY` | JSearch | RapidAPI subscription for JSearch |
| `JOB_CACHE_TTL_SECONDS` (3600), `JOB_PROVIDER_TIMEOUT_MS` (8000) | Cache/timeouts | — |
| `RESUME_MAX_BYTES` (5,000,000) | Upload cap | — |
| `LLM_*` | Optional intent interpretation (existing) | existing |

Half-configured Adzuna fails startup naming the variable (never the value). Quotas, pricing and terms of every provider must be checked by the owner.

## Local setup, demo mode and production

- Local: `npm install`, copy `.env.example` → `.env` (fill existing required values), `npm run dev` (starts Docker MongoDB, API :4000, web :5173). New collections are created on first use.
- **Demo mode**: leave the provider variables blank. Opportunities shows "no live provider" and an "Explore demo listings" action; demo results carry a banner and `Demo example — not a real vacancy` badges.
- Production: `npm run build` builds, in order, `packages/domain` (to `dist/`), the API (to `apps/api/dist`, config files resolve from the compiled layout) and the web app (`apps/web/dist`). Start the API with `npm start` (plain `node apps/api/dist/server.js`; no `tsx`). Serve `apps/web/dist` behind the same origin, or a proxy that forwards `/api`. Set `NODE_ENV=production`, https `FRONTEND_URL`/`BACKEND_URL`, a managed MongoDB, and only the providers you have rights to. `npm run test:smoke --workspace=apps/api` (after a build) starts the compiled server against a disposable MongoDB and checks `/health`, `/ready`, the auth gate and failure on an unreachable database.
- Pre-deployment checklist: review provider terms/quotas; shorten the cache TTL if terms require; keep one API instance or move rate limiting to a shared store; confirm the retention table is acceptable for your users; account deletion exists (`DELETE /api/auth/account`, Settings page) but cannot revoke the OAuth grant at GitHub; verify the production OAuth callback URLs.

## Tests

`npm test` (all workspaces). Career suites: `apps/api/tests/career/*` (matcher, providers, resume, transition/intents, API/ownership/Copilot/refresh with in-memory model fakes, env/LLM) and `apps/web/src/features/career/career.test.tsx`. The store's Mongo operations were additionally verified once against a real MongoDB 8 instance in a temporary database (dropped afterwards); `npm run test:integration --workspace=apps/api` now runs real-MongoDB tests (unique indexes, account deletion with ownership isolation, restart-safe session revocation) against a disposable in-memory server.

## Manual verification checklist

1. Sign in with GitHub; open Opportunities → see "no provider" state → "Explore demo listings" → banner and badges visible.
2. Select repositories, run analysis, **Refresh GitHub profile** on the Dashboard; confirm matches change from "not enough evidence" to scored.
3. Upload a real PDF and DOCX resume → review → confirm; upload another and cancel; delete with confirmation.
4. Save a demo job, set status/note, restart the API, confirm it persists.
5. Choose a direction on Skill development; mark a task completed and confirm the gap status stays "missing" until you refresh after pushing code.
6. Ask the Copilot the example prompts, with and without an LLM key.
7. After adding real provider keys: search and confirm real links, attribution and quota behaviour.

## Runtime hardening update

- **Packaging**: `@nexus/domain` now exports compiled `dist/` (with a `source` export condition used by `tsx --conditions=source`, Vitest and `tsc` typechecking). API/domain build configs use `rootDir: src`, which keeps the `../../../../config/*.json` lookups valid in the compiled layout.
- **Sessions**: logout revocations are written to `revoked_sessions` (TTL-indexed) and reloaded at startup. Verification still uses an in-memory set, so multiple API instances learn of each other's revocations only after a restart.
- **Tests**: the API suite no longer reads the developer's `.env` (`tests/setup-env.ts` supplies inert values). Web tests use a longer async budget; the earlier "5 s timeout / missing Next.js link" failures were load-induced timing, and all 114 pass.
- **Frontend**: dark-first theme (palette variables remapped in `index.css`), Settings page with integration status (booleans only) and confirmed data deletion.
- **Still open**: live provider calls unverified (no credentials); rate limiting is per process; no OCR; no browser (end-to-end) test run in this session.

## Premium frontend pass (final)

A full visual redesign was applied to `apps/web/` without changing any API contracts or test-visible text strings.

### Layout

Replaced the horizontal top-navigation bar with a persistent **sidebar layout** (`apps/web/src/App.tsx`):

- `DesktopSidebar` (`hidden lg:flex w-56`): sticky full-height sidebar with NEXUS logo, grouped nav, and `AccountMenu` in the footer.
- `MobileHeader`: compact bar with hamburger button; no `AccountMenu` (avoids duplicate aria-labels).
- `MobileDrawer`: full-height overlay, closes on outside click and Escape, renders `AccountMenu` in its footer — only mounted when open so the aria-label is never duplicated.
- `SidebarNav` uses `useLocation()` for active state detection; grouped into Dashboard / Career / Profile / Settings sections.

### Icons

New `apps/web/src/components/Icons.tsx` — lightweight inline SVG icons, no external library. All icons use `currentColor`, default `aria-hidden="true"`. Exported: `IconDashboard`, `IconBriefcase`, `IconClipboard`, `IconTrendingUp`, `IconChat`, `IconStar`, `IconDocument`, `IconCode`, `IconTarget`, `IconSliders`, `IconGear`, `IconMenu`, `IconClose`, `IconChevronRight`, `IconNexus`, `IconRefresh`, `IconCheck`, `IconAlert`, `IconExternal`.

### Component improvements

| File | Change |
| --- | --- |
| `components/StateViews.tsx` | `LoadingState`: indigo/slate animated spinner. New `SkeletonBlock` and `CardSkeleton` for async grid layouts. `EmptyState`: centered with `p-8`. |
| `components/AccountMenu.tsx` | Sidebar-footer width (`w-full`), avatar/initial fallback, menu opens upward (`bottom-full`). Loading state kept as `<p>Checking session...</p>` for test compat. |
| `AuthGate.tsx` | `SignInPrompt` centered card with inline GitHub mark SVG and indigo/slate button styling. |
| `index.css` | Added `skip-to-main`, `skeleton-pulse` keyframe + `.skeleton` utility, `fade-in` for `main > *`, themed scrollbar. |
| `features/career/DashboardPage.tsx` | `ProfileSection` with `StatusPill` rows; `QuickActions` link grid; `CardSkeleton` skeletons while jobs load; "Next action:" inline bold label. |
| `features/career/DevelopmentPage.tsx` | `ProgressSummary`: visual percentage bar (`role="meter"`), `dl` stat grid. `GapList`: colored status badges via `STATUS_COLOR`, styled learn/build/verify cards. |
| `features/career/RefreshPanel.tsx` | Status badge in header; spinner inside busy button; stale/error message layout. |
| `features/career/ApplicationsPage.tsx` | `rounded-xl` cards, `sm:grid-cols-2` grid, `SourceBadge` in header. |
| `features/settings/SettingsPage.tsx` | Divided integration rows; amber warning when no providers configured. |

All test-visible text strings were preserved exactly (heading formats, label text, aria-labels, status messages) throughout the redesign.

### Quality gates (post-redesign)

| Suite | Count | Result |
| --- | --- | --- |
| `packages/domain` unit tests | 113 | All pass |
| `apps/api` unit tests | 517 | All pass |
| `apps/web` unit tests | 114 | All pass |
| TypeScript (`tsc --noEmit`) | domain, api, web | Clean |
| Production build (`npm run build`) | domain → api → web | Clean |

Protected config hashes verified unchanged (SHA-256 of `config/scoring.json`, `config/roles.json`, `config/job-matching.json`).

### Provider adapter fixture coverage

The API test suite (`apps/api/tests/career/providers.test.ts`) exercises all three live adapters against fixture-shaped responses:

- **Remotive**: valid search, empty results, malformed entry (no title/id/link) skipped, HTML description stripped, pagination, 429 rate-limit → `rate_limited`, network error → `network`, invalid JSON → `bad_response`.
- **Adzuna**: valid search with salary normalization, missing salary dropped, Adzuna's predicted-only salary dropped, country param, auth error → `auth`, 500 → `upstream`, body-size guard.
- **JSearch**: valid search, `job_apply_link` used for apply URL, missing required fields skipped, pagination offset, RapidAPI 429 header → `rate_limited`, auth error → `auth`.

No live credentials were used; adapters remain unverified against real endpoints.

### Security review findings

| Area | Finding |
| --- | --- |
| CSRF | `requireTrustedOrigin()` checks `Origin` header on all state-mutating routes; browsers always send `Origin` on cross-site requests. No token-in-cookie pattern required. |
| Session revocation | SHA-256 fingerprint stored in `revoked_sessions` with a TTL index; set reloaded from MongoDB at startup. Per-process only — a second API instance does not learn of revocations until restart. |
| Account deletion | `DELETE /api/auth/account` requires body `{"confirmation":"DELETE MY DATA"}`; rate-limited to 3 per 10 min; removes user, repos, analyses, evidence, gap analyses, career profile and saved jobs atomically. Cannot revoke the OAuth grant at GitHub (user must do this manually). |
| Rate limiting | Per-user in-memory maps. Resets on process restart. Shared-store (Redis) needed for multi-instance deployments. |
| Provider SSRF | Upstream URLs are hard-coded per adapter; `redirect: "error"`; per-request timeout; 2 MB body cap; no user/model-controlled URL. |
| Upload safety | Extension + file-signature agreement enforced; DOCX central-directory checked (≤ 1000 entries, ≤ 50 MB expanded); parsing capped at 15 s / 12 PDF pages / 200 k chars; no raw text stored or logged. |

**Still open**: browser (end-to-end) tests not run in this session; rate limiting is per process; no OCR; live provider calls unverified (no credentials available).
