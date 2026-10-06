# Phase 5 — Deterministic Scoring Engine

Converts Phase 4 **EvidenceItems** into deterministic, mathematically defined skill scores. It answers "how strongly does the observable evidence support this skill?". It does not match roles, run gap analysis, or call an LLM — those are later phases.

```
Phase 4 EvidenceItems
  -> scoreUserEvidence()                (apps/api/src/services/scoring.service.ts)
       load evidence, group by (repository, skill)
       load scoring config (config/scoring.json)
  -> scoreSkills()                       (packages/domain/src/scoring/engine.ts)
       signal aggregation (max strength per signal)
       BaseScore calculation
       BreadthFactor
       RepositorySkillScore
       RepositorySubstance
       top-5 repository selection
       rank multiplier
       contribution weight
       FinalSkillScore
  -> MongoDB `analyses`                 (apps/api/src/models/analysis.model.ts)
```

## Phase purpose

Transform normalized evidence into reproducible skill evidence scores. The scoring engine is:

- **Deterministic**: Same evidence + same configuration always produces identical scores
- **Mathematically defined**: Every formula is explicit and implemented exactly as specified
- **Traceable**: Every score can be reconstructed from the full breakdown
- **Independent of GitHub**: No GitHub API calls; scoring works on already-persisted evidence
- **Independent of time**: Timestamps never influence score calculation
- **Independent of order**: Input order does not affect results

## Inputs

### Primary input

Phase 4 EvidenceItems, persisted in MongoDB `repositoryEvidence` collection:

```typescript
{
  evidenceId: string
  repositoryId: string
  skillId: string
  signal: SignalType
  normalizedStrength: number  // [0, 1]
}
```

### Repository observations

Phase 3 repository-level counts, stored in `RepositoryModel.scoringObservations`:

```typescript
{
  sourceFileCount: number
  relevantStructureSignalCount: number
}
```

These are populated during Phase 3 analysis (`apps/api/src/services/github-analysis.service.ts`) so scoring never has to re-run the analyzer or call GitHub.

### Configuration

Single source of truth: `config/scoring.json`:

- `signalWeights`: Weight per signal (must sum to 1.0)
- `meaningfulSignalThreshold`: Minimum strength for a signal to be "meaningful" (0.25)
- `breadthFactors`: Tiers mapping meaningful signal count to BreadthFactor
- `repositorySubstance`: Parameters for repository substance calculation
- `aggregation`: Top-N limit (5) and rank decay (0.6)
- `applicability`: Skill → applicable signals matrix (A_k(r,s))

Configuration is loaded and validated by `apps/api/src/scoring/scoring-config.ts` using domain validation from `packages/domain/src/scoring/config.ts`.

## Outputs

### ScoringResult

Full structured result (`packages/domain/src/scoring/engine.ts`):

```typescript
{
  scoringVersion: string
  repositorySubstances: RepositorySubstanceResult[]
  repositorySkillScores: RepositorySkillScoreResult[]
  skillScores: SkillScoreResult[]
}
```

### Persisted analysis

MongoDB `analyses` collection (`apps/api/src/models/analysis.model.ts`):

```typescript
{
  userId: ObjectId
  scoringVersion: string
  scoringConfigHash: string  // SHA-256 of configuration
  repositoryIds: ObjectId[]
  evidenceCount: number
  result: ScoringResult
  createdAt: Date
  updatedAt: Date
}
```

## Signal weights

The frozen weights (sum to 1.0):

| Signal | Weight |
|--------|--------|
| dependency | 0.20 |
| framework | 0.20 |
| sourceUsage | 0.25 |
| projectStructure | 0.10 |
| testing | 0.10 |
| documentation | 0.05 |
| activity | 0.10 |

Configuration validation enforces this sum within floating-point tolerance (1e-9). Invalid configuration fails with `ScoringConfigError`; it is never silently normalized.

## Applicability matrix

Not every signal applies to every skill. The configuration defines for each skill which signals are applicable:

