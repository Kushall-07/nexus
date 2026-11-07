# Phase 6E — Deployment Readiness Report

**Date:** 2026-11-07  
**Branch:** main  
**HEAD (after Phase 6D local changes):** Pending commit approval  
**Engineer:** Claude Sonnet 4.6

---

## Executive Summary

NEXUS is **technically ready for a controlled private beta**, subject to the deployment-approval boundary below. All preparation has been completed locally. No live infrastructure has been provisioned. No paid services have been created. No external users have been invited.

The application passes all tests, typechecks, and production builds. All P0 and P1 security issues from Phase 6D have been resolved. Environment configuration is fully documented. A deployment runbook, private beta plan, and production environment variable reference are ready.

---

## Scope

| Area | Status |
|---|---|
| Deployment architecture selection | Complete |
| Production environment configuration documentation | Complete |
| Frontend production configuration verified | Complete |
| API production configuration verified | Complete |
| CI/CD readiness | Complete |
| Deployment runbook | Complete |
| Private beta strategy | Complete |
| Smoke-test checklist | Complete |
| Deployment approval boundary | Respected — no live actions taken |

---

## 6E.1 — Recommended Deployment Architecture

### Selected architecture

| Component | Recommendation | Rationale |
|---|---|---|
| Frontend | Static site: **Vercel**, Netlify, or Cloudflare Pages | Zero-config HTTPS, CDN, free tier adequate for beta, automatic SPA routing |
| API | PaaS: **Render** (or Railway/Fly.io) | Simple Node.js deployment, free tier available, automatic HTTPS, health check support |
| Database | **MongoDB Atlas** (M0 free for beta, M2+ for durability) | Managed service, TLS enabled by default, automated backups on M2+, familiar driver |
| File storage | None — resume files are processed in-memory and not persisted | Existing design is correct; no object storage needed |
| Logs | Platform-native log stream (stdout) | NEXUS emits structured JSON to stdout; all major platforms capture this |
| Backups | Atlas automated + optional `mongodump` cron | Documented in Phase 6D runbook |
| DNS / HTTPS | Platform-native (Vercel/Render manage SSL) | No manual certificate management for beta |

### Why not alternatives

| Alternative | Reason not recommended for private beta |
|---|---|
| Kubernetes | Extreme operational overhead for a single-instance private beta |
| Self-hosted MongoDB on VPS | Requires manual TLS, backup scripts, monitoring setup; Atlas is simpler for beta |
| Redis | Not needed: rate limiting and session revocation work correctly on single instance |
| AWS/GCP/Azure directly | Steeper setup and cost; PaaS is faster to validate |
| Docker + self-hosted | Acceptable, but adds operational burden; PaaS is preferred for beta |
| Vercel Serverless for API | Express is not serverless-native; session cookies and stateful connections require a persistent process |

---

## 6E.2 — Production Environment Configuration

All variables are documented in `reports/phase-6e/PRODUCTION_ENVIRONMENT_VARIABLES.md`.

**Readiness summary:**

| Variable category | Status |
|---|---|
| Required API secrets | Documented; generation commands provided |
| MongoDB URI | Documented; Atlas and self-hosted variants |
| GitHub OAuth | Documented; production app creation steps in runbook |
| CORS and origin configuration | Documented; cross-field rule explained |
| TRUST_PROXY | Documented; deployment-topology notes included |
| Optional LLM provider | Documented |
| Optional job providers | Documented |
| Frontend build variable (VITE_API_BASE_URL) | Documented; double-prefix warning included |

**No actual secrets have been generated, committed, or placed in any file.**

---

## 6E.3 — Frontend Production Configuration

