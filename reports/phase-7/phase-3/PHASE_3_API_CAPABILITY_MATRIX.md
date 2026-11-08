# NEXUS Phase 3 — API Capability Matrix
**Date:** 2026-11-07  
**Status:** Based on actual backend route files. No invented capabilities.

---

## Legend

| Symbol | Meaning |
|---|---|
| ✅ Fully supported | Endpoint exists, response schema confirmed |
| ⚠️ Partially supported | Endpoint exists but limited (no search, pagination, etc.) |
| 🔑 Auth required | Standard — applies to all authenticated routes |
| 🤖 LLM-conditional | Feature works only when LLM env vars are configured |
| 🎭 Demo-fallback | Returns demo data when live provider key not set |
| ❌ Not supported | No backend support; must not be presented as functional |

---

## Authentication & Session

| Feature | Support | Endpoint | Notes |
|---|---|---|---|
| Check session | ✅ | GET /api/auth/me | Returns `{ githubId, username }` |
| GitHub OAuth | ✅ | GET /api/auth/github | Redirect flow |
| Sign out | ✅ | POST /api/auth/logout | Revokes JWT |
| Switch GitHub account | ✅ | GET /api/auth/github?switch=1 | Logout + re-auth |
| OAuth cancel notice | ✅ | Via AuthContext.notice | "GitHub sign-in was cancelled" |
| Session refresh | ✅ | Via AuthContext.refresh() | Retries /api/auth/me |

---

## Dashboard

| Feature | Support | Endpoint | Notes |
|---|---|---|---|
| Career profile summary | ✅ | GET /api/career/profile | evidence, resume, preferences, directions |
| Recent opportunities | ✅ | GET /api/opportunities?limit=10 | Shows up to 10 jobs |
| Skill plan preview | ✅ | GET /api/career/transition?direction=... | Conditional on direction |
| Evidence refresh trigger | ✅ | POST /api/career/refresh | Full re-analysis |
| User avatar | ⚠️ | GET /api/auth/me | Only githubId + username; avatar URL via GitHub |
| Activity feed / recent events | ❌ | None | Do not display |
| Notification count | ❌ | None | Do not display |

**Decision:** Dashboard can show real career profile data, real opportunities, real skill plan. No fabricated metrics.

---

## Skill Intelligence

| Feature | Support | Endpoint | Notes |
|---|---|---|---|
| All skill categories + scores | ✅ | GET /api/skills | Returns all skills grouped by category |
| Skill detail (contributions) | ✅ | GET /api/skills/:skillId | Per-repo scores, rank decay |
| Evidence drill-down | ✅ | GET /api/skills/:skillId/evidence | Signal type, strength, explanation |
| Trigger scoring run | ✅ | POST /api/analysis/run | Re-scores from persisted evidence |
| Skill graph / visualization | ⚠️ | Via /api/skills data | Data exists; frontend visualization not built |
| Skill trends over time | ❌ | None | No historical scoring data exposed |
| Skill recommendations | ❌ | None | Only gap analysis provides this, not raw skills |

**Decision:** Skill categories + cards with scores are fully supported. A visualization (bar chart, grouped category view) can be built from `/api/skills` data. No trend lines or skill recommendations.

---

## GitHub Evidence

| Feature | Support | Endpoint | Notes |
|---|---|---|---|
| Repository list | ✅ | GET /api/github/repositories | Lists all accessible repos |
| Analyze single repository | ✅ | POST /api/analysis/repositories/:id | Triggers Phase 3 analysis pipeline |
| Run scoring from evidence | ✅ | POST /api/analysis/run | Phase 5 — aggregates evidence into scores |
| Repository analysis status | ✅ | Via repository model (analyzed, analyzedAt) | In repo list response |
| Evidence per repo | ✅ | Via GET /api/skills/:skillId/evidence | Filtered by repositoryId |
| Repository languages | ✅ | Via repository model | Returns languages[] array |
| Commit/activity stats | ❌ | None | Not exposed by API |
| Repository file tree | ❌ | None | Not exposed |

