# NEXUS — Private Beta Plan

**Date:** 2026-11-07  
**Branch:** main (HEAD: 991951b, local Phase 6D changes pending commit approval)  
**Author:** Claude Sonnet 4.6

---

## Objective

Define a controlled, graduated rollout from zero users to a small invited beta cohort, with clear success criteria, support processes, rollback criteria, and a realistic capacity model.

---

## Phase Definitions

### Phase β-0 — Internal Testing (1–3 developers, no external users)

**Goal:** Confirm the production deployment is stable before any external user touches it.

**Duration:** 1–2 weeks

**Activities:**
- Deploy to production environment (requires Phase 6E approval).
- Run the smoke-test checklist from the deployment runbook.
- Authenticate with real GitHub accounts.
- Exercise all primary flows: analysis, job matching, resume upload, saved jobs, logout.
- Confirm OAuth callback works in production.
- Confirm session cookies are set correctly (HttpOnly, Secure, SameSite=None).
- Confirm structured logs appear in the hosting platform log stream.
- Confirm `/health` and `/ready` respond correctly under real load.
- Rotate JWT_SECRET once to verify it invalidates sessions cleanly.

**Exit criteria:**
- All smoke tests pass.
- No P0 / P1 errors in logs over a 48-hour window.
- Authorization boundaries confirmed: User A cannot read User B's data.
- OAuth flow works from two different GitHub accounts.

---

### Phase β-1 — Invited Alpha (5–15 users)

**Goal:** Validate the core user experience with real external users who can tolerate rough edges.

**Duration:** 2–4 weeks

**Selection criteria:**
- Known personally or professionally to the development team.
- Willing to provide structured feedback.
- Have public GitHub repositories (required for the core use case).
- Accept that data may be reset if a critical issue requires it.

**Onboarding:**
- Personal invitation (email or message) with the production URL.
- Include: what NEXUS does, what to try, how to submit feedback, known limitations.
- Do not send mass invitations; individual invitations allow easy revocation.

**Known limitations to communicate to alpha users:**
- GitHub analysis covers only public repositories.
- AI-powered explanations may not be available depending on LLM provider configuration.
- Job provider results depend on which APIs are configured.
- Resume parsing supports PDF and DOCX only.
- The application is in private beta — data may be reset.

**Feedback channel:** GitHub Issues (private) or a designated email address.

**Bug reporting:** Provide users with the correlation ID from error messages (displayed in UI error states) to help diagnose issues.

---

### Phase β-2 — Expanded Beta (15–50 users)

**Goal:** Stress-test the single-instance architecture under moderate real-world load.

**Prerequisites:**
- Phase β-1 completed with no unresolved P0/P1 issues.
- MongoDB backup verified (restore tested on a test cluster).
- Log monitoring in place.
- Known P3 issues documented and communicated.

**Monitoring targets:**
- API error rate < 1% (5xx responses)
- p99 response latency < 2 seconds for authenticated endpoints
- MongoDB connection pool utilization < 60%
- Zero unauthorized cross-user data accesses in logs

---

## Capacity Model

### Current architecture

The current NEXUS deployment is a **single-instance Node.js application** with a **single MongoDB cluster**.

| Component | Current | Private beta capacity |
|---|---|---|
| API server | Single process, single instance | Adequate for private beta |
| Rate limiting | In-memory per-process | Single instance: effective; multi-instance: not synchronized |
| Session revocation | In-memory + MongoDB persistence | Single instance: reliable |
| Job results cache | In-memory, 200 entries max | Adequate for small cohort |
| MongoDB connections | Pool of 50 | Adequate for private beta scale |
| File upload | In-memory, no disk | Adequate; no temporary file accumulation |

### Realistic capacity for private beta