| Concern | Status | Detail |
|---|---|---|
| `VITE_API_BASE_URL` | ✅ Ready | Validated by `validateApiBase()` at build time; production build requires HTTPS |
| No trailing `/api` in URL | ✅ Verified | Frontend appends `/api` prefix itself; documented in env var reference |
| `credentials: include` on fetch | ✅ Present | Required for cross-origin cookie auth |
| OAuth redirect compatibility | ✅ Verified | OAuth callback URL is on the API server, not the frontend |
| SPA fallback routing | ✅ Documented | `_redirects` for Netlify; Vercel handles automatically |
| Production build | ✅ Clean | 415 KB bundle / 117 KB gzip, 348 ms build time |
| Phase 6B `validateApiBase` preserved | ✅ Confirmed | Not modified in Phase 6D |

---

## 6E.4 — API Production Configuration

| Concern | Status | Detail |
|---|---|---|
| `NODE_ENV=production` enforcement | ✅ | Triggers HTTPS URL validation, Secure cookie, HSTS |
| Port binding | ✅ | `PORT` configurable; default 4000 |
| MONGODB_URI validation | ✅ | Zod: non-empty string; connection fail-fast 10s |
| CORS allowlist | ✅ | `FRONTEND_URL` only; not wildcard |
| `TRUST_PROXY` | ✅ | Documented; default 0 is safe |
| Secure cookie | ✅ | Auto-enabled in `NODE_ENV=production` |
| SameSite=None | ✅ | Auto-enabled in production (required for cross-origin) |
| Security headers | ✅ | CSP, HSTS (production only), X-Content-Type-Options, Referrer-Policy, Cache-Control |
| Request body limit | ✅ | 10 KB for JSON; `RESUME_MAX_BYTES` for uploads |
| Timeouts | ✅ | Provider: `JOB_PROVIDER_TIMEOUT_MS`; LLM: 20s; Resume parse: 15s |
| Health endpoints | ✅ | `/health` (liveness) and `/ready` (readiness + DB check) |
| Graceful shutdown | ✅ | SIGTERM/SIGINT handled; 10s force-exit timeout |
| Secret validation at startup | ✅ | Zod schema fails fast on first invalid variable |

---

## 6E.5 — CI/CD Readiness

The existing `.github/workflows/ci.yml` performs:

- TypeScript check: all 3 workspaces
- Tests: all 3 workspaces (888 tests total)
- Production build: domain → api → web

**Current status:** Reliable and reproducible. Runs on ubuntu-latest / Node 22. Uses `npm ci` for clean installs. Minimal permissions (`contents: read`).

**Recommended additions (future, not blocking beta):**

| Addition | Priority | Rationale |
|---|---|---|
| `npm audit --audit-level=high` step | P2 | Catches future CVEs in CI before they reach production |
| Lockfile validation (`npm ci --dry-run`) | P3 | Catches lockfile drift |
| PR-only validation job | P3 | Prevents broken PRs from landing on main |

**Not recommended yet:**
- Automatic production deployment: requires production secrets in GitHub Actions, which is a deployment-approval boundary action.

---

## 6E.6 — Deployment Runbook

Documented in `reports/phase-6e/DEPLOYMENT_RUNBOOK.md`.

The runbook covers:
1. Prerequisites
2. MongoDB setup (Atlas and self-hosted)
3. GitHub OAuth app creation
4. Secret generation
5. API deployment (Render, Railway, VPS/nginx)
6. Environment variable configuration
7. Frontend deployment (Vercel, Netlify, Cloudflare Pages)
8. CORS configuration
9. OAuth callback URL update
10. HTTPS configuration
11. Health verification
12. Smoke tests
13. Rollback procedure
14. Log inspection
15. Incident response
16. Common deployment failure table

---

## 6E.7 — Private Beta Strategy

Documented in `reports/phase-6e/PRIVATE_BETA_PLAN.md`.

Summary:
- **β-0:** 1–3 internal testers; stability confirmation.
- **β-1:** 5–15 invited external users; experience validation.
- **β-2:** 15–50 users; moderate load; scaling assessment.

Realistic single-instance capacity: ~10–30 concurrent users comfortably; ~1,000 registered users.

