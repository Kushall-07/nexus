# Phase 6D — Security and Reliability Report

**Date:** 2026-11-07  
**Branch:** main  
**HEAD at audit start:** 991951b  
**HEAD after Phase 6D fixes:** (local, not yet committed — awaiting approval)  
**Engineer:** Claude Sonnet 4.6

---

## Executive Summary

A comprehensive security and reliability audit of the NEXUS monorepo was conducted prior to controlled private beta. The audit covered authentication/authorization, security headers, rate limiting, MongoDB lifecycle, resume upload security, dependency hygiene, observability, and API reliability.

**Result:** No P0 (critical) issues found. One P1 (high) issue resolved. Four P2 (medium) CVEs resolved via patch-level dependency upgrades (zod, vite, qs, follow-redirects). All P3 items documented.

The application is **production-ready from a security and reliability standpoint**, subject to the deployment-approval boundary described in Phase 6E.

---

## Scope

| Area | Status |
|---|---|
| Authentication & authorization | Audited |
| Security headers (CSP, HSTS, etc.) | Audited |
| Rate limiting and abuse protection | Audited |
| MongoDB connection lifecycle | Audited |
| Backup/restore readiness | Documented |
| Data lifecycle and migration | Audited |
| API reliability (timeouts, partial failure) | Audited |
| Observability (logging, health, correlation IDs) | Audited |
| Resume upload security | Audited |
| Dependency and supply-chain security | Audited + Fixed |
| Failure-recovery tests | Reviewed |
| Frozen business logic | Verified unchanged |

---

## Findings Register

### P0 — Critical (blocks production)

**None found.**

---

### P1 — High (should be resolved before private beta)

#### P1-01: No unhandled promise rejection / uncaught exception handlers
- **File:** `apps/api/src/server.ts`
- **Description:** The API process had no `process.on("unhandledRejection")` or `process.on("uncaughtException")` handlers. Any async error that escaped all try/catch boundaries would crash the process without a structured log entry, leaving no observable trace for incident response.
- **Risk:** Silent crashes under unexpected third-party callback errors; no log correlation possible.
- **Remediation:** Added structured `logger.error` handlers for both events with safe message sanitisation (never logs full stack or secrets). Process exits cleanly after logging.
- **Status:** ✅ RESOLVED — `apps/api/src/server.ts` updated.

---

### P2 — Medium (should be addressed when justified)

#### P2-01: Zod < 4.6.6 — memory exhaustion via oversized constrained collections
- **CVE:** GHSA-mrhx-c7xc-m3w5
- **Severity:** High (npm audit classification)
- **Package:** `zod` 4.6.5 (direct dependency of `apps/api`)
- **Description:** Zod can exhaust available memory when validating oversized constrained collections (e.g. `z.array().min().max()` with extremely large inputs). An attacker with API access could craft a request body that triggers this path.
- **Risk:** Denial-of-service via memory exhaustion on a validation endpoint.
- **Remediation:** Upgraded `zod` from 4.6.5 → 4.6.7 via `npm audit fix`. Patch-level, non-breaking.
- **Status:** ✅ RESOLVED — `package-lock.json` updated.

#### P2-02: Vite < 8.3.6 — multiple dev-server vulnerabilities
- **CVEs:** GHSA-698v-4r3x-3vcv, GHSA-r825-w8mm-5pxw, GHSA-587h-7wmj-h5pm, GHSA-9jrq-w75r-8gcw, GHSA-rq7h-c2jc-7f22, GHSA-vfpm-58rq-9qcg
- **Package:** `vite` 8.3.2 (`apps/web` devDependency)
- **Description:** Multiple issues in Vite's dev server: CLI argument escaping on Windows, cross-origin script execution via custom middleware, and file-serving path bypass.
- **Impact on production:** Vite is a **build tool and dev server only**. The production frontend is served as static files from a CDN or static host — Vite is not running in production. These vulnerabilities only affect developers running `npm run dev`.
- **Remediation:** Upgraded `vite` from 8.3.2 → 8.3.6 via `npm audit fix`. Patch-level, dev-only.
- **Status:** ✅ RESOLVED — `package-lock.json` updated.

#### P2-03: `qs` 6.16.0 — DoS via stringify with arrayFormat 'comma'
- **CVE:** GHSA-6pq8-jhm2-2vcw
- **Package:** `qs` 6.16.0 (transitive — pulled in by `express` and other dependencies)
- **Description:** `qs.stringify` with `arrayFormat: 'comma'` throws an uncaught TypeError when an array element has a non-callable own `toString`. NEXUS does not call `qs.stringify` directly; this only affects code paths that use `qs` internally.
- **Resolution:** `npm audit fix` resolved this by updating the lockfile entry.
- **Status:** ✅ RESOLVED — `package-lock.json` updated.

