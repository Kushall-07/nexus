# NEXUS — Phase 8 Deployment Readiness Audit

**Date:** 2026-11-09
**Branch:** main
**HEAD:** f9c55ad
**Auditor:** Claude Sonnet 4.6
**Audit type:** Read-only. No infrastructure provisioned. No files modified.

---

## 1. Executive Summary

NEXUS is **production-ready at the code level**. All 897 unit and integration tests pass, TypeScript compiles cleanly across all three workspaces, and the production build succeeds. Security hardening (Phase 6B–6E) is complete. The four-phase frontend redesign (Phase 7) is complete. Comprehensive deployment documentation — runbook, private beta plan, environment variable reference — was produced in Phase 6E.

**No production infrastructure exists.** No MongoDB Atlas cluster, no Render service, and no Vercel project has been provisioned. No production GitHub OAuth application has been created. No production secrets have been generated. The application cannot be deployed until these actions are authorized and taken.

The P0 blockers are exclusively provisioning actions, not code defects. Once the user approves and executes the five infrastructure steps described in Section 17, the application is ready for the β-0 internal testing phase.

**Final verdict: READY AFTER SPECIFIC BLOCKERS ARE RESOLVED.**

---

## 2. Original Phase 8 Objectives

Recovered from `reports/phase-6e/PHASE_6E_DEPLOYMENT_READINESS_REPORT.md` and `reports/phase-6e/DEPLOYMENT_RUNBOOK.md`.

### Phase 8 acceptance criteria (documented in Phase 6E)

| Criterion | Status at audit |
|---|---|
| Recommended deployment architecture documented | PASS |
| Environment configuration readiness | PASS — all variables documented and Zod-validated |
| CI/CD readiness | PASS — pipeline passes; documented improvements pending |
| Deployment runbook complete | PASS |
| Private beta readiness plan complete | PASS |
| Smoke-test checklist complete | PASS |
| No paid services provisioned | PASS — none provisioned |
| No production secrets committed | PASS — `.env` is gitignored; no secrets in tree |

### Recommended architecture (Phase 6E)

| Component | Recommendation |
|---|---|
| Frontend | Vercel (or Netlify / Cloudflare Pages) |
| Backend API | Render (or Railway / Fly.io) |
| Database | MongoDB Atlas M0 free → M2 for backups |
| File storage | None — resume files processed in-memory |
| Logs | Platform-native stdout stream (structured JSON) |

This audit verifies each component against the actual codebase.

---

## 3. Current Repository State

### Git status

| Property | Value |
|---|---|
| Branch | main |
| HEAD | f9c55ad (fix(web): finalize Phase 4 UI integration and QA) |
| Remote | origin → https://github.com/Kushall-07/nexus.git |
| Sync | Local == origin/main (up to date) |
| Working tree | Clean (2 untracked report files — not blocking) |
| Node.js (local) | v22.15.0 (satisfies engines: `>=20.0.0`) |
| npm (local) | 10.9.2 (satisfies engines: `>=10.0.0`) |

### Untracked files (non-blocking)

```
reports/phase-7/PHASE_5_ROADMAP_RECOVERY_REPORT.md
reports/phase-7/phase-4/PHASE_4_FINAL_CLOSURE_REPORT.md
```

These are documentation reports that have not been committed. They do not affect the production build, tests, or deployment. They can be committed at any time.

### Dependency security

```
npm audit: found 0 vulnerabilities
```

All dependency trees are clean across all three workspaces.

### Test status (from Phase 4 closure)

| Workspace | Tests |
|---|---|
| packages/domain | Pass |
| apps/api | Pass |
| apps/web | Pass |
| Total | 897/897 |

---

## 4. Hosting Architecture Assessment

### Workspace structure

The monorepo has three workspaces:

| Workspace | Purpose | Build output |
|---|---|---|
| `packages/domain` | Shared TypeScript types and domain logic | `packages/domain/dist/` |
| `apps/api` | Express API server | `apps/api/dist/server.js` |
| `apps/web` | Vite + React SPA | `apps/web/dist/` |

Build order dependency: domain must compile before api and web.

The root `package.json` `build` script: `npm run build --workspace=packages/domain && npm run build --workspace=apps/api && npm run build --workspace=apps/web` — correct order enforced.

---

## 5. Frontend Readiness

### Build configuration

| Property | Value | Assessment |
|---|---|---|
| Framework | Vite + React 19 | READY |
| Build command | `tsc -b && vite build` | READY |
| Output directory | `apps/web/dist/` | READY |
| TypeScript check | Included in build | READY |
| Bundle size | 415 KB / 117 KB gzip (Phase 6E report) | READY |

### Environment variable configuration

| Variable | Usage | Status |
|---|---|---|
| `VITE_API_BASE_URL` | Embedded in bundle at build time | REQUIRES PRODUCTION VALUE |

The `client.ts` `validateApiBase()` function validates this at module load. If blank, the Vite dev proxy is used (development only). In production, `VITE_API_BASE_URL` must be set to the deployed API origin before the frontend build runs.

**Critical note:** Do not set `VITE_API_BASE_URL=https://api.example.com/api` — the frontend appends `/api` paths itself. A trailing `/api` causes double-prefix 404 errors on all API calls.

### SPA routing

Vercel handles SPA routing automatically for Vite projects (no `vercel.json` required). For Netlify, a `public/_redirects` file is required.

No `vercel.json` exists in the repository. This is correct for Vercel Vite projects — Vercel auto-detects the framework.

### Credentials and CORS