**Decision:** Repository list with analysis status, per-repo language badges, and links to skill evidence are all supported. File trees and commit stats are not.

---

## Role & Gap Analysis

| Feature | Support | Endpoint | Notes |
|---|---|---|---|
| Available roles | ✅ | GET /api/roles | Filtered to user's context |
| Role gap analysis | ✅ | GET /api/roles/:roleId | Matched/missing skills |
| Detailed gap breakdown | ✅ | GET /api/gap-analysis/:roleId | Per-skill gap detail |
| LLM explanation of gaps | 🤖 | POST /api/roles/:roleId/explain | Only when LLM configured |
| Hard blockers | ✅ | In role analysis response | Must be displayed as-is from frozen config |
| Unavailable-info distinction | ✅ | In gap response | Must render as "insufficient evidence", not "gap" |
| Role requirements override | ❌ | Frozen — do not modify | config/roles.json not editable from UI |
| Match percentage | ✅ | Computed in gap response | Display only the backend-computed value |

**Decision:** Full role + gap display is supported. The LLM explanation panel must degrade gracefully. Hard blockers and unavailable-info semantics must be preserved exactly.

---

## Career Discovery (Opportunities)

| Feature | Support | Endpoint | Notes |
|---|---|---|---|
| Job search | ✅ 🎭 | GET /api/opportunities | Demo fallback if no live provider key |
| Provider status | ✅ | GET /api/opportunities/providers | Shows live vs demo mode |
| Match score | ✅ | In opportunities response | Backend-computed |
| Match explanation | 🤖 | GET /api/opportunities/:id/match | LLM-powered; degrades gracefully |
| Filter: direction | ✅ | ?direction= | |
| Filter: location | ✅ | ?location= | |
| Filter: employment type | ✅ | ?type= | |
| Filter: work mode | ✅ | ?mode= | |
| Skill-based filter | ✅ | Implicit in job matching | |
| Pagination | ⚠️ | ?limit= | No cursor/offset pagination documented |
| Sort | ⚠️ | Unknown | Need to verify sort params |
| Job detail panel | ✅ | Via opportunities list items | Full description in item response |
| External job link | ✅ | In job item response | URL to source listing |
| Job freshness/date | ✅ | In job item response | postedAt / createdAt |

**Decision:** Split-view job browser is fully supported. Filter panel can use existing query params. No global text search beyond the existing filter params.

---

## Saved Opportunities & Application Tracking

| Feature | Support | Endpoint | Notes |
|---|---|---|---|
| Save job | ✅ | PUT /api/saved-jobs/:jobId | |
| Unsave job | ✅ | DELETE /api/saved-jobs/:jobId | |
| List saved jobs | ✅ | GET /api/saved-jobs | Returns jobs with status |
| Status stages | ✅ | saved → applied → interviewed → offered → rejected | 5 stages in SavedJob model |
| Update status | ✅ | PUT /api/saved-jobs/:jobId | Update applicationStatus |
| Notes per application | ✅ | Via PUT /api/saved-jobs/:jobId with notes field | |
| Application date tracking | ✅ | savedAt in SavedJob model | |
| Kanban board view | ⚠️ | Data supported; frontend implementation needed | 5 stages map to kanban columns |
| Calendar / reminders | ❌ | None | Do not add |
| Email integration | ❌ | None | Do not add |

**Decision:** Table view + status filter is fully supported. Kanban board is data-possible (5 stages) and can be implemented as an optional view toggle. No reminders or integrations.

---

## Career Profile

| Feature | Support | Endpoint | Notes |
|---|---|---|---|
| Career profile read | ✅ | GET /api/career/profile | Complete profile response |
| Employment type preferences | ✅ | PUT /api/career/preferences | full-time, part-time, contract, internship |
| Work mode preferences | ✅ | PUT /api/career/preferences | remote, hybrid, on-site |
| Location preferences | ✅ | PUT /api/career/preferences | Location strings |
| Career direction / target | ✅ | PUT /api/career/direction | |
| Skill plan | ✅ | GET /api/career/transition?direction=... | |
| Mark task complete | ✅ | PUT /api/career/tasks/:skillId | |
| Profile completeness score | ⚠️ | Derivable from GET /api/career/profile | hasGithubAnalysis, hasResume, direction, preferences |
| User bio / description | ❌ | Not in User model | Do not add text bio field |
| Public profile URL | ❌ | None | Do not add |