| Metric | Realistic estimate | Notes |
|---|---|---|
| Registered users | Up to ~1,000 | No architectural changes needed |
| Concurrent active users | 10–30 comfortably; 50 at peak | Single Node.js process handles async I/O efficiently |
| Analysis runs per hour | ~20–50 | GitHub API quota is the main bottleneck (5,000 req/hour per token) |
| Job searches per minute | ~30 (rate-limited) | Per-user limit enforced |
| Resume uploads per hour | No specific limit beyond rate limit | In-memory parsing, fast |

**What is NOT claimed:**
- 100,000 concurrent users is not supported by the current architecture.
- No load testing has been conducted.
- The above estimates are based on architectural inspection, not benchmarks.

### What would need to change to scale beyond beta

| Requirement | Current limitation | Future change |
|---|---|---|
| >50 concurrent users | Single process | Horizontal scaling with shared session state |
| Cross-instance rate limiting | In-memory per-process | Redis-backed rate limiter |
| Cross-instance session revocation | In-memory per-process | Redis pub/sub or shared revocation store |
| GitHub API quota | Per-user token | No change needed (each user has their own quota) |
| Resume parsing under heavy load | In-memory, synchronous | Worker queue for large documents |

---

## Data Retention Expectations (Private Beta)

| Data type | Retention | User control |
|---|---|---|
| Account and profile | Until account deletion | `POST /api/auth/account/delete` |
| GitHub analysis results | Until account deletion | Implicit with account deletion |
| Saved jobs | Until deleted or account deletion | `DELETE /api/saved-jobs/:id` |
| Resume extracted text | Until resume deleted or account deletion | `DELETE /api/resume` |
| Session tokens | 7 days (JWT expiry) | Invalidated on logout |
| Revoked sessions record | Until TTL expires (~7 days) | Automatic |
| Application logs | Platform retention (varies) | Not user-controlled; no PII in logs |

**Note for beta users:** Data may be reset if a critical database issue requires a restore. Beta users will be notified in advance of any planned data reset.

---

## Rollback Criteria

Immediately roll back (revert to previous version and/or restore database) if any of the following occur:

- P0 security issue: cross-user data access, authentication bypass, or token exposure.
- Data corruption affecting multiple users.
- API unavailable for >30 minutes without a known fix.
- Database in an unrecoverable state.
- Accidental exposure of secrets in logs or responses.

Rollback procedure: see `DEPLOYMENT_RUNBOOK.md` Step 13.

---

## Incident Handling

### Severity levels

| Level | Criteria | Response time | Communication |
|---|---|---|---|
| P0 | Security breach, data corruption, complete outage | Immediate | Personal notification to all affected users |
| P1 | Partial outage, major feature broken for >10% of users | < 1 hour | Status update via feedback channel |
| P2 | Feature degraded, workaround available | < 24 hours | Note in known issues |
| P3 | Cosmetic or minor | Next release | — |

### Incident response steps

1. Identify the issue from logs (use `level=error` filter and correlation IDs).
2. Assess severity.
3. For P0: take the application offline immediately; communicate to users.
4. Apply fix or roll back.
5. Verify with health checks and smoke tests.
6. Restore service.
7. Post-incident review: what happened, root cause, permanent fix.

---

## Success Metrics (Private Beta)

| Metric | Target |
|---|---|
| Uptime | > 99% over any 7-day window |
| Analysis completion rate | > 95% of initiated analyses complete without error |
| Authentication success rate | > 99% of OAuth flows complete |
| Zero P0 security incidents | Mandatory |
| NPS / qualitative feedback | Gather from every alpha user |
| User-reported bugs with reproduction steps | < 10 open at end of β-1 |

---

## Deployment Approval Boundary

The following actions require **explicit approval before execution**:

- Creating paid cloud resources (Atlas M2+, hosting platform paid tier).
- Provisioning the production database.
- Deploying the frontend or backend to a live URL.
- Changing DNS records or purchasing a domain.
- Configuring the production GitHub OAuth application.
- Adding production secrets to GitHub Actions or any CI/CD system.
- Inviting external beta users.
- Pushing Phase 6D/6E commits to GitHub.

**All preparation is complete. No live deployment action has been taken.**