The frontend uses `credentials: "include"` on every fetch request. This is required for cross-origin HttpOnly cookie authentication. It correctly requires the backend CORS to allow the specific origin (not wildcard).

### Production HTTPS enforcement

`validateApiBase()` throws at build time if `VITE_API_BASE_URL` uses `http://` when `import.meta.env.PROD` is true. This prevents accidentally shipping a production build that connects to an HTTP backend.

### Status: READY WITH CONDITIONS

Condition: `VITE_API_BASE_URL` must be set to the production API URL during the production build. The code fully supports this.

---

## 6. Backend Readiness

### Start command

```
node apps/api/dist/server.js
```

This matches the runbook (Render Build Command). The `apps/api/package.json` `start` script is `node dist/server.js` (workspace-relative).

### Port binding

Configured via `PORT` environment variable (default: 4000). PaaS platforms like Render inject their own port via `PORT`. The env.ts schema accepts any integer 1–65535. **Action required:** Verify Render injects `PORT` automatically, or set `PORT=4000` explicitly.

### Health endpoints

Both endpoints are verified in source (`apps/api/src/app.ts`):

| Endpoint | Behaviour | Runbook expectation |
|---|---|---|
| `GET /health` | Returns `{"status":"ok","service":"nexus-api"}` unconditionally (200) | Matches |
| `GET /ready` | Returns `{"status":"ready"}` (200) if MongoDB connected; `{"status":"unavailable"}` (503) if not | Matches |

The `/ready` endpoint is the correct health check path for Render (a 503 during MongoDB startup delays traffic routing until the DB is reachable).

### Environment variable validation

`apps/api/src/config/env.ts` uses Zod with `envSchema.parse()`. The server crashes immediately at startup with a human-readable error message if any required variable is missing or fails cross-field validation. This prevents silent misconfiguration.

**Cross-field rules enforced:**
1. `TOKEN_ENCRYPTION_KEY` must base64-decode to exactly 32 bytes.
2. `LLM_PROVIDER=openai-compatible` requires both `LLM_BASE_URL` and `LLM_MODEL`.
3. `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` must be set together or not at all.
4. In `NODE_ENV=production`: `FRONTEND_URL`, `BACKEND_URL`, and `LLM_BASE_URL` must use `https://`.
5. `E2E_RATE_LIMIT_MAX` is rejected outside `NODE_ENV=test`.

### CORS

```typescript
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
```

CORS is locked to the single origin specified by `FRONTEND_URL`. Wildcard is not used. `credentials: true` is required for the `SameSite=None` session cookie to be sent cross-origin.

**Action required:** `FRONTEND_URL` must exactly match the deployed frontend origin including scheme and no trailing slash.

### Security headers (verified in source)

| Header | Value | Notes |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Prevents MIME sniffing |
| `Referrer-Policy` | `no-referrer` | No URL leakage to external sites |
| `Cache-Control` | `no-store` | Prevents caching of API responses |
| `Content-Security-Policy` | `default-src 'none'; frame-ancestors 'none'` | JSON-only API; no content loading or framing |
| `Strict-Transport-Security` | `max-age=31536000` | Production only (correctly gated on NODE_ENV) |
| `X-Powered-By` | Removed | Express fingerprint suppressed |

**Note:** HSTS does not yet include `includeSubDomains` or `preload`. Appropriate for initial beta — these should be added once the domain topology is confirmed.

### CSRF protection

`requireTrustedOrigin` middleware rejects state-changing requests (POST/PUT/PATCH/DELETE) whose `Origin` header does not match `FRONTEND_URL`. Requests with no `Origin` header (server-to-server) are permitted. This is correct CSRF defence for SameSite=None cookies.

### Rate limiting

| Limiter | Scope | Window | Max | Applied to |
|---|---|---|---|---|
| Global IP backstop | Per IP | 15 min | 500 | All `/api/*` routes |
| OAuth limiter | Per IP | 15 min | 20 | `/api/auth/github` + `/api/auth/github/callback` |
| Analysis | Per user | 1 min | 20 | `/api/analysis/*` |
| Gap analysis create | Per user | 1 min | 30 | `POST /api/gap-analysis/` |
| Explanation | Per user | 1 min | 5 | `POST /api/gap-analysis/:id/explanation` |
| Account delete | Per user | 10 min | 3 | `DELETE /api/auth/account` |

Rate limiting is **in-memory, per-process**. It is correct and effective for the single-instance private beta. It will not synchronize across multiple instances if the API is ever horizontally scaled.