#### P2-04: `follow-redirects` 1.16.0–1.16.1 — cross-realm sensitive header disclosure
- **CVE:** GHSA-mrwp-f3q8-3g9p
- **Package:** `follow-redirects` 1.16.1 (transitive)
- **Description:** Cross-realm `sensitiveHeaders` arrays are discarded on redirect, potentially sending credentials to a redirect target.
- **Resolution:** `npm audit fix` resolved this.
- **Status:** ✅ RESOLVED — `package-lock.json` updated.

---

### P3 — Low (future improvement)

#### P3-01: `server.ts` startup logging uses `console.log` / `console.error`
- **File:** `apps/api/src/server.ts` lines 14, 18, 22, 32, 39
- **Description:** Startup messages (port announcement, shutdown signal, LLM warning) use `console.log`/`console.error` rather than the structured `logger`. This means those lines are not in JSON format and cannot be parsed by a log aggregator.
- **Impact:** Minor; these messages fire once at startup/shutdown, not on every request.
- **Recommendation:** Migrate `console.*` calls in `server.ts` to `logger.*` in a future cleanup pass.
- **Deferral reason:** Scope-limited to avoid unnecessary refactoring during Phase 6D.

#### P3-02: In-memory rate limiting — single-instance only
- **Files:** `apps/api/src/middleware/rate-limit.ts`
- **Description:** Rate limit state is stored in per-process Maps. If multiple API instances are deployed (horizontal scaling), each instance enforces limits independently. A coordinated attacker targeting different instances could send N×limit requests in a window.
- **Impact for private beta:** Acceptable. The private beta uses a single-instance deployment.
- **Recommendation:** If the application scales to multiple instances, replace with a Redis-backed rate limiter (e.g. `rate-limiter-flexible`). Document as a known limitation in deployment guide.
- **Deferral reason:** No multi-instance deployment planned for private beta.

#### P3-03: Cross-instance session revocation — best-effort only
- **Files:** `apps/api/src/services/session.service.ts`
- **Description:** Logout writes the revocation to MongoDB and to the in-memory revocation set for the current process. Other instances only see the revocation on restart (they load from MongoDB at startup). Until restart, a revoked token remains valid for requests hitting other instances.
- **Impact for private beta:** Acceptable. Single-instance deployment means no cross-instance gap.
- **Recommendation:** Document as a known limitation; note that tokens have a 7-day expiry as an upper bound.
- **Deferral reason:** No multi-instance deployment planned for private beta.

#### P3-04: Resume parse timeout is non-configurable
- **Files:** `apps/api/src/career/resume/upload.ts`
- **Description:** `PARSE_TIMEOUT_MS` is hardcoded at 15 seconds. Unusually complex PDFs could timeout legitimate uploads.
- **Recommendation:** Expose as `RESUME_PARSE_TIMEOUT_MS` env var in a future iteration if needed.
- **Deferral reason:** 15 seconds is generous; no reported issues.

---

## Security Implementation Review

### Authentication and Authorization

| Control | Status | Notes |
|---|---|---|
| GitHub OAuth CSRF (state token) | ✅ Strong | `crypto.randomBytes(32)`, validated on callback, cleared after use |
| JWT per-login jwtid | ✅ Strong | `crypto.randomUUID()` — prevents replay of revoked tokens |
| Session revocation (logout) | ✅ Strong | MongoDB persistence + in-memory fingerprint |
| TTL index on revoked_sessions | ✅ Strong | Auto-expires old revocations |
| GitHub token encrypted at rest | ✅ Strong | AES-256-GCM, IV random, auth tag, `select: false` |
| Token decryption in-memory only | ✅ Strong | Never logged or persisted elsewhere |
| Cookie: HttpOnly | ✅ Strong | Always |
| Cookie: Secure | ✅ Strong | Production only (auto-disabled in dev for http) |
| Cookie: SameSite=None | ✅ Correct | Production (required for cross-origin frontend) |
| Cross-user resource isolation | ✅ Verified | All queries scoped to session userId; test suite confirms |
| CSRF via Origin check | ✅ Strong | `requireTrustedOrigin` middleware on all state-changing routes |
| OAuth IP rate limit | ✅ Present | 20 req/15 min per IP on initiate + callback |