```json
{
  "applicability": {
    "react": ["dependency", "framework", "sourceUsage", "testing", "documentation", "activity"],
    "unit-testing": ["testing", "activity"],
    "python": ["sourceUsage", "activity"]
  }
}
```

For a repository `r` and skill `s`:

- `A_k(r,s) = 1` if signal `k` is applicable to skill `s`
- `A_k(r,s) = 0` otherwise

**Critical**: Non-applicable signals do not affect the BaseScore denominator. A skill is not penalized for missing evidence for signals that don't apply to it.

## BaseScore formula

For a repository `r` and skill `s`:

```
BaseScore(r,s) = 100 × [ Σ(W_k × A_k(r,s) × E_k(r,s)) / Σ(W_k × A_k(r,s)) ]
```

Where:

- `W_k` = weight of signal `k`
- `A_k(r,s)` = 1 if signal `k` applies to skill `s`, 0 otherwise
- `E_k(r,s)` = evidence strength for signal `k` (max normalizedStrength among evidence items)

If `Σ(W_k × A_k(r,s)) = 0` (no applicable signals), then `BaseScore(r,s) = 0`.

### Signal aggregation

Multiple EvidenceItems may exist for the same (repository, skill, signal). The engine uses the maximum:

```
E_k(r,s) = max(normalizedStrength of evidence items for signal k)
```

This is deterministic and prevents double-counting. The breakdown reports the count and IDs of all evidence items for traceability.

## BreadthFactor

Counts how many applicable signals have meaningful evidence (strength ≥ 0.25):

```
C(r,s) = count of k where A_k(r,s) = 1 and E_k(r,s) >= 0.25
```

BreadthFactor tiers:

| Meaningful signals | BreadthFactor |
|-------------------|---------------|
| 0 | 0.50 |
| 1 | 0.50 |
| 2 | 0.75 |
| 3+ | 1.00 |

This protection prevents a single isolated signal from producing an unjustifiably high score:
- One meaningful signal: maximum effective score = 50
- Two meaningful signals: maximum effective score = 75
- Three or more meaningful signals: maximum effective score = 100

## RepositorySkillScore

```
RepositorySkillScore(r,s) = BaseScore(r,s) × BreadthFactor(C(r,s))
```

Clamped to [0, 100].

## RepositorySubstance

Observable project surface, NOT a quality score. Based on Phase 3 observations:

```
sourceDepth = min( log(1 + sourceFileCount) / log(1 + 50), 1 )
structureDepth = min( relevantStructureSignalCount / 5, 1 )
substanceRaw = 0.70 × sourceDepth + 0.30 × structureDepth
RepositorySubstance(r) = 0.25 + 0.75 × substanceRaw
```

Therefore `RepositorySubstance ∈ [0.25, 1.0]`.

**Important**: This does NOT represent code quality, engineering ability, or production readiness. It only measures observable repository surface.

## Cross-repository aggregation

For each skill:

1. Calculate RepositorySkillScore for every repository with evidence
2. Remove zero-score repositories
3. Sort by RepositorySkillScore descending (ties broken by repositoryId)
4. Keep only top 5 repositories

### Rank multiplier

For repository at rank `i` (1-based):

```
RankMultiplier(i) = 0.60^(i-1)
```

Values:
- Rank 1: 1.0
- Rank 2: 0.6
- Rank 3: 0.36
- Rank 4: 0.216
- Rank 5: 0.1296

### Contribution weight

```
ContributionWeight(r_i, s) = RepositorySubstance(r_i) × RankMultiplier(i)
```

### Final skill score

```
FinalSkillScore(s) = Σ(RepositorySkillScore(r_i, s) × ContributionWeight(r_i, s)) / Σ(ContributionWeight(r_i, s))
```

Clamped to [0, 100].

**Behavior**:
- One repository with evidence: FinalSkillScore = that repository's RepositorySkillScore
- Two repositories: weighted average of both
- Ten repositories: only top five contribute
- Repository ranking is by RepositorySkillScore (not by stars, size, or popularity)
- RepositorySubstance affects contribution weight, not ranking order

