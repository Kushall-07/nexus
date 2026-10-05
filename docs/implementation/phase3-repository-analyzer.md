# Phase 3 — Repository Analyzer

Converts raw GitHub repository data into normalized, deterministic
**observations**. It does not score skills, match roles, run gap analysis,
or call an LLM — those are later phases. The question this phase answers is
"what observable evidence exists in this repository?", never "how skilled
is this developer?".

## Pipeline

```
GitHub Raw Data
  -> Language Analyzer
  -> Dependency Analyzer (package.json / requirements.txt / pyproject.toml / go.mod / pom.xml)
  -> Framework Detector
  -> Source Usage Analyzer
  -> Structure Analyzer
  -> Docker Analyzer
  -> Test Analyzer
  -> Documentation Analyzer
  -> Activity Analyzer
  -> Normalized RepositoryAnalysis (apps/api/src/analyzer/types.ts)
```

Orchestrated by `analyzeRepository()` in
`apps/api/src/analyzer/repository-analyzer.ts`. Each analyzer is a pure
function over already-fetched data — no analyzer performs its own network
I/O, which is what keeps them independently unit-testable.

## Entry points

- `apps/api/src/analyzer/repository-analyzer.ts` — pure orchestration, no
  Express dependency. Callable directly from tests or other services.
- `apps/api/src/services/github-analysis.service.ts` — ownership-scoped and
  selection-scoped wrapper (a repository must belong to the requesting user
  **and** have been explicitly selected via the Phase 2 selection flow).
- `POST /api/analysis/repositories/:id` — the only HTTP surface Phase 3
  exposes. `POST /api/analysis/run` (the full scoring/role-matching
  pipeline) is reserved for a later phase and is intentionally not
  implemented here.

## GitHub request budget

Every GitHub call for one repository analysis shares a single
`RequestBudget` (reused unmodified from Phase 2, `MAX_REQUESTS_PER_REPOSITORY`,
default 10). All fetching happens in `repository-fetcher.ts`, in this fixed,
deterministic order:

1. Repository tree (`git/trees/{branch}?recursive=1`) — always fetched, the
   single source of truth for every later selection decision.
2. Languages — reused from the cached Phase 2 value when available, costing
   zero extra requests.
3. Up to 2 supported manifests, selected from the tree by priority
   (`package.json` > `requirements.txt` > `pyproject.toml` > `go.mod` >
   `pom.xml`), then shallowest path, then alphabetical.
4. Up to 2 framework config files (e.g. `next.config.js`, `manage.py`).
5. The README, if present (`README`/`README.md`/`README.markdown`/`README.txt`,
   shallowest match wins).
6. Recent commits (`/commits?since=<90 days ago>&per_page=100`), one request.
7. Remaining budget (up to 5 files) is spent sampling candidate source files
   for import-reference detection — shallowest-path-first, alphabetical,
   never random.

Every optional step checks `budget.canConsume(1)` first and degrades to a
`skipped_budget` file status instead of throwing. Only the mandatory tree
fetch can fail the whole analysis. There is no retry loop and no recursive
crawling: a missing optional file is simply absent, once.

## File safety

Untrusted repository content never gets executed, evaluated, or installed —
this is static text analysis only (`apps/api/src/analyzer/file-safety.ts`):

- **Size limit**: 1 MB (`MAX_PARSED_FILE_SIZE_BYTES`). Checked against the
  tree-reported size *before* spending a GitHub request wherever possible;
  re-checked against the actual Contents API response size as well.
- **Binary rejection**: known binary extensions are skipped before any
  fetch; decoded content is additionally scanned for a NUL byte as a binary
  heuristic.
- **Defensive parsing**: `package.json` (JSON.parse), `pyproject.toml`
  (`smol-toml`), and `pom.xml` (`fast-xml-parser`, validated with
  `XMLValidator` before parsing — neither library resolves external
  entities, so this stays immune to XXE) all return a structured
  `MALFORMED_MANIFEST` warning on failure rather than throwing. One bad file
  never aborts the rest of the analysis.

## Technology configuration