### Security Headers

| Header | Value | Notes |
|---|---|---|
| Content-Security-Policy | `default-src 'none'; frame-ancestors 'none'` | Correct for JSON API |
| Strict-Transport-Security | `max-age=31536000` | Production only |
| X-Content-Type-Options | `nosniff` | Present |
| Referrer-Policy | `no-referrer` | Present |
| Cache-Control | `no-store` | Present on all API responses |
| X-Powered-By | Removed | Present |

**Note:** The API CSP protects the API server responses. The frontend SPA (served from a CDN/static host) requires a separate CSP configured at the hosting layer. See Phase 6E for the recommended frontend CSP.

### Rate Limiting

| Endpoint Group | Limit | Key | Status |
|---|---|---|---|
| All `/api/*` | 500 req/15 min | IP | ✅ |
| GitHub OAuth initiate/callback | 20 req/15 min | IP | ✅ |
| Job search | 30 req/min | user ID | ✅ |
| Account deletion | 3 per 10 min | user ID | ✅ |
| Resume upload | Per-user via general limit | user ID | ✅ |
| GitHub analysis | Per-user via general limit | user ID | ✅ |

TRUST_PROXY is configurable and documented. Default is 0 (safe; never trusts X-Forwarded-For).

### MongoDB Reliability

| Aspect | Status | Detail |
|---|---|---|
| Connection on startup | ✅ | Fail-fast: `serverSelectionTimeoutMS: 10s` |
| Connection pool | ✅ | `maxPoolSize: 50` |
| Graceful shutdown | ✅ | SIGINT/SIGTERM → server.close() → disconnectDatabase() → exit |
| Force-exit timeout | ✅ | 10s max wait, then `process.exit(1)` |
| Existing indexes | ✅ | Verified: User.githubId, Repository.(userId+githubId), Analysis.(userId+createdAt), SavedJob.(userId+jobId), RevokedSession.expiresAt (TTL) |
| Query scoping | ✅ | All queries include `userId` filter |
| Pagination | ✅ | `.lean()` on reads |

No missing indexes identified based on current query patterns.

### Resume Upload Security

| Control | Status |
|---|---|
| File size limit | ✅ `RESUME_MAX_BYTES` (default 5 MB, configurable 10 KB–10 MB) |
| Magic-byte validation | ✅ PDF (`%PDF-`) and DOCX (ZIP header) |
| Extension validation | ✅ `.pdf` / `.docx` only |
| ZIP bomb protection (DOCX) | ✅ `assertSafeZip()` — central directory scan without decompression |
| Parse timeout | ✅ 15 seconds |
| Max extracted text | ✅ 200 KB |
| Max PDF pages | ✅ 12 pages |
| No disk storage | ✅ Memory-only processing |
| Path traversal | ✅ No filename used |
| Error message safety | ✅ No parser internals in responses |

### Observability

| Feature | Status |
|---|---|
| Structured JSON logs (stdout) | ✅ |
| Correlation ID per request | ✅ `crypto.randomUUID()` |
| Request method, path, status, duration | ✅ |
| Credentials excluded from logs | ✅ Documented rule; no credentials in log paths |
| `/health` liveness endpoint | ✅ Always 200 |
| `/ready` readiness endpoint | ✅ 200 when MongoDB connected, 503 otherwise |
| Health response excludes secrets | ✅ |
| Unhandled rejection logging | ✅ **FIXED in Phase 6D** |
| Uncaught exception logging | ✅ **FIXED in Phase 6D** |

### Backup and Restore Readiness

**Recommended strategy for private beta:**

| Aspect | Recommendation |
|---|---|
| Provider | MongoDB Atlas (free tier supports M0, pay-as-you-go for M2+) |
| Backup type | Atlas automated continuous cloud backup (enabled by default on M2+) |
| Frequency | Continuous on Atlas M2+; daily snapshots on M0 (free tier) |
| Retention | 7 days minimum for private beta |
| Encryption | At rest and in transit — Atlas default |
| Access | Atlas UI / API; restrict to project owners |
| Recovery procedure | Atlas UI → Cluster → `...` → Restore; select point-in-time or snapshot |
| RPO (private beta) | M0: ~24h; M2+: ~minutes |
| RTO (private beta) | 15–30 minutes (Atlas restore) |
| Restore verification | Restore to a test cluster; run `GET /ready` and spot-check collections |