## Precision and rounding

No intermediate rounding occurs. Calculations use full floating-point precision:

1. raw BaseScore
2. × BreadthFactor
3. = raw RepositorySkillScore
4. aggregation with weights
5. = raw FinalSkillScore
6. clamp to [0, 100]
7. presentation rounding only (when displaying to user)

Stored scores preserve calculation precision for reproducibility.

## Determinism guarantees

The following produce identical scores:

- Same EvidenceItems
- Same scoring configuration
- Same repository metadata
- Different input order
- Different MongoDB retrieval order
- Different timestamps
- Repeated execution

Mechanisms:
- All output lists are explicitly sorted (by repositoryId, skillId, signal)
- SIGNAL_TYPES is a fixed tuple (summation order is deterministic)
- Evidence grouping uses Maps with string keys
- Timestamps are excluded from ScoringEvidence input type
- No random IDs or current time references

## Traceability

Every score includes a full breakdown:

### RepositorySkillScoreResult

```typescript
{
  repositoryId: string
  skillId: string
  signals: SignalBreakdown[]  // All 7 signals, even non-applicable
  applicableWeightSum: number
  baseScore: number
  meaningfulSignalCount: number
  breadthFactor: number
  score: number
}
```

### SignalBreakdown

```typescript
{
  signal: SignalType
  weight: number
  applicable: boolean
  strength: number  // E_k(r,s)
  meaningful: boolean
  evidenceCount: number
  evidenceIds: string[]  // All evidence IDs, sorted
}
```

### SkillScoreResult

```typescript
{
  skillId: string
  score: number
  contributions: SkillContribution[]
  excludedByRank: ExcludedRepository[]  // Repositories ranked below top-5
  contributionWeightSum: number
}
```

### SkillContribution

```typescript
{
  repositoryId: string
  rank: number
  repositorySkillScore: number
  repositorySubstance: number
  rankMultiplier: number
  contributionWeight: number
}
```

This structured data allows reconstruction of every calculation step without natural-language AI explanations.

## Domain package architecture

Pure scoring functions live in `packages/domain/src/scoring/`:

- `config.ts`: Configuration schema and validation (`parseScoringConfig`)
- `engine.ts`: Pure mathematical functions
  - `breadthFactor()`
  - `rankMultiplier()`
  - `computeRepositorySubstance()`
  - `scoreRepositorySkill()`
  - `aggregateSkill()`
  - `scoreSkills()`

These functions have:
- No I/O
- No clock
- No randomness
- No GitHub
- No LLM
- No Express
- No MongoDB

The API layer (`apps/api/src/services/scoring.service.ts`) handles:
- Evidence retrieval from MongoDB
- Configuration loading
- Domain scoring orchestration
- Result persistence
- Error mapping

## Persistence

### Analysis model

`apps/api/src/models/analysis.model.ts`:

```typescript
{
  userId: ObjectId
  scoringVersion: string
  scoringConfigHash: string  // SHA-256 for reproducibility
  repositoryIds: ObjectId[]
  evidenceCount: number
  result: ScoringResult  // Full structured breakdown
  createdAt: Date
  updatedAt: Date
}
```

### Repository model

`apps/api/src/models/repository.model.ts` extended with:

```typescript
{
  scoringObservations: {
    sourceFileCount: number
    relevantStructureSignalCount: number
  }
}
```

Populated during Phase 3 analysis by `apps/api/src/services/github-analysis.service.ts`.

## API

### Service

`apps/api/src/services/scoring.service.ts`:

```typescript
scoreUserEvidence(userId: string): Promise<ScoredAnalysis>
```

Orchestrates:
1. Load user's analyzed repositories
2. Filter to repositories with scoringObservations
3. Load evidence for those repositories
4. Call domain `scoreSkills()`
5. Persist Analysis document
6. Return result

### Controller/Route

Not yet implemented. The existing comment in `apps/api/src/routes/analysis.routes.ts` states:

> `POST /api/analysis/run` is reserved for the later full scoring/role-match pipeline

The scoring service is available for future orchestration. Phase 5 does not require an HTTP endpoint to be complete.

## Error handling

Uses existing error architecture (`apps/api/src/utils/errors.ts`):

- `INVALID_SCORING_CONFIGURATION`: Config validation failed
- `NO_EVIDENCE`: No evidence available to score
- `INVALID_EVIDENCE`: Evidence data violates scoring engine constraints

Domain errors:
- `ScoringConfigError`: Configuration schema or invariant violation
- `ScoringInputError`: Evidence strength out of [0,1], unknown skill/signal, missing observations

## Configuration validation

Validated at startup/load time by `parseScoringConfig()`:

1. All required signal weights exist
2. Every weight is numeric and ≥ 0
3. Total weight = 1 within tolerance (1e-9)
4. Applicability references valid signal IDs
5. All skill IDs in applicability exist in taxonomy
6. Every skill in taxonomy has applicability defined
7. No duplicate signals in applicability
8. Breadth tiers are strictly ascending
9. First breadth tier starts at 1
9. BreadthFactors.noMeaningfulSignal ≤ first tier factor
10. Substance depth weights sum to 1
11. Substance floor + span = 1
12. Top-N is positive
13. Rank decay is in (0, 1]

Invalid configuration fails with `ScoringConfigError`. It is never silently repaired.

## Tests

### Domain tests (`packages/domain/tests/scoring.test.ts`)

62 tests covering:

- Configuration loading and validation
- Signal weight sum invariant
- Malformed configuration rejection
- Repository skill score calculation
- BaseScore with no applicable signals
- Non-applicable signal exclusion
- BreadthFactor tiers
- Single-signal protection (caps at 50, 75, 100)
- Threshold boundary (0.25)
- Evidence aggregation (max, no double-counting)
- No intermediate rounding
- Repository substance formula
- Cross-repository aggregation
- Top-5 selection
- Rank multiplier calculation
- Repository ranking (score then repositoryId)
- Zero-score repository exclusion
- Determinism (input order independence)
- Repeated execution identity
- Evidence timestamp exclusion
- Invalid evidence rejection
- Unknown skill/signal rejection
- Score clamping to [0, 100]

### API tests (`apps/api/tests/scoring-service.test.ts`)

6 tests covering:

- Configuration loading and caching
- User scoping (every query includes userId)
- Repository observation requirement
- Skipped repositories (analyzed before Phase 5)
- Evidence loading and transformation
- Analysis persistence with config hash
- MongoDB retrieval order independence
- NO_EVIDENCE error handling
- INVALID_EVIDENCE error handling

## Explicit non-goals

Phase 5 deliberately does NOT:

- Calculate role matching (Software Engineer, Full-Stack Developer, etc.)
- Run gap analysis (deficits, critical gaps, role readiness)
- Call LLMs (Gemini, Groq, OpenAI, Claude, etc.)
- Build skill graph UI
- Generate natural-language explanations
- Make expertise claims
- Infer professional proficiency
- Assess job eligibility
- Refetch GitHub data
- Re-run repository analysis
- Execute repository code
- Evaluate code quality
- Measure project quality
- Assess production readiness

## Known limitations

- Source usage and skill-specific test signals are computed over the bounded Phase 3 sample (at most ~5 files), not full repository coverage. This is intentional (API budget) and the scoring system does not hide this limitation.
- Repositories analyzed before Phase 5 (without `scoringObservations`) cannot be scored until re-analyzed. They are reported in `skippedRepositoryIds`.
- Generic test evidence (from Phase 3) is attached to Unit Testing by naming convention only; Integration Testing cannot be distinguished at the evidence level.
- Structure categories map to a single skill each (frontend → UI Development, backend → REST APIs, ml → Model Development, ai → LLM Applications).
- No HTTP endpoint for scoring is implemented in this phase; the service is available for future pipeline orchestration.
