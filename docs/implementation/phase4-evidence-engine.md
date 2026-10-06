# Phase 4 — Evidence Engine

Turns Phase 3 **observations** into normalized, provenance-rich
**EvidenceItems**. It answers "which supported skill does this observable
thing provide evidence for?". It calculates no skill score, matches no roles,
runs no gap analysis and calls no LLM — those are later phases.

```
Phase 3 RepositoryAnalysis          (observations; no GitHub access here)
  -> buildEvidence()                (apps/api/src/evidence/evidence-builder.ts)
       technology / language / observation -> skill mapping (config)
       normalization, provenance, explanation, identity key
  -> evidenceItemSchema validation  (packages/domain)
  -> replaceRepositoryEvidence()    (upsert by key, then delete stale)
  -> MongoDB `repositoryEvidence`
```

## Configuration (single sources of truth)

| File | Contents |
| --- | --- |
| `config/skills.json` | Skill taxonomy (Software Engineering → 8 categories → 26 skills). |
| `config/technologies.json` | Technology identity (Phase 3) plus Phase 4 mappings: per-technology `skillIds`, `languageSkills`, and `observationSkills` (docker, generic testing, structure categories). |

`apps/api/src/evidence/evidence-config.ts` loads both and cross-validates that
every referenced skill exists (`INVALID_SKILL_CONFIGURATION` /
`INVALID_TECHNOLOGY_MAPPING`). Pure taxonomy types and validation live in
`packages/domain` (`parseSkillTaxonomy`).

A technology with an empty `skillIds` (currently Django, Flask, Spring Boot,
Gin — none are in the frozen taxonomy) produces **no evidence**; it is reported
in `unmappedTechnologies`. No skill is ever invented or guessed.

## Evidence types and signals

`EVIDENCE_TYPE_SIGNAL` (`packages/domain/src/evidence`) is the only place the
type → signal relation is defined:

| Evidence type | Signal | Source observation | `normalizedStrength` |
| --- | --- | --- | --- |
| DEPENDENCY | dependency | each mapped dependency | 1 (presence) |
| FRAMEWORK | framework | each detected, mapped framework | 1 (presence) |
| SOURCE_FILE | sourceUsage | per-technology source usage | Phase 3 `sourceUsage` (reused) |
| LANGUAGE | sourceUsage | language bytes → programming skill | `bytes / totalBytes` |
| PROJECT_STRUCTURE | projectStructure | matched structure category | matched patterns / configured patterns |
| DOCKER | projectStructure | each Dockerfile / compose file | 1 (presence) |
| TEST | testing | generic test presence; per-technology tests | generic: Phase 3 `genericTestSignal`; per-technology: `0.5*generic + 0.5*skillSpecific` |
| README | documentation | README mentions a technology | Phase 3 `documentationSignal` (reused) |
| COMMIT_ACTIVITY | activity | recent commits | Phase 3 `activity` (reused) |

Strength is always in `[0, 1]` and is evidence strength, **not** a score.
Out-of-range inputs are clamped; non-finite inputs produce no item.

Language never implies a framework (TypeScript ≠ React, Python ≠ FastAPI).

COMMIT_ACTIVITY is repository-level, but an item must name exactly one skill,
so the observation is attached once to each skill that already has other
evidence in the repository.

## Provenance and explanations

`sourcePath` is set only when a real repository path exists (manifest, source
file, structure directory, Dockerfile, README, first test file).
`sourceReference` carries broader references (`runtime:react`,
`github:languages`, `github:commits:last-90-days`, lists of paths). Nothing is
fabricated: per-technology test evidence has no path because Phase 3 records
only a count. Explanations are deterministic, factual strings built from the
observation (e.g. "React is declared as a runtime dependency in package.json.")
and make no expertise claims.

## Identity, deduplication and idempotency

`buildEvidenceKey` = `skillId | evidenceType | sourcePath | observationKey`
(`packages/domain`). Timestamps, strengths and explanations are excluded.
Output is sorted (skill, type, path, observation) and exact duplicate keys
collapse, while distinct provenance (e.g. two manifests) is kept.

Persistence (`apps/api/src/services/evidence.service.ts`): bulk upsert by
`(userId, repositoryId, evidenceKey)`, then delete keys of that repository that
are no longer produced. No transactions, queues or workers.

## Persistence model

`repositoryEvidence` (`apps/api/src/models/evidence.model.ts`): userId,
repositoryId, skillId, evidenceType, signal, value (string | number),
normalizedStrength (0..1), sourcePath?, sourceReference?, explanation,
evidenceKey, detectedAt. Indexes: unique `(userId, repositoryId, evidenceKey)`
and `(userId, skillId, repositoryId)`.

## API

- `POST /api/analysis/repositories/:id` — unchanged contract plus an additive
  `data.evidence` field `{ items, unmappedTechnologies }`; evidence is
  persisted as part of the same call.
- `GET /api/skills/:id/evidence[?repositoryId=]` — the authenticated user's
  evidence for a skill (user taken from the session only).

## Known limitations

- Phase 3 recognizes only the eight technologies in `technologies.json`, so
  taxonomy skills without a Phase 3 detector (Node.js, MongoDB, PostgreSQL,
  SQL, PyTorch, TensorFlow, CI/CD, Integration Testing, AI skills other than
  via project structure) cannot yet receive evidence. Adding a technology is a
  config change in `technologies.json`; it was left out because it would alter
  Phase 3 detection (an existing Phase 3 test asserts `torch` is unrecognized).
- Generic test evidence is attached to Unit Testing by naming convention only;
  Integration Testing cannot be distinguished.
- Structure categories map to a single skill each (frontend → UI Development,
  backend → REST APIs, ml → Model Development, ai → LLM Applications).