**For self-hosted MongoDB (alternative):**
```
# Daily mongodump (cron):
mongodump --uri="$MONGODB_URI" --archive=backup-$(date +%Y%m%d).gz --gzip
# Store archive in encrypted, access-restricted cloud storage
# Test restore monthly: mongorestore --uri="$TEST_URI" --archive=backup.gz --gzip
```

### Data Lifecycle

| Resource | Lifecycle | Method |
|---|---|---|
| User account | Explicit deletion via `POST /api/auth/account/delete` | Cascading delete across all collections |
| Resume | Explicit deletion via `DELETE /api/resume` | Field cleared from careerProfile |
| Saved jobs | Deleted with account | Included in account deletion cascade |
| Analyses / evidence / repos | Deleted with account | Included in cascade |
| Revoked sessions | Auto-expired | TTL index on `expiresAt` field |
| GitHub access token | Deleted with account | Encrypted token removed from user document |

**Migration strategy:** No migration framework is introduced. Schema evolution follows Mongoose's additive pattern (new optional fields are backward-compatible). For any breaking schema changes, a versioned migration script should be run against a backup-verified database with application stopped.

### API Reliability

| Aspect | Status | Detail |
|---|---|---|
| Provider timeouts | ✅ | `AbortSignal.timeout(JOB_PROVIDER_TIMEOUT_MS)` on every fetch |
| Partial provider failure | ✅ | `Promise.allSettled()` — one failure does not block others |
| Response size bounds | ✅ | `readBounded()` streams and cancels if body > MAX_BODY_BYTES |
| LLM timeout | ✅ | `DEFAULT_TIMEOUT_MS: 20s` |
| LLM failure classification | ✅ | Typed `errorKind` returned |
| Graceful shutdown | ✅ | SIGINT/SIGTERM handled; in-flight requests drained |
| Server listen error | ✅ | `server.on("error")` exits cleanly |
| Unhandled rejections | ✅ | **FIXED in Phase 6D** — structured log + clean exit |
| Uncaught exceptions | ✅ | **FIXED in Phase 6D** — structured log + clean exit |

---

## Changed Files

### Phase 6D changes (P1 fix + CVE patches)

| File | Change | Reason |
|---|---|---|
| `apps/api/src/server.ts` | Added `process.on("unhandledRejection")` and `process.on("uncaughtException")` handlers; imported `logger` | P1 fix |
| `package-lock.json` | Updated via `npm audit fix` | See dependency table below |

### Phase 6C E2E rate-limit isolation fix

| File | Change | Reason |
|---|---|---|
| `apps/api/src/config/env.ts` | Added `E2E_RATE_LIMIT_MAX` schema field (test-only, validated), superRefine guard, parse call | E2E fix |
| `apps/api/src/app.ts` | Computed `globalIpMax`; uses `E2E_RATE_LIMIT_MAX` when `NODE_ENV=test`, otherwise 500 | E2E fix |
| `apps/web/e2e/.env.test` | Added `E2E_RATE_LIMIT_MAX=2000` | E2E fix |
| `apps/api/tests/hardening.test.ts` | Added `describe("E2E rate-limit isolation")` block — 9 new tests | E2E fix |

### Dependency changes detail

`npm audit fix` resolved the four CVEs above and pulled in transitive updates as part of normal semver resolution. All changes are within patch or minor bounds of existing version constraints; no major-version upgrades occurred.

| Package | Before | After | Reason |
|---|---|---|---|
| `zod` | 4.6.5 | 4.6.7 | **CVE fix** — GHSA-mrhx-c7xc-m3w5 (memory DoS in validation) |
| `qs` | 6.16.0 | 6.17.1 | **CVE fix** — GHSA-6pq8-jhm2-2vcw (DoS via stringify) |
| `follow-redirects` | 1.16.1 | 1.16.2 | **CVE fix** — GHSA-mrwp-f3q8-3g9p (sensitive header disclosure) |
| `vite` | 8.3.2 | 8.3.6 | **CVE fix** — 4 dev-server CVEs (dev-only tool) |
| `rolldown` | 1.2.12 | 1.2.16 | Transitive — Vite 8.3.6 dependency |
| `@rolldown/binding-*` (16 platform bins) | 1.2.12 | 1.2.16 | Transitive — Vite 8.3.6 native binaries |
| `@oxc-project/types` | 0.152.0 | 0.156.0 | Transitive — Vite 8.3.6 dependency |
| `body-parser` | 2.3.0 | 2.4.0 | Transitive — Express dependency; pulled in by `qs` fix |
| `nanoid` | 3.3.19 | 3.3.20 | Transitive — normal semver resolution |
| `postcss` | 8.5.28 | 8.5.32 | Transitive — build toolchain, dev-only |

