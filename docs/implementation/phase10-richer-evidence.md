# Phase 10 — Richer Evidence Detection

Status: implemented. Scoring formulas, weights, thresholds, aggregation rules, `config/scoring.json` and `config/roles.json` are **unchanged**. Phase 10 only teaches the Phase 3 analyzer and Phase 4 evidence builder to recognise more things; the Phase 5 engine scores the resulting evidence exactly as it scores any other.

## What was already there

Audited before changing anything:

| Proposed | Status before Phase 10 |
|---|---|
| Express.js | Already detected (dependency, import and framework evidence) and mapped to `express`. **No change**; regression-tested. |
| Next.js | Already detected (dependency, `next.config.*`, import) and mapped to `nextjs`. **No change**; regression-tested. |
| Node.js, MongoDB, PostgreSQL | Skills existed in `config/skills.json` and `config/scoring.json` applicability, but no technology produced evidence for them. **Added.** |
| Integration testing | Skill existed; test-file evidence went only to `unit-testing`. **Added** as a separate observation. |

## Added

### Technologies (`config/technologies.json`)

| Technology | Skill | Dependency identifiers | Source imports |
|---|---|---|---|
| Node.js (`nodejs`, category `runtime`) | `nodejs` | `package.json`: `@types/node`, `nodemon`, `ts-node` | `node:*` imports/requires; `fs`, `fs/promises`, `child_process`, `worker_threads` |
| MongoDB (`mongodb`, `database`) | `mongodb` | `package.json`: `mongodb`, `mongoose`; Python: `pymongo`, `motor`, `mongoengine`; Go: `go.mongodb.org/mongo-driver` | the same packages in JS/TS, Python and Go |
| PostgreSQL (`postgresql`, `database`) | `postgresql` | `package.json`: `pg`, `postgres`, `pg-promise`; Python: `psycopg2`, `psycopg2-binary`, `psycopg`, `asyncpg`; Go: `github.com/lib/pq`, `github.com/jackc/pgx/v4`, `/v5` | the same packages in JS/TS, Python and Go |

Matching is exact (case-insensitive) on package names, so `pg-format`, `mongodb-memory-server` or `fs-extra` do not match. ORMs and query builders (Prisma, Sequelize, Knex) are **not** treated as proof of a specific database. Existing evidence types are used: `DEPENDENCY`, `SOURCE_FILE`, `README` (mention of the technology name) and `COMMIT_ACTIVITY`. `database-systems` and `software-testing` remain unmapped, as before.

### Integration-test evidence

`analyzeTests` additionally reports `integrationTestFilePaths` and `integrationTestSignal = min(files / 3, 1)`. A file counts only if it is **already a test file** (the unchanged Phase 3 rule: test directory or `.test.`/`.spec.`) **and** it sits under a directory named `integration`, `integration-tests`, `integration_tests` or `integrationtests`, or its file name contains the token `integration` (for example `orders.integration.test.ts`, `test_integration_db.py`). `src/integrations/slack.ts` and `reintegration.test.ts` do not match.

The evidence builder emits a `TEST` item for `integration-testing` (`observationKey: test:integration`) with `normalizedStrength = 0.5 × genericTestSignal + 0.5 × integrationTestSignal`, the same combination convention already used for per-technology test evidence. Nothing is emitted when there are no integration files.

**Strength caveat.** Half of the integration-testing strength is inherited from `genericTestSignal`, which reflects the share of *all* test files (unit and integration alike). A repository with many unit tests and only one integration-test file therefore receives a relatively generous strength: with a saturated generic signal (1.0) and one integration file (signal 1/3) the strength is about 0.58. This is the existing convention, not evidence that the repository has extensive integration-test coverage; the integration-specific half still reflects only the few files found.

`unit-testing` evidence is **unchanged**: it still counts every test file, including integration ones. Integration files are therefore counted for both skills.

### Test-framework observation (not scored)

`TestObservation.testFrameworks` lists Jest, Vitest, Mocha, pytest, testify and JUnit found in manifests (`config/technologies.json` → `testFrameworks`). It is recorded for transparency only. It produces no evidence and no score, because the scoring applicability matrix does not give `unit-testing` a `dependency` signal and that matrix is frozen. `supertest` and similar helpers are deliberately not treated as integration evidence (also used in unit-style tests).

## Not done (needs approval)

- **Richer documentation evidence.** The `documentation` signal is `0.5 × README present + 0.5 × technology mention`, and documentation has a fixed weight in `config/scoring.json`. Distinguishing "README only" from a `docs/` tree would require changing that signal or the scoring model, which is frozen. Nothing was added.
- **CI/CD, SQL, Databases and Testing role skills** are out of scope.

## Versioning

No configuration version was bumped. `scoringVersion` (`config/scoring.json`) and `roleCatalogVersion` (`config/roles.json`) track scoring formulas and role definitions, and neither file changed. `config/technologies.json` has no version field. The scoring config hash of runs is unchanged. As with earlier detector changes, **existing repositories must be re-analysed** to gain the new evidence.

## Expected score differences

Only repositories whose analysis now contains the new evidence change, and only by gaining scores for the new skills; no pre-existing skill score moves. On the reference fixture in `apps/api/tests/evidence/phase10-evidence.test.ts` (React + FastAPI repository, then adding `mongoose`, `pg`, `@types/node`, PostgreSQL imports and one integration test file):

| Skill | Before | After |
|---|---|---|
| `postgresql` | none | 60.00 |
| `integration-testing` | none | 43.75 |
| `mongodb` | none | 31.25 |
| `nodejs` | none | 31.25 |
| all other skills | unchanged | identical (asserted) |

For real users this can change gap-analysis output: roles that require Node.js, MongoDB or PostgreSQL (Full-Stack Developer, Backend Engineer) previously saw those skills as having no evidence and may now show partial scores.

## Limitations

- Node.js is detected only from the dependency identifiers and `node:`/core-module imports above. An Express app without `@types/node`, `nodemon` or `ts-node` and without sampled core-module imports will not get Node.js evidence; Node.js is deliberately not inferred from Express or from a bare `package.json`.
- Source imports are read from the bounded sample of at most five source files, so database/Node usage can be under-counted in large repositories.
- Manifest support is unchanged (`package.json`, `requirements.txt`, `pyproject.toml`, `go.mod`, `pom.xml`); no Java or Maven database drivers were added.
- Integration tests are recognised by naming and directory convention only; file contents are not inspected, and tests in Go `_test.go` or other layouts the Phase 3 test rule does not recognise are not seen.
- No `.nvmrc` / `.node-version` detection: config files share a two-file fetch budget and adding patterns could displace `next.config.*` or `manage.py`.