`config/technologies.json` is the single source of truth for technology
identity: dependency identifiers per manifest type, source-import regex
patterns, applicable file extensions, and framework config-file patterns.
Loaded and cached once per process by
`apps/api/src/analyzer/technology-config.ts`. No technology name is
hardcoded into analyzer logic — adding a technology means editing the JSON
file, not the code.

## Framework detection

A framework is reported only when **concrete evidence** exists: a matching
dependency, a matching config file, or a matched import pattern inside a
sampled source file. Language presence alone is never sufficient — there is
deliberately no "TypeScript implies React" branch anywhere in
`framework-detector.ts` (see its dedicated test case asserting this).

## Formulas (signals, not scores)

All formulas below produce a bounded `[0, 1]` signal. Phase 3 computes and
stores the signal *and* the raw counts behind it; nothing here is a skill
score, and no formula from Phase 5 (BaseScore, BreadthFactor,
RepositorySubstance, etc.) is implemented.

**Source usage** (`source-usage-analyzer.ts`), per technology, over the
bounded sample of fetched source files:

```
importSignal    = min(importReferenceCount / 3, 1)
fileUsageSignal = min(relevantSourceFileCount / 10, 1)
sourceUsage     = 0.60 * importSignal + 0.40 * fileUsageSignal
```

`relevantSourceFileCount` counts only files *within the sample* that
actually matched an import pattern — not every file of the right language
in the tree, since the whole point of the bounded sample is that we never
fetch every file. `bounded: true` on the observation means the tree had
more language-plausible candidate files than the request budget allowed us
to inspect.

**Testing** (`test-analyzer.ts`), derived entirely from the tree (path
conventions, no content fetch required):

```
testRatio              = testFiles / sourceFiles            (0 if sourceFiles = 0)
genericTestSignal      = min(testRatio / 0.20, 1)
skillSpecificTestSignal= min(skillReferencedTestFiles / 3, 1)
testing                = 0.50 * genericTestSignal + 0.50 * skillSpecificTestSignal   (computed by Phase 4/5)
```

**Documentation** (`documentation-analyzer.ts`), per technology:

```
documentation = 0.5 * readmePresence + 0.5 * skillMention
```

**Activity** (`activity-analyzer.ts`), over a fixed 90-day window
(`ACTIVITY_WINDOW_DAYS`):

```
recentCommitSignal = min(recentCommitCount / 20, 1)
activeDaySignal     = min(activeDays / 10, 1)
activity            = 0.5 * recentCommitSignal + 0.5 * activeDaySignal
```

## Normalized output

`RepositoryAnalysis` (`apps/api/src/analyzer/types.ts`) is the single,
JSON-serializable, deterministic shape every analyzer contributes to.
Arrays are always sorted (by technology id, path, etc.) so identical GitHub
input produces byte-identical output, aside from two wall-clock fields
(`analyzedAt`, `activity.sinceDate`) that are a deterministic function of
*when* the analysis ran, not of randomness or request ordering.

Every dependency/framework observation carries real provenance
(`sourcePath` + `sourceReference`, e.g. the actual matched import line) —
nothing is fabricated.

## What Phase 3 deliberately does not do

- No skill scores, no BaseScore/BreadthFactor/RepositorySubstance, no role
  matching, no gap analysis, no LLM calls.
- No execution of repository code: no `npm install`, no running tests, no
  building Docker images, no executing Dockerfiles/Makefiles. Docker and
  test detection are presence/path heuristics only.
- No manifest types beyond the five listed above (`Cargo.toml`, `Gemfile`,
  `composer.json`, `build.gradle` are flagged with an `UNSUPPORTED_MANIFEST`
  warning when present, never parsed).
- No private repositories, no unbounded crawling, no caching/cooldown
  system beyond the existing `analyzed`/`analyzedAt` fields Phase 2 already
  defined.

## Known limitations

- Source usage and skill-specific test signals are computed over a bounded
  sample (at most ~5 files, budget-permitting), not full repository
  coverage. This is intentional (API budget), and `bounded: true` on the
  relevant observations makes the partial coverage explicit rather than
  silently treating "not sampled" as "does not exist".
- `pyproject.toml` support covers `[project.dependencies]`,
  `[project.optional-dependencies]`, `[dependency-groups]`, and legacy
  `[tool.poetry.dependencies]` — not every possible PEP 621/Poetry
  variation.