**Action required for production:** `TRUST_PROXY` must be set to `1` on Render (Render places one load-balancer hop in front of the service). Setting it to `0` (default) causes all requests to have the same `req.ip` (the proxy's IP), breaking IP-based rate limiting.

### Graceful shutdown

`server.ts` registers `SIGTERM` and `SIGINT` handlers. On signal:
1. Stops accepting new connections.
2. Waits for in-flight requests to drain.
3. Disconnects MongoDB.
4. 10-second force-exit timeout via `setTimeout(..., 10_000)` with `.unref()`.

Render sends `SIGTERM` before killing a process. This shutdown sequence is correct.

### Logging

Structured JSON to stdout, one object per line:
```json
{"ts":"2026-11-09T...","level":"info","msg":"request finished","correlationId":"...","method":"GET","path":"/api/auth/me","status":200,"durationMs":12}
```

Fields: `ts`, `level`, `msg`, `correlationId`, `method`, `path`, `status`, `durationMs`.

Error responses never include stack traces. MongoDB errors log only the error class name. The logger catches its own exceptions and never crashes the process.

**Gap:** No external error monitoring (Sentry or equivalent) is integrated. Platform log streams are the only error visibility. Acceptable for β-0; should be addressed before β-1.

### Status: READY WITH CONDITIONS

Conditions: (1) set `TRUST_PROXY=1` on Render, (2) set `FRONTEND_URL` to exact production origin.

---

## 7. Database Readiness

### Connection configuration (verified in source)

| Property | Value | Notes |
|---|---|---|
| Connection timeout | 10 seconds (`serverSelectionTimeoutMS`) | Fail-fast — prevents silent hang |
| Connection pool | 50 (`maxPoolSize`) | Adequate for private beta load |
| URI validation | Zod `string().min(1)` | Startup fails if missing |
| Readiness check | `mongoose.connection.readyState === 1` | Surfaced via `/ready` endpoint |
| Disconnect on shutdown | `disconnectDatabase()` called in graceful shutdown | Clean close |

### MongoDB models and indexes

| Model | Key indexes |
|---|---|
| `user` | `githubId` (unique, indexed on field) |
| `repository` | `userId + githubId` (unique compound) |
| `evidence` | `userId + repositoryId + evidenceKey` (unique); `userId + skillId + repositoryId` |
| `analysis` | `userId + createdAt desc` |
| `gap-analysis` | `userId + createdAt desc` |
| `saved-job` | `userId + jobId` (unique) |
| `revoked-session` | `expiresAt` (TTL index, `expireAfterSeconds: 0`) |

The TTL index on `revoked-session.expiresAt` automatically purges expired revocations from MongoDB. This is correct and prevents unbounded collection growth.

Indexes are defined at the Mongoose schema level. MongoDB Atlas (and self-hosted MongoDB) will create them on first connection when `autoIndex` is true (Mongoose default in development). **For production**, verify that `autoIndex` behaviour is acceptable or run `db.collection.createIndexes()` explicitly before first traffic.

### Atlas M0 limitations

| Limitation | Impact |
|---|---|
| 512 MB storage | Adequate for private beta (thousands of users) |
| Shared compute | Occasional latency spikes possible |
| No automated backups | Manual `mongodump` required (see runbook) |
| No point-in-time recovery | Data loss risk if corruption or accidental delete |
| Connection limit ~500 | Well above private beta needs |

**Recommendation:** Start with M0 for β-0. Upgrade to M2 ($9/month) before β-1 to enable automated backups with configurable retention.

### Database name

`nexus` — consistent across runbook, .env.example, and connection string guidance. The `nexus_e2e` database is used for E2E test isolation and will not be present in production.

### Status: READY WITH CONDITIONS

Conditions: (1) Atlas cluster must be provisioned, (2) network access IP allowlist must include the Render service's IP or range, (3) consider M2 upgrade before β-1 for automated backups.

---

## 8. GitHub OAuth Readiness

### Implementation (verified in source)

| Property | Value |
|---|---|
| OAuth scopes | `read:user user:email` |
| State parameter | Generated per-request (`generateOAuthState()`), stored in HttpOnly cookie, verified on callback |
| Callback URL | `${env.BACKEND_URL}/api/auth/github/callback` |
| Token storage | AES-256-GCM encrypted with `TOKEN_ENCRYPTION_KEY` before persisting |
| Token rotation | Not implemented (tokens stored until account deletion) |
| Session lifetime | 7 days JWT expiry |
| Session revocation | SHA-256 fingerprint stored in-memory + MongoDB |

### Production requirements

| Requirement | Status |
|---|---|
| Production GitHub OAuth app (separate from dev) | NOT CREATED — requires user action |
| Homepage URL | Must be set to production frontend URL after deployment |
| Authorization callback URL | Must be `https://api.example.com/api/auth/github/callback` |
| `GITHUB_CLIENT_ID` in production env | NOT SET — requires user action after app creation |
| `GITHUB_CLIENT_SECRET` in production env | NOT SET — requires user action after app creation (shown only once) |

### Security notes

- The state cookie uses `HttpOnly`, `Secure` (production), and `SameSite=None` (production) — same as the session cookie. CSRF protection is in place for the OAuth flow.
- Scopes `read:user user:email` are minimal and appropriate. No write scopes are requested.
- The access token is encrypted before storage. If the database were compromised, raw GitHub tokens would not be directly recoverable without `TOKEN_ENCRYPTION_KEY`.

### Status: BLOCKED

Blocked on: production GitHub OAuth application does not exist. User must create it on github.com/settings/developers.

---

## 9. Security and Privacy Assessment

### Authentication and authorization

| Control | Status | Evidence |
|---|---|---|
| All data routes behind `requireAuth` | VERIFIED | All routers in `app.ts` use `router.use(requireAuth)` or per-route auth |
| JWT signed with `JWT_SECRET` | VERIFIED | `session.service.ts` uses `jwt.sign` / `jwt.verify` |
| Session revocation on logout | VERIFIED | `revokeSessionToken()` stores SHA-256 fingerprint; `verifySessionToken()` checks revocation set |
| Revocations survive restart | VERIFIED | Loaded from MongoDB on startup (`loadRevokedSessions()`) |
| Cookie: HttpOnly | VERIFIED | `auth.config.ts` |
| Cookie: Secure (prod) | VERIFIED | `secure: isProduction` |
| Cookie: SameSite=None (prod) | VERIFIED | `sameSite: isProduction ? "none" : "lax"` |
| CSRF protection | VERIFIED | `requireTrustedOrigin` middleware |
| Authorization boundary (user A cannot read user B) | DESIGN PATTERN | All queries filter by `userId` from `req.user.id` (JWT-derived, not user-supplied) |

### Input validation

All API inputs are validated with Zod before processing. The `callbackQuerySchema` validates OAuth callback parameters. The `deleteAccountSchema` requires an exact confirmation string to prevent accidental deletion.

### Error handling and information disclosure

| Risk | Status |
|---|---|
| Stack traces in error responses | NOT PRESENT — `errorHandler` returns only code + message |
| MongoDB URI in error responses | NOT PRESENT — startup errors log only `error.name`, not the URI |
| GitHub tokens in logs | NOT PRESENT — logger rules prohibit credential values |
| PII in logs | NOT PRESENT — logs contain correlation IDs, paths, statuses only |
| `X-Powered-By` header | REMOVED — `app.disable("x-powered-by")` + `res.removeHeader` in security middleware |

### Body size limits

| Route | Limit |
|---|---|
| `/api/resume` | 128 KB JSON |
| All other routes | 16 KB JSON |
| File upload | `RESUME_MAX_BYTES` (default 5 MB) |

### Dependency vulnerabilities

```
npm audit: 0 vulnerabilities
```

### Known security limitations (acceptable for private beta)

| Limitation | Severity | Notes |
|---|---|---|
| Rate limiting is in-memory, not distributed | P2 | Single-instance private beta is not affected |
| Session revocation not cross-instance | P2 | Only relevant if horizontally scaled |
| No automated `npm audit` in CI | P2 | Future CVEs will not block CI |
| HSTS lacks `includeSubDomains` and `preload` | P3 | Appropriate until domain topology confirmed |
| CSP not configured on frontend (SPA) | P2 | Frontend CSP must be configured at the Vercel/CDN layer, not the API |
| Three.js animation not suppressed by `prefers-reduced-motion` | P3 | Accessibility issue from Phase 4 |
| No automated accessibility scan (axe/pa11y) | P3 | Manual review only |

### Privacy

| Data type | Retention | User control |
|---|---|---|
| Account and profile | Until account deletion | `DELETE /api/auth/account` (requires confirmation phrase) |
| GitHub analysis results | Until account deletion | Implicit with account deletion |
| Saved jobs | Until deleted or account deletion | `DELETE /api/saved-jobs/:id` |
| Resume extracted text | Until deleted or account deletion | `DELETE /api/resume` |
| Session tokens (JWT) | 7 days | Invalidated on logout |
| Revoked session fingerprints | Until TTL (auto-purged) | Automatic |
| Logs | Platform retention (not user-controlled) | No PII in logs |

**Gap:** No formal privacy policy or terms of service documentation for beta users. Acceptable for β-0 internal only; required before inviting external users in β-1.

### Risk classification

| Risk | Severity | Priority | Status |
|---|---|---|---|
| No production secrets exist | Critical | P0 | Requires provisioning |
| No production OAuth app | Critical | P0 | Requires user action |
| Render free tier cold starts | High | P1 | Requires paid plan or workaround |
| No automated database backup (M0) | High | P1 | Requires M2 upgrade or manual cron |
| TRUST_PROXY not set for Render | High | P1 | Breaks IP-based rate limiting |
| No external error monitoring | Medium | P2 | Platform logs only |
| No CI npm audit step | Medium | P2 | Future CVEs not auto-detected |
| Frontend CSP not configured | Medium | P2 | Hosting layer config needed |
| Privacy policy missing | Medium | P2 | Required before external β-1 users |
| HSTS no includeSubDomains | Low | P3 | Post-domain-confirmation improvement |
| Three.js prefers-reduced-motion | Low | P3 | Accessibility enhancement |

---

## 10. Environment Variable Inventory

| Variable | Component | Required in production | Secret? | Purpose | Validation |
|---|---|---|---|---|---|
| `NODE_ENV` | API | Yes (`production`) | No | Runtime mode; gates HTTPS enforcement, HSTS, secure cookies | `enum: development/test/production` |
| `PORT` | API | No (default: 4000) | No | Listening port | `int 1–65535` |
| `MONGODB_URI` | API | Yes | Yes | MongoDB connection string | `string.min(1)` |
| `JWT_SECRET` | API | Yes | Yes | Signs session JWTs | `string.min(32)` |
| `GITHUB_CLIENT_ID` | API | Yes | No | GitHub OAuth app ID | `string.min(1)` |
| `GITHUB_CLIENT_SECRET` | API | Yes | Yes | GitHub OAuth app secret | `string.min(1)` |
| `TOKEN_ENCRYPTION_KEY` | API | Yes | Yes | AES-256-GCM key for GitHub access tokens | base64 → exactly 32 bytes |
| `FRONTEND_URL` | API | Yes | No | CORS allowlist origin; OAuth callback base | `url()` + `https://` in production |
| `BACKEND_URL` | API | Yes | No | OAuth redirect URI base; health reference | `url()` + `https://` in production |
| `TRUST_PROXY` | API | Yes (set to 1 on Render) | No | Trusted proxy hop count for `req.ip` | `int ≥ 0` (default: 0) |
| `ANALYSIS_COOLDOWN_MINUTES` | API | No | No | Min minutes between analysis runs (in .env.example; not in env.ts schema — appears unused in current code) | Not validated |
| `MAX_REPOSITORIES_PER_ANALYSIS` | API | No | No | Max repos scanned per analysis run | `int ≥ 1` (default: 15) |
| `MAX_REQUESTS_PER_REPOSITORY` | API | No | No | Max GitHub API calls per repo | `int ≥ 1` (default: 10) |
| `LLM_PROVIDER` | API | No | No | AI explanation provider | `enum: groq/gemini/openai-compatible` |
| `LLM_API_KEY` | API | If LLM_PROVIDER set | Yes | AI provider API key | optional string |
| `LLM_MODEL` | API | If openai-compatible | No | Model identifier | optional string |
| `LLM_BASE_URL` | API | If openai-compatible | No | API base URL | optional URL + `https://` in production |
| `REMOTIVE_ENABLED` | API | No | No | Enable Remotive job provider (free) | boolean |
| `ARBEITNOW_ENABLED` | API | No | No | Enable Arbeitnow job provider (free) | boolean |
| `HIMALAYAS_ENABLED` | API | No | No | Enable Himalayas job provider (free) | boolean |
| `ADZUNA_APP_ID` | API | No | No | Adzuna application ID | optional string (must pair with KEY) |
| `ADZUNA_APP_KEY` | API | No | Yes | Adzuna application key | optional string (must pair with ID) |
| `ADZUNA_COUNTRY` | API | No | No | Adzuna country code | regex `/^[a-z]{2}$/` (default: us) |
| `JSEARCH_API_KEY` | API | No | Yes | JSearch via RapidAPI | optional string |
| `JOB_CACHE_TTL_SECONDS` | API | No | No | Job result cache TTL | `int 0–86400` (default: 3600) |
| `JOB_PROVIDER_TIMEOUT_MS` | API | No | No | Per-provider HTTP timeout | `int 1000–30000` (default: 8000) |
| `RESUME_MAX_BYTES` | API | No | No | Max resume upload size | `int 10000–10000000` (default: 5000000) |
| `E2E_RATE_LIMIT_MAX` | API | No (rejected in production) | No | E2E test rate limit override | `int 1–10000`; rejected outside `NODE_ENV=test` |
| `VITE_API_BASE_URL` | Frontend (build-time) | Yes | No | Production API origin embedded in bundle | must be `https://` in production builds |

### Secrets requiring secure provider configuration

The following must be stored as platform secrets (never in committed files):

- `MONGODB_URI`
- `JWT_SECRET`
- `GITHUB_CLIENT_SECRET`
- `TOKEN_ENCRYPTION_KEY`
- `LLM_API_KEY` (if LLM enabled)
- `ADZUNA_APP_KEY` (if Adzuna enabled)
- `JSEARCH_API_KEY` (if JSearch enabled)

### Variable notes

1. **`ANALYSIS_COOLDOWN_MINUTES`** appears in `.env.example` but is absent from `env.ts`. It is not validated or consumed by the current codebase. The `.env.example` entry is stale and can be safely ignored.

2. **`VITE_API_BASE_URL`** is a **build-time** variable embedded into the frontend bundle by Vite. It must be set during the CI/CD build step, not as a runtime environment variable on the frontend host.

3. **`TRUST_PROXY=1`** is not optional on Render. Without it, all requests will share the proxy's IP address and IP-based rate limiting will not function correctly.

---

## 11. CI/CD Assessment

### Current pipeline (`.github/workflows/ci.yml`)

| Job | Trigger | Node.js | Steps |
|---|---|---|---|
| `typecheck` | push/PR to main | 22 | typecheck domain → api → web |
| `test` | push/PR to main | 22 | unit tests: domain → api → web |
| `build` | after typecheck+test pass | 22 | build domain → api → web |

Permissions: `contents: read` (minimal — no write access, no secrets access).

The build job correctly builds domain first, then api and web in parallel (independent after domain).

`VITE_API_BASE_URL` is intentionally unset in CI. The CI comment in `ci.yml` explains this: "Set it in your deployment pipeline for production releases." This is correct — CI validates buildability, not production configuration.

### CI gaps (not blocking)

| Gap | Priority | Notes |
|---|---|---|
| No `npm audit` step | P2 | Future CVEs will not block merges |
| No branch protection on `main` | P2 | Force-pushes or unreviewed commits are possible |
| No separate PR-only job | P3 | Currently combined with push-to-main |
| No Playwright E2E in CI | P2 | E2E tests run manually only; require a live API + DB |
| No automatic deployment step | Intentional | Deployment requires explicit user approval |

### Node.js version note

CI uses Node.js 22. The `engines` field in `package.json` requires `>=20.0.0`. Node 22 satisfies this. Render should also be configured to use Node.js 20 or 22. Check the Render service settings after provisioning.

### Status: READY WITH CONDITIONS

Conditions: CI passes (verified by test suite state). No deployment automation is configured — this is intentional pending approval.

---

## 12. Monitoring and Operations

### What exists

| Capability | Mechanism | Notes |
|---|---|---|
| Structured logging | JSON stdout → platform log stream | Correlation IDs, all HTTP requests |
| Liveness check | `GET /health` → 200 | Process is up |
| Readiness check | `GET /ready` → 200/503 | MongoDB connected |
| Graceful shutdown | SIGTERM/SIGINT handlers | 10s drain window |
| Unhandled rejection handler | `process.on("unhandledRejection")` | Logs and exits cleanly |
| Uncaught exception handler | `process.on("uncaughtException")` | Logs and exits cleanly |

### What does not exist

| Capability | Priority | Notes |
|---|---|---|
| External error monitoring (Sentry, etc.) | P2 | Required for β-1 visibility |
| Uptime monitoring | P2 | No external ping or alerting |
| Performance metrics | P3 | No APM, no p95/p99 latency tracking |
| Alert routing | P2 | Errors visible only by manually filtering logs |
| Dashboard | P3 | No Grafana or equivalent |

For β-0 (1–3 internal developers), platform log stream inspection is sufficient. For β-1 (external users), at minimum an uptime monitor (e.g. BetterUptime free tier, UptimeRobot) and error log alert should be configured.

---

## 13. Private Beta Readiness

### Phase plan (from `reports/phase-6e/PRIVATE_BETA_PLAN.md`)

| Phase | Users | Goal | Prerequisites |
|---|---|---|---|
| β-0 | 1–3 (internal/developer) | Confirm production stability | Infrastructure provisioned + smoke tests pass |
| β-1 | 5–15 (invited, known) | Validate user experience | β-0 exit criteria met; privacy comms sent |
| β-2 | 15–50 | Stress-test single-instance arch | β-1 P0/P1 clear; backup verified |

### Realistic capacity

| Metric | Estimate |
|---|---|
| Registered users (safe) | Up to ~1,000 |
| Concurrent active users | 10–30 comfortably; 50 at peak |
| Analysis runs per hour | ~20–50 (GitHub API quota is the bottleneck) |
| Job searches per minute | ~30 (rate-limited) |

**Single-instance architecture** is explicitly correct for private beta. Redis, horizontal scaling, and distributed rate limiting are not needed until beyond β-2.

### Invitation mechanism

No dedicated invitation or allowlist system exists in the codebase. The OAuth flow is open to anyone who reaches the frontend. For β-0 and β-1, beta control is managed by keeping the URL unannounced (security through obscurity). For a true gated beta, an allowlist (GitHub username or email) would need to be implemented — this is a P2 item before any broad β-1 or β-2 rollout.

### Feedback and support

The beta plan specifies GitHub Issues (private) or a designated email address. No in-app feedback widget exists. This is acceptable for small cohorts.

### Known limitations to communicate to beta users

- GitHub analysis covers only public repositories.
- AI-powered explanations may be unavailable (depends on LLM configuration).
- Job provider results depend on which APIs are configured. Demo listings shown if none.
- Resume parsing supports PDF and DOCX only.
- Beta data may be reset if a critical issue requires a database restore.

### Rollback criteria

Immediate rollback if:
- Cross-user data access (P0 security breach).
- Authentication bypass.
- Token exposure in logs or responses.
- Data corruption affecting multiple users.
- API unavailable > 30 minutes without a known fix.

### Status: READY WITH CONDITIONS

Conditions: (1) infrastructure must be provisioned, (2) privacy communication required before β-1, (3) consider allowlist before β-1 rollout to avoid uncontrolled signups.

---

## 14. Cost Assessment

All costs are based on documented public pricing tiers. Verify current pricing at each provider before committing.

### Free-tier architecture (Phase β-0)

| Service | Tier | Approximate cost | Key limitations |
|---|---|---|---|
| Vercel | Hobby (free) | $0/mo | 100 GB bandwidth, 6000 build-minutes/mo, no team features |
| Render | Free | $0/mo | **Spins down after 15 min inactivity** — ~30s cold start for first request after idle |
| MongoDB Atlas | M0 (free shared) | $0/mo | 512 MB storage, shared compute, **no automated backups** |
| GitHub | Free | $0/mo | Public repository; Actions minutes included |
| **Total** | | **$0/mo** | Render cold starts are a significant UX issue |

### Recommended paid architecture (Phase β-1 and beyond)

| Service | Tier | Approximate cost | Improvement |
|---|---|---|---|
| Vercel | Hobby (free) | $0/mo | Adequate through beta |
| Render | Starter | ~$7/mo | Always-on (no cold starts), 512 MB RAM |
| MongoDB Atlas | M2 Shared | ~$9/mo | Automated backups, 2 GB storage, dedicated compute |
| **Total** | | **~$16/mo** | Production-grade for private beta |

### Potential unexpected costs

| Cost | Trigger | Mitigation |
|---|---|---|
| Vercel bandwidth overage | >100 GB/mo (unlikely at beta scale) | Monitor in Vercel dashboard |
| Render over RAM limit | Memory spike during analysis | Monitor Render metrics; upgrade to Standard ($25/mo) if needed |
| Atlas storage overage on M0 | >512 MB (requires M2+ to continue) | Upgrade to M2 proactively |
| GitHub API rate limit | >5,000 req/hr per token | Per-user tokens; not shared — unlikely to hit at beta scale |
| LLM provider costs | Per-token charges | Groq has a free tier; monitor usage on provider dashboard |
| Job provider costs | Adzuna, JSearch have metered plans | Start with free providers (Remotive, Arbeitnow, Himalayas) |

### Domain costs

A custom domain is optional for beta. Platform subdomains (`.vercel.app`, `.onrender.com`) are free and functional. A `.com` domain costs approximately $10–15/year if desired.

---

## 15. Findings by Priority

### P0 — Must complete before any production deployment

| # | Finding | Category | Description |
|---|---|---|---|
| P0-1 | MongoDB Atlas cluster not provisioned | BLOCKED | No production database exists. Requires Atlas account creation, cluster provisioning (M0 free or M2 paid), database user creation, and network access configuration. |
| P0-2 | Render service not provisioned | BLOCKED | No production API server exists. Requires Render account, web service creation pointing to this repository. |
| P0-3 | Vercel project not provisioned | BLOCKED | No production frontend exists. Requires Vercel account, project import, root directory set to `apps/web`. |
| P0-4 | Production GitHub OAuth app not created | BLOCKED | No production OAuth app exists on GitHub. `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are unknown. |
| P0-5 | Production secrets not generated | BLOCKED | `JWT_SECRET`, `TOKEN_ENCRYPTION_KEY` have never been generated for production. |
| P0-6 | Production environment variables not configured | BLOCKED | No production environment on any hosting platform has been configured with the required variables. |
| P0-7 | `VITE_API_BASE_URL` not set for production build | BLOCKED | The frontend bundle cannot be built for production without this value. |

### P1 — Must resolve before private beta (β-1 external users)

| # | Finding | Category | Description |
|---|---|---|---|
| P1-1 | Render free tier has cold starts | READY WITH CONDITIONS | After 15 min idle, the first request triggers a ~30s cold start. Unacceptable for β-1 users. Upgrade to Render Starter (~$7/mo) or implement an uptime monitor that pings `/health` every 10 min. |
| P1-2 | MongoDB M0 has no automated backups | READY WITH CONDITIONS | A database corruption or accidental delete on M0 cannot be recovered. Upgrade to M2 (~$9/mo) before β-1 to enable automated backups with configurable retention. |
| P1-3 | `TRUST_PROXY` must be set to 1 on Render | READY WITH CONDITIONS | Without this, all requests share the reverse-proxy IP. IP rate limiting does not function. `TRUST_PROXY=1` must be set in the Render environment. |
| P1-4 | No privacy communication for external users | NOT IMPLEMENTED | Beta users must be informed what data is collected, how long it is retained, and that data may be reset. Required before inviting external users. |
| P1-5 | No allowlist or invite gating | NOT IMPLEMENTED | The OAuth flow is open to anyone who finds the URL. For a truly controlled beta, a GitHub-username or email allowlist should be implemented, or the URL kept strictly private. |

### P2 — Important operational improvements

| # | Finding | Category | Description |
|---|---|---|---|
| P2-1 | No `npm audit` step in CI | NOT IMPLEMENTED | Future CVEs in dependencies will not be caught automatically. Add `npm audit --audit-level=high` to `ci.yml`. |
| P2-2 | No branch protection on `main` | NOT IMPLEMENTED | Force-pushes and unreviewed commits to `main` are possible. Configure GitHub branch protection rules. |
| P2-3 | No external error monitoring | NOT IMPLEMENTED | Errors are visible only by manually inspecting platform logs. Integrate Sentry (free tier) or equivalent before β-1. |
| P2-4 | No uptime monitoring | NOT IMPLEMENTED | No alerting if the API goes down. Add UptimeRobot or BetterUptime (both free) pointing at `/health`. |
| P2-5 | Frontend CSP not configured | NOT IMPLEMENTED | The API has a strict CSP for its JSON responses. The SPA itself needs a CSP configured at the Vercel/CDN layer (Vercel `headers` config or `vercel.json`). |
| P2-6 | No Playwright E2E in CI | NOT IMPLEMENTED | E2E tests run manually only. Full E2E automation in CI requires a staging environment. |
| P2-7 | Render Node.js version not pinned | REQUIRES USER DECISION | Render defaults to a Node.js version; it should be pinned to 20 or 22 in service settings to match CI. |

### P3 — Optional enhancements

| # | Finding | Category | Description |
|---|---|---|---|
| P3-1 | `ANALYSIS_COOLDOWN_MINUTES` in `.env.example` but absent from `env.ts` | UNVERIFIED | This variable appears stale — no code in `apps/api/src/` reads it. The `.env.example` entry can be removed to avoid confusion, but it has no functional impact. |
| P3-2 | Three.js animation not suppressed by `prefers-reduced-motion` | NOT IMPLEMENTED | Known from Phase 4. Requires a JS media-query check in the Three.js hero component. |
| P3-3 | No route-level code splitting | NOT IMPLEMENTED | Known from Phase 4. Single bundle (117 KB gzip) is acceptable for private beta. |
| P3-4 | HSTS lacks `includeSubDomains` and `preload` | READY WITH CONDITIONS | Appropriate until the production domain and subdomain topology are confirmed. |
| P3-5 | No custom domain | REQUIRES USER DECISION | Platform subdomains (`.vercel.app`, `.onrender.com`) are functional for beta. Custom domain adds ~$10–15/year. |
| P3-6 | No automated accessibility scan | NOT IMPLEMENTED | Manual review only. Consider pa11y-ci or axe-playwright integration. |
| P3-7 | No load testing | NOT IMPLEMENTED | Capacity estimates are architectural, not benchmark-derived. Consider k6 or Artillery before β-2. |

---

## 16. Required User Decisions

| # | Decision | Options | Impact |
|---|---|---|---|
| D-1 | MongoDB tier | M0 (free, no backups) or M2 ($9/mo, automated backups) | M0 acceptable for β-0; M2 strongly recommended before β-1 |
| D-2 | Render tier | Free (cold starts) or Starter ($7/mo, always-on) | Free acceptable for β-0 internal only; Starter required for β-1 |
| D-3 | Custom domain | Use platform subdomains (free) or purchase a domain (~$10–15/yr) | Subdomains work for all beta phases |
| D-4 | LLM provider | Groq (free tier), Gemini, openai-compatible, or disabled | AI explanations enhance UX but are not required for core functionality |
| D-5 | Job provider APIs | Free only (Remotive/Arbeitnow/Himalayas) or paid (Adzuna, JSearch) | Free providers cover remote jobs adequately for beta |
| D-6 | Beta access control | Keep URL private (implicit gating) or implement allowlist | Allowlist required if URL becomes semi-public |
| D-7 | Error monitoring | Integrate Sentry (free tier) now or defer to β-1 | Strongly recommended before external users |

---

## 17. Recommended Deployment Sequence

This sequence should be followed in exact order. The runbook (`reports/phase-6e/DEPLOYMENT_RUNBOOK.md`) contains detailed step-by-step instructions for each action.

**All infrastructure actions require explicit user approval before execution.**

| Step | Action | Actor | Notes |
|---|---|---|---|
| 1 | Commit 2 untracked report files | Claude (with approval) | Optional cleanup; not blocking |
| 2 | Create MongoDB Atlas account and M0 cluster | User | Atlas UI; create `nexus` database; create `readWrite` user |
| 3 | Configure Atlas network access | User | Allow Render IP (or `0.0.0.0/0` temporarily; restrict later) |
| 4 | Create production GitHub OAuth app | User | github.com/settings/developers; note Client ID and Secret |
| 5 | Generate `JWT_SECRET` (64 hex chars) | User | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| 6 | Generate `TOKEN_ENCRYPTION_KEY` (32-byte base64) | User | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| 7 | Create Render web service | User | Render UI; connect repository; set build/start commands |
| 8 | Configure Render environment variables | User | All 8 required vars + `TRUST_PROXY=1`; Node version 20 or 22 |
| 9 | Deploy API on Render; verify `/health` and `/ready` | User + Claude | `curl https://api.onrender.com/health` → `{"status":"ok"}` |
| 10 | Create Vercel project; set root directory to `apps/web` | User | Vercel UI; import repository |
| 11 | Set `VITE_API_BASE_URL` in Vercel build settings | User | Must be `https://api.yourdomain.onrender.com` (no trailing `/api`) |
| 12 | Deploy frontend on Vercel | User | Trigger build; verify at `https://yourapp.vercel.app` |
| 13 | Update GitHub OAuth app callback URL | User | Set Authorization callback URL to `https://api.onrender.com/api/auth/github/callback` |
| 14 | Run smoke tests from runbook (Step 12) | User + Claude | Manual checklist; all 14 items |
| 15 | β-0: authenticate with 2 real GitHub accounts | User | Verify cross-account isolation, session, logout |
| 16 | Verify structured logs appear in Render dashboard | User | Filter for `level=error` to confirm no errors |
| 17 | Upgrade Atlas to M2 (before β-1) | User | Atlas UI; ~$9/mo; enables automated backups |
| 18 | Upgrade Render to Starter (before β-1) | User | Render UI; ~$7/mo; eliminates cold starts |
| 19 | Invite β-1 external users with known limitations disclosed | User | Personal invitations; not mass distribution |

---

## 18. Final Readiness Verdict

### READY AFTER SPECIFIC BLOCKERS ARE RESOLVED

**Evidence:**

The NEXUS codebase is production-ready. Every code-level requirement for a production deployment has been met:

- 897/897 tests pass across all three workspaces.
- TypeScript compiles cleanly with no errors.
- Production build succeeds (`domain → api → web`).
- `npm audit` reports 0 vulnerabilities.
- Zod-validated environment schema fails fast with clear error messages on misconfiguration.
- CORS is locked to `FRONTEND_URL` (no wildcard).
- Security headers are in place (CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Cache-Control).
- Cookies are HttpOnly, Secure (production), SameSite=None (production).
- CSRF protection is implemented via `requireTrustedOrigin`.
- Session revocation persists across restarts.
- GitHub tokens are AES-256-GCM encrypted at rest.
- Error responses contain no stack traces or credential values.
- Graceful shutdown and unhandled rejection handlers are implemented.
- Health and readiness endpoints are present and correct.
- A comprehensive deployment runbook, private beta plan, and environment variable reference exist.

**The 7 P0 blockers are all provisioning actions, not code defects.** No code changes are required to deploy. The user must:

1. Create a MongoDB Atlas cluster.
2. Create a Render web service and configure environment variables.
3. Create a Vercel project and set `VITE_API_BASE_URL`.
4. Create a production GitHub OAuth application.
5. Generate and securely store `JWT_SECRET` and `TOKEN_ENCRYPTION_KEY`.

Once these five actions are complete, the deployment sequence in Section 17 can be executed and β-0 internal testing can begin.

**For β-1 (external users):** Also resolve P1-1 (Render cold starts), P1-2 (Atlas backup), P1-3 (TRUST_PROXY), P1-4 (privacy communication), and P1-5 (access control) before inviting anyone outside the development team.

---

## Audit Safety Confirmation

This was a read-only audit. The following actions were NOT taken:

- No infrastructure provisioned (no Atlas, Render, or Vercel resources created).
- No GitHub OAuth application created or modified.
- No production secrets generated or committed.
- No `.env` files modified.
- No application code, tests, or existing documentation modified.
- No deployment executed.
- No database connected or modified.
- No beta invitations sent.
- No git commits or pushes made.
- No infrastructure costs incurred.

The only new file created is this audit report: `reports/phase-8/PHASE_8_DEPLOYMENT_READINESS_AUDIT.md`.

**Git state at audit close:**
- Branch: main
- HEAD: f9c55ad
- Local == origin/main
- Working tree: 3 untracked files (2 pre-existing report files + this audit report)