**100,000 concurrent users is not supported by the current architecture.** Long-term scale to 100,000+ registered users (not concurrent) is feasible with the current MongoDB schema but would require horizontal API scaling, Redis-backed rate limiting, and a CDN.

---

## 6E.8 — Deployment Smoke-Test Checklist

| Test | Method |
|---|---|
| Frontend loads | `curl -I https://app.example.com/` → HTTP 200 |
| API is reachable | `curl https://api.example.com/health` → `{"status":"ok"}` |
| Readiness reflects DB status | `curl https://api.example.com/ready` → `{"status":"ready"}` |
| Registration / auth works | Sign in with GitHub → authenticated state |
| OAuth flow works | Complete full OAuth flow end-to-end |
| Session persists | Reload page → still logged in |
| Logout works | Click logout → landing page; `/api/auth/me` → 401 |
| GitHub analysis works | Trigger analysis on a real GitHub account |
| Job aggregation works | Search for jobs; results appear or demo fallback shown |
| Resume upload works | Upload a PDF → extracted profile shown |
| Saved jobs work | Save a job; appears in saved list |
| Authorization boundary | Unauthenticated request to `/api/career/profile` → 401 |
| Error handling | Request a non-existent endpoint → 404, no stack trace |
| Mobile layout | Load on mobile browser or emulated viewport → responsive |
| Security headers present | `curl -I https://api.example.com/health` → CSP, HSTS, X-Content-Type-Options |

---

## 6E.9 — Deployment Approval Boundary

**The following actions have NOT been taken and require explicit approval:**

| Action | Status |
|---|---|
| Create paid cloud resources | ❌ Not done |
| Provision production database | ❌ Not done |
| Deploy frontend to live URL | ❌ Not done |
| Deploy API to live URL | ❌ Not done |
| Change DNS or purchase domain | ❌ Not done |
| Configure production GitHub OAuth app | ❌ Not done |
| Add production secrets to GitHub | ❌ Not done |
| Invite external beta users | ❌ Not done |
| Commit Phase 6D/6E changes | ❌ Not done — awaiting approval |
| Push Phase 6D/6E commits | ❌ Not done — awaiting approval |

**All preparation work is complete locally.** When you are ready to proceed, provide explicit approval and I will execute only the specific steps you authorize.

---

## Proposed Deployment Steps (Awaiting Approval)

When you approve deployment, here is the exact sequence I will follow:

1. Commit Phase 6D changes: `apps/api/src/server.ts` and `package-lock.json`.
2. Commit Phase 6E reports.
3. Push both commits to GitHub.
4. _(Requires your action)_ Set up MongoDB Atlas cluster.
5. _(Requires your action)_ Create production GitHub OAuth app.
6. _(Requires your action)_ Set environment variables on hosting platform.
7. _(Requires your action)_ Deploy API server.
8. _(Requires your action)_ Build and deploy frontend with `VITE_API_BASE_URL`.
9. Run health verification (`/health`, `/ready`).
10. Run smoke tests.
11. Confirm ready for β-0 internal testing.

**Expected cost:** Free tier (M0 Atlas + Render free + Vercel free) is $0/month. Upgrade to M2 Atlas ($9/month) is recommended if you want automated backups with < 24h RPO.

---

## Acceptance Criteria

| Criterion | Status |
|---|---|
| Recommended deployment architecture documented | ✅ PASS |
| Environment configuration readiness | ✅ PASS — all variables documented |
| CI/CD readiness | ✅ PASS — CI passes; improvements documented |
| Deployment runbook complete | ✅ PASS |
| Private beta readiness plan complete | ✅ PASS |
| Smoke-test checklist complete | ✅ PASS |
| External actions still awaiting approval | ✅ PASS — none taken |
| No paid services provisioned | ✅ PASS |
| No production secrets committed | ✅ PASS |

**Phase 6E status: PREPARATION COMPLETE — Awaiting deployment approval**