All 888 unit tests pass with these package versions applied. No behavioral regressions observed.

---

## Test Results

| Suite | Command | Tests Passed | Tests Failed | Duration |
|---|---|---|---|---|
| Domain | `npm run test --workspace=packages/domain` | 113 / 113 | 0 | 655 ms |
| API | `npm run test --workspace=apps/api` | 641 / 641 | 0 | 9.47 s |
| Web | `npm run test --workspace=apps/web` | 134 / 134 | 0 | 11.67 s |
| **Total** | | **888 / 888** | **0** | |

TypeScript: **clean** (all 3 workspaces, no errors)

Production build: **clean** (domain → api → web; web bundle 415 KB / 117 KB gzip, 348 ms)

Post-patch re-run (unit + build):

| Suite | Tests Passed | Notes |
|---|---|---|
| API | 641 / 641 | zod 4.6.7 — no regressions |
| Domain | 113 / 113 | — |
| Web | 134 / 134 | vite 8.3.6 — no regressions |
| TypeScript | clean | — |
| Production build | clean (367 ms) | — |

Post E2E-fix re-run (unit + build):

| Suite | Tests Passed | Notes |
|---|---|---|
| Domain | 113 / 113 | — |
| API | 650 / 650 | +9 new E2E isolation tests in hardening.test.ts |
| Web | 134 / 134 | — |
| API TypeScript | clean | — |
| Web TypeScript | clean | — |
| API build | clean | — |
| Production frontend build | clean (415 KB / 117 KB gzip) | — |

### Playwright E2E results

#### Initial run (Phase 6D — before E2E fix)

**Actual result: 123 passed / 6 failed (129 total)**

| Project | Passed | Failed |
|---|---|---|
| desktop-chrome | 41 | 2 |
| tablet | 41 | 2 |
| mobile | 41 | 2 |

**Failing tests:** Both failures per browser project are in the `Responsive layout — no horizontal overflow` describe block:
- `desktop-1280 authenticated dashboard — no horizontal overflow`
- `mobile-390 authenticated dashboard — no horizontal overflow`

**Root cause confirmed:**