---

## Resume

| Feature | Support | Endpoint | Notes |
|---|---|---|---|
| Upload + extract | ✅ | POST /api/resume/extract | Binary upload, returns extracted text |
| Save resume | ✅ | PUT /api/resume | Saves text content + metadata |
| Get resume | ✅ | GET /api/resume | Returns content + version + savedAt |
| Delete resume | ✅ | DELETE /api/resume | |
| Version tracking | ✅ | version integer in model | Display version number |
| Parsed skills from resume | ⚠️ | Implicit via career profile integration | Not a separate endpoint |
| Resume template | ❌ | None | Do not add |

---

## Career Copilot

| Feature | Support | Endpoint | Notes |
|---|---|---|---|
| Available prompts | ✅ | GET /api/copilot/prompts | Prompt suggestion list |
| Send message + get response | 🤖 | POST /api/copilot/message | Requires LLM env vars |
| Rate limiting | ✅ | 20 messages/min per user | Display rate-limit errors gracefully |
| Conversation persistence | ❌ | None — stateless per request | Do not fake conversation history |
| Context injection | ✅ | Backend injects user evidence into LLM context | Works transparently |
| Streaming response | ❌ | Unknown — not confirmed in routes | Do not implement streaming without backend support |
| Unavailable state | ✅ | Returns error when LLM not configured | Must show clear "unavailable" message |

**Decision:** Chat-style interface with prompt suggestions. No conversation history persistence. No streaming. Clear unavailable state.

---

## Settings

| Feature | Support | Endpoint | Notes |
|---|---|---|---|
| Theme toggle | ✅ | Client-side (lib/theme.ts) | No backend needed; persisted in localStorage |
| Account info display | ✅ | GET /api/auth/me | githubId, username |
| Sign out | ✅ | POST /api/auth/logout | |
| Switch GitHub account | ✅ | GET /api/auth/github?switch=1 | |
| Notification preferences | ❌ | None | Do not add |
| Email preferences | ❌ | None | Do not add |
| Data export | ❌ | None | Do not add |
| Account deletion | ❌ | None | Do not add |

---

## Global / Shell Features

| Feature | Support | Endpoint | Notes |
|---|---|---|---|
| Command palette (Cmd+K) | ✅ (client) | Navigation only — no backend search | Can navigate to routes; no cross-entity search |
| Backend global search | ❌ | None | Do not build search input that claims backend search |
| Notifications | ❌ | None | Do not add notification bell |
| Sidebar collapse/expand | ✅ (client) | Local UI state | No backend |
| Theme toggle | ✅ (client) | lib/theme.ts | |

---

## Summary by Feature Category

| Category | Fully Supported | Partial | Not Supported |
|---|---|---|---|
| Auth & Session | 6/6 | 0 | 0 |
| Dashboard | 4/7 | 0 | 3 |
| Skill Intelligence | 3/5 | 1 | 1 |
| GitHub Evidence | 4/6 | 0 | 2 |
| Role & Gap Analysis | 6/7 | 0 | 1 |
| Opportunities | 10/14 | 2 | 2 |
| Application Tracking | 6/8 | 1 | 2 |
| Career Profile | 7/9 | 1 | 2 |
| Resume | 4/5 | 1 | 1 |
| Career Copilot | 3/6 | 0 | 3 |
| Settings | 4/6 | 0 | 2 |
| Shell Features | 3/5 | 0 | 2 |

**Unsupported features that must NOT appear functional:** activity feed, notification bell, global cross-entity search, conversation history persistence, Copilot streaming, resume templates, public profile URL, email preferences, data export.
