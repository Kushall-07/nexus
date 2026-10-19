# Phase 7 — Role Engine & Gap Analysis

Status: implemented. No LLM involvement; every number is deterministic.

## Roles

Exactly five manually curated v1 benchmarks live in `config/roles.json` (the single source; the web app fetches them
from `GET /api/roles`). They are not universal job-market requirements.

| Role | Requirements (skill: weight, minimum) |
|---|---|
| Software Engineer | Python .15/50, TypeScript .15/50, Backend .15/50, Databases .15/50, REST APIs .15/50, Testing .15/50, Docker .10/40 |
| Full-Stack Developer | JavaScript .10/50, TypeScript .10/50, React .15/60, Node.js .15/55, REST APIs .10/50, MongoDB .10/45, PostgreSQL .10/40, Testing .10/45, Docker .10/40 |
| Backend Engineer | Python .15/50, Node.js .15/50, Express .10/45, FastAPI .10/45, REST APIs .15/60, MongoDB .10/45, PostgreSQL .10/45, Testing .05/40, Docker .10/40 |
| AI Engineer | Python .15/60, LLM Applications .20/60, Agentic AI .15/55, RAG .10/45, AI APIs .10/50, REST APIs .10/45, Docker .10/40, Testing .10/40 |
| ML Engineer | Python .20/65, PyTorch .20/60, TensorFlow .10/45, Model Development .20/60, Testing .10/40, Docker .10/40, REST APIs .10/40 |

Requirements reference canonical skill ids. "Backend", "Databases" and "Testing" resolve to `backend-development`,
`database-systems` and `software-testing`, added to the taxonomy in Phase 6 (see `phase6-skill-graph.md`).

## Configuration validation

`parseRoleCatalog` (`packages/domain/src/roles`) runs when `loadRoleCatalog` first loads the file. It rejects, with
`RoleConfigError` (surfaced as `INVALID_ROLE_CONFIGURATION`, never repaired): anything other than five roles, invalid or
duplicate role ids, duplicate role names, unknown skill ids, duplicate skills within a role, weights not in `(0, 1]`,
minimums outside `[0, 100]`, missing or non-finite values, unknown fields, and role weights that do not sum to `1`
(tolerance `1e-9`).

## Mathematics (`computeRoleMatch`, pure)

With Evidence Score `S_i ∈ [0,100]`, weight `W_i`, minimum `M_i` per requirement:

- Role Match = Σ S_i · W_i, clamped to `[0,100]`, unrounded.
- gap_i = S_i − M_i (signed).
- deficit_i = max(M_i − S_i, 0).
- criticalGap_i = S_i < M_i (strict; equal to the minimum is **not** critical).

A skill with no evidence in the scoring run is used as `S_i = 0`, flagged `evidenceAvailable: false`. Weights are never
renormalized over the skills that have evidence. `evidenceAvailable` never changes any number. Critical gaps are derived
only from each requirement's own score and minimum — never from Role Match — and are returned in configured order.
Rounding happens only in the UI.

## API

All routes require authentication; user-scoped data is keyed by the session user.

- `GET /api/roles` — the five roles with skill names, weights and minimums.
- `GET /api/roles/:id` — one role; unknown id → `404 ROLE_NOT_FOUND`.
- `POST /api/gap-analysis` `{ "roleId": string }` (strict body) — uses the user's latest persisted Phase 5 analysis,
  computes the result with the domain engine, persists it, returns `201`. No analysis → `404 NO_ANALYSIS`. The client
  cannot supply scores, weights, thresholds or flags.
- `GET /api/gap-analysis/:id` — the user's own stored result. Another user's result is indistinguishable from a missing
  one (`404 GAP_ANALYSIS_NOT_FOUND`); malformed id → `400`.

Result: `roleId, roleName, roleMatch, requirements[], criticalGaps[]`, each requirement with `skillId, skillName,
evidenceScore, evidenceAvailable, weight, minimumScore, weightedContribution, gap, deficit, criticalGap` (the minimum is
the required score), plus `id, analysisId, scoringVersion, roleCatalogVersion, createdAt`.

## Persistence

New collection `gap_analyses` (`GapAnalysisModel`): `userId`, `analysisId`, `roleId`, `scoringVersion`,
`roleCatalogVersion`, `roleCatalogHash`, `result`. A separate model was chosen because an `Analysis` is an immutable
scoring run that may be compared with several roles; `Analysis` is untouched. Existing data needs no migration; role
comparisons are created on demand. Each POST stores a new document.

## Frontend

`/roles`: five-role radio selection (from the API), the selected role's requirements, "Run gap analysis" (disabled while
running; stale responses from a previously selected role are ignored), then the result: backend Role Match with an
explanation, a distinct **Critical gaps** section (Evidence Score, Minimum Required, Gap, Deficit, status text) or the
message "All configured minimum evidence thresholds are met for this role.", and a full requirements table. Critical
rows are marked with text as well as colour. Empty/error handling covers no analysis, invalid role, session expiry,
network failure and missing evidence.

## Tests

- Domain `roles.test.ts`: frozen table equality, weight sums, canonical ids, every validation rule, role-match maths
  (zero, 100, mixtures, fractional precision, missing evidence, determinism, bounds), gaps, deficits, strict-threshold
  critical gaps, independence from the overall match.
- API `roles-gap-analysis.test.ts`: auth, role list/lookup, validation, persistence and traceability, ownership,
  determinism, critical gaps with a high overall match, no leakage of `userId` / hash.
- Web `App.interaction.test.tsx` (jsdom): select role → POST → verbatim backend values, critical gap rendering,
  threshold equality, stale response after switching roles (mutation-checked), duplicate-click guard, error states.
- Web `roles.test.tsx`: five options, selection, requirements, run states, signed gaps and deficits, critical-gap
  visibility, threshold equality, no-evidence wording, terminology, backend values displayed verbatim.

## Limitations

- A role only reflects skills the detectors can observe. Databases and Testing have no evidence source, so roles requiring
  them (Software Engineer needs both) show critical gaps with "No evidence available". Backend has only weak layout-based
  evidence (ceiling 75, and 50 or more needs a near-complete layout plus strong recent activity), so it will usually remain a
  critical gap too. These
  are detector limits, deliberately not papered over (see `phase6-skill-graph.md`).
- Gap analysis uses the latest analysis only; there is no analysis picker or history view in the UI (stored results are
  retrievable by id).
- UI interactions are tested in jsdom with a stubbed network (role selection, run, stale-result guard, critical gaps,
  errors); not in a real browser against a live backend.
