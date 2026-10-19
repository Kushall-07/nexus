# Phase 6 — Skill Graph

Status: implemented. Evidence first, deterministic scoring, AI only explains — Phase 6 adds no scoring; it is an
evidence-inspection interface over the persisted Phase 5 result.

## User experience

Navigation: **Category → Skill → Repository → Evidence**.

- `/` — **Skill overview.** Skills grouped by the canonical taxonomy category, each card showing the backend Evidence
  Score (or "No evidence available" / "Not yet analyzed") and linking to its detail. A button runs Phase 5 scoring over
  already-collected evidence (`POST /api/analysis/run`).
- `/skills/:skillId` — **Skill detail.** Category, final Evidence Score, interpretation and limitations, then one card
  per contributing repository: repository skill score, base score, breadth factor, repository substance, rank
  multiplier, contribution weight, the per-signal breakdown (weight, applicability, strength, meaningful, evidence
  count) and that repository's evidence items (type, signal, normalized strength, observed value, source path, source
  reference, explanation). Repositories ranked below the top-N cutoff are listed separately as "Not counted in the
  score". Evidence from repositories that did not contribute is shown, but labelled as such.
- Loading, error (with retry), empty and not-found states exist on both pages; keyboard focus rings and labelled
  controls are used throughout.

A missing score is never rendered as `0`. `0/100` would only appear if the backend had calculated zero (Phase 5 never
produces a zero skill score — zero-score repositories are dropped before aggregation).

## API

| Route | Purpose |
|---|---|
| `GET /api/skills` | Taxonomy by category with the user's latest persisted score per skill (new) |
| `GET /api/skills/:id` | One skill: metadata, score, contributions with signal breakdowns, excluded repositories (new) |
| `GET /api/skills/:id/evidence` | Phase 4 evidence read, reused unchanged |
| `POST /api/analysis/run` | Runs Phase 5 `scoreUserEvidence` and stores a new analysis (new route over the existing service) |

All routes require authentication and scope every query by the session user. `GET /api/skills*` return
`status: "not-analyzed" | "no-evidence" | "scored"` so the UI can distinguish the three situations.

## Data flow

`Analysis` (latest per user, persisted by Phase 5) → `skill-profile.service.ts` (verifies the stored shape, maps it to
DTOs, resolves repository name/URL from the user's own `Repository` documents) → controller → React. Scores,
contributions, signal breakdowns and excluded repositories are copied from the stored `ScoringResult` unchanged. The web
app contains no scoring code; a test asserts none of the algorithm's identifiers appear in web sources.

Repository links are rendered only for `https://github.com/` URLs; evidence text is rendered as escaped text.

## Taxonomy change

Phase 7's frozen roles require **Backend**, **Databases** and **Testing** as skills, but the taxonomy only had them as
categories (and category ids cannot be reused as skill ids). Three canonical skills were added, each in its matching
category: `backend-development` ("Backend"), `database-systems` ("Databases") and `software-testing` ("Testing"), with
entries in `config/scoring.json`'s applicability matrix. `scoringVersion` is unchanged (no formula changed); the scoring
config hash of *new* runs differs from earlier runs.

Evidence support, audited against existing observations:

- **Backend (`backend-development`) — supported, weakly.** The existing Phase 3 backend directory-layout observation
  (`controllers`, `services`, `routes`, `models`, `middleware`) is now also mapped to it (`observationSkills.structure.backend`
  in `config/technologies.json`, alongside `rest-apis`). Evidence is `PROJECT_STRUCTURE` with the matched paths as source,
  strength = matched patterns / 5, and an explanation naming the directories. It is never derived from a language or
  framework. Only the `projectStructure` and `activity` signals apply, so the Phase 5 ceiling is 75 (both signals at full
  strength, breadth factor 0.75), and one-signal repositories cap at 50 × 0.5 = 25. Reaching a 50 minimum needs a
  near-complete backend layout plus strong recent activity — the same behaviour `rest-apis` already has. Existing
  repositories need re-analysis to gain this evidence.
- **Databases (`database-systems`) — unsupported.** `config/technologies.json` has no database technology at all (not
  even MongoDB or PostgreSQL), and a `models/` folder does not identify a database. A new dependency/config detector would
  be required, which is out of scope.
- **Testing (`software-testing`) — unsupported.** The only testing observation is test-file presence/naming, already
  attributed to `unit-testing`. Presence is not evidence of testing practice, and remapping it to the generic Testing
  requirement would only hide the gap, so it was not done. The role requirement keeps its meaning and is not remapped.

## Tests

- API: `skill-profile-endpoint.test.ts`, `analysis-run.test.ts` (auth, scoping, unknown skill, stable shape, empty and
  not-analyzed states, malformed stored data, excluded repositories, no fabricated repository identity).
- Web interaction: `App.interaction.test.tsx` (jsdom + Testing Library, real App/router/hooks/client, stubbed network):
  overview data, opening a skill, contributions and evidence, no-evidence, error + retry, sign-in, not-analyzed.
- Web: `features/skills/skills.test.tsx` (categories, scores, links, breakdowns, contributions, provenance, escaping,
  empty/loading/error states, no-zero-fabrication, terminology, no client-side scoring).

## Limitations

- The web app has no repository-selection or per-repository analysis UI; those remain API-only (Phases 2–3). Scoring
  can be triggered from the overview, but evidence must already exist.
- Evidence items carry no public identifier, so the per-signal `evidenceIds` are not cross-linked to evidence rows.
- Interaction tests run the real `<App/>` in jsdom against a stubbed `fetch`; there is no real-browser or live-backend
  end-to-end test.
- Databases and Testing never have evidence until detectors exist (out of scope); Backend is capped at 75 and realistically lower.