The `DashboardPage` component fetches `/api/career/profile` after session injection. By the time these tests run (positions #116–129, the last in the suite), the per-IP rate limiter (`500 req / 15 min`, applied globally to all `/api/*` traffic from the same `localhost` IP) has been exhausted by the preceding tests running across 3 Playwright workers. The endpoint returns HTTP 429; the Dashboard heading never renders; the locator times out.

Three Playwright projects (desktop-chrome / tablet / mobile) all share the single E2E API process on port 4001. With `TRUST_PROXY=0`, Express keys all browser connections on the same socket IP (`127.0.0.1`). The cumulative request volume across all three projects exhausts the 500-request window before the final authenticated overflow tests execute.

Failure confirmed by screenshot: the page renders the authenticated shell correctly but the content area shows *"Something went wrong — Too many requests. Please try again shortly."*

**Why this is unrelated to Phase 6D changes:**

- `apps/api/src/middleware/rate-limit.ts` and `apps/api/src/app.ts` (where the per-IP limiter is applied) were last modified at commit `c11e6cf` (Phase 6B) — before Phase 6D.
- The Phase 6D changes are confined to `server.ts` and `package-lock.json`. Neither affects routing, rate-limiting logic, or request counting.

---

#### E2E rate-limit isolation fix (applied within Phase 6D delivery)

**Root cause:** Shared `127.0.0.1` IP key exhausted the 500 req/15 min production default across 3 parallel Playwright projects.

**Fix implemented:** `E2E_RATE_LIMIT_MAX` — a test-environment-only configurable ceiling for the global per-IP rate limiter.

| Mechanism | Detail |
|---|---|
| New env variable | `E2E_RATE_LIMIT_MAX=2000` in `apps/web/e2e/.env.test` |
| Zod validation | `z.coerce.number().int().min(1).max(10_000).optional()` |
| Cross-field guard | `superRefine` rejects `E2E_RATE_LIMIT_MAX` if `NODE_ENV !== "test"` → production startup fails if the variable is ever accidentally set |
| App wiring | `app.ts` reads `globalIpMax = env.NODE_ENV === "test" && env.E2E_RATE_LIMIT_MAX != null ? env.E2E_RATE_LIMIT_MAX : 500` |
| Production default | Unchanged at 500 req/15 min — the conditional strictly requires both `NODE_ENV=test` AND `E2E_RATE_LIMIT_MAX` to be non-null |

**Files changed by the E2E fix:**

| File | Change |
|---|---|
| `apps/api/src/config/env.ts` | Added `E2E_RATE_LIMIT_MAX` schema field, superRefine rule, and parse call |
| `apps/api/src/app.ts` | Computed `globalIpMax`; passes it to `rateLimitPerIp` |
| `apps/web/e2e/.env.test` | Added `E2E_RATE_LIMIT_MAX=2000` |
| `apps/api/tests/hardening.test.ts` | Added 9 new tests in `describe("E2E rate-limit isolation")` |

**New tests added:**

| Test | What it proves |
|---|---|
| Accepts valid value in `NODE_ENV=test` | Config parses correctly |
| Absent (undefined) when not set → production default 500 applies | No unintended default |
| Rejects when `NODE_ENV=production` | Production cannot enable the override |
| Rejects when `NODE_ENV=development` | Development does not inherit the override |
| Rejects zero | Min-value enforcement |
| Rejects values above 10 000 | Max-value enforcement |
| Rejects non-numeric string | Type coercion failure path |
| Rate limiting still fires at the configured test ceiling | Middleware is not bypassed — 429 fires after configured limit |
| `TRUST_PROXY=0` spoofed header still blocked with raised limit | Existing spoof protection unchanged |

**Final E2E results after fix:**

| Project | Passed | Failed |
|---|---|---|
| desktop-chrome | 43 | 0 |
| tablet | 43 | 0 |
| mobile | 43 | 0 |
| **Total** | **129** | **0** |

Run 1: 129/129 (45.1 s) ✅  
Run 2: 129/129 (47.4 s) ✅ (repeatable)

---

## Deferred Items and Reasons

| Item | Severity | Reason for Deferral |
|---|---|---|
| Migrate server.ts `console.*` to `logger` | P3 | Cosmetic; startup-only messages; out of scope |
| Redis-backed rate limiting | P3 | Not needed for single-instance private beta |
| Cross-instance revocation sync | P3 | Single-instance deployment for private beta |
| Make PARSE_TIMEOUT_MS configurable | P3 | 15 s is adequate; no reported issues |
| E2E per-IP rate limit exhaustion (6 failing tests) | P3 | ✅ RESOLVED — `E2E_RATE_LIMIT_MAX` env var, restricted to `NODE_ENV=test`, implemented and tested |

---

## Residual Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Rate limit bypass (multi-instance) | Low (single instance for beta) | Medium | Document; migrate to Redis if scaling |
| Token valid on other instance post-logout | Low (single instance for beta) | Low | 7-day TTL is upper bound |
| DB backup gap (Atlas free tier) | Medium if using M0 | Medium | Use Atlas M2+ or self-hosted mongodump for < 24h RPO |

---

## Phase 6D Acceptance Criteria

| Criterion | Status |
|---|---|
| P0 findings resolved | ✅ PASS (none found) |
| P1 findings resolved | ✅ PASS (P1-01 fixed) |
| Authentication and authorization tests pass | ✅ PASS |
| No cross-user data access through tested API paths | ✅ PASS |
| Sensitive information not leaked through logs or errors | ✅ PASS |
| MongoDB lifecycle understood and tested | ✅ PASS |
| Upload security verified | ✅ PASS |
| Dependency risks reviewed | ✅ PASS (all vulnerabilities resolved) |
| Health/readiness behavior correct | ✅ PASS |
| Graceful shutdown verified | ✅ PASS |
| Backup/restore procedures documented | ✅ PASS |
| Migration and data lifecycle strategy documented | ✅ PASS |
| Existing business logic unchanged | ✅ PASS |
| Full test suites pass | ✅ PASS (897/897 after E2E fix: domain 113 + API 650 + web 134) |
| TypeScript checks pass | ✅ PASS |
| Production builds pass | ✅ PASS |

**Phase 6D status: COMPLETE**

---

## Next Steps

1. Obtain approval to commit Phase 6D changes (server.ts + lockfile) together with Phase 6C E2E fix (env.ts, app.ts, .env.test, hardening.test.ts).
2. Push combined commit to GitHub.
3. Proceed with Phase 6E deployment preparation.
4. At private beta scale, evaluate Redis-backed rate limiting (P3-02).
