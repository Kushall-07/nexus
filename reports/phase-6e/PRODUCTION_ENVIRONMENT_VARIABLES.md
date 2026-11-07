# NEXUS — Production Environment Variables Reference

**Date:** 2026-11-07  
**Source of truth:** `apps/api/src/config/env.ts`, `.env.example`

All variables are consumed by the **API server** (`apps/api`) unless explicitly noted as frontend-only.  
Variables marked **SECRET** must never be logged, committed, or exposed in error responses.

---

## Critical — Required (API will refuse to start if missing or invalid)

| Variable | Purpose | Format | Secret | Validation |
|---|---|---|---|---|
| `MONGODB_URI` | MongoDB connection string | `mongodb://user:pass@host:27017/nexus` or Atlas SRV | YES | Non-empty string |
| `JWT_SECRET` | Signs session JWTs | Random string ≥ 32 characters | YES | min-length 32 |
| `GITHUB_CLIENT_ID` | GitHub OAuth app ID | `Iv1.xxxxxxxxxxxxxxxx` | NO | Non-empty string |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app secret | 40 hex characters | YES | Non-empty string |
| `TOKEN_ENCRYPTION_KEY` | AES-256-GCM key for GitHub access tokens | Base64 string that decodes to exactly 32 bytes | YES | Exact 32-byte decode |
| `FRONTEND_URL` | Allowed CORS origin; OAuth callback base | `https://app.example.com` | NO | Valid HTTPS URL in production |
| `BACKEND_URL` | Used for redirect URIs and health | `https://api.example.com` | NO | Valid HTTPS URL in production |
| `NODE_ENV` | Runtime mode | `production` | NO | Enum: development / test / production |

**Generating secrets:**
```bash
# JWT_SECRET (64-char hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# TOKEN_ENCRYPTION_KEY (exactly 32 bytes → base64)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Important — Server Configuration

| Variable | Purpose | Default | Required | Notes |
|---|---|---|---|---|
| `PORT` | API listening port | `4000` | No | Integer 1–65535 |
| `TRUST_PROXY` | Number of trusted reverse-proxy hops | `0` | No | **Must match deployment topology.** 0 = direct; 1 = one load-balancer hop. Wrong value allows IP-header spoofing. |
| `ANALYSIS_COOLDOWN_MINUTES` | Minimum minutes between analysis runs per user | `15` | No | Prevents GitHub API quota exhaustion |
| `MAX_REPOSITORIES_PER_ANALYSIS` | Maximum repos scanned per analysis | `15` | No | Integer ≥ 1 |
| `MAX_REQUESTS_PER_REPOSITORY` | Maximum GitHub API calls per repo | `10` | No | Integer ≥ 1 |

---

## Optional — LLM Integration (AI explanations)

Leave all three blank to disable AI explanations entirely. Scoring never requires LLM.

| Variable | Purpose | Format | Secret | Notes |
|---|---|---|---|---|
| `LLM_PROVIDER` | AI provider | `groq` / `gemini` / `openai-compatible` | NO | Blank = disabled |
| `LLM_API_KEY` | Provider API key | Provider-specific | YES | Required if LLM_PROVIDER is set |
| `LLM_MODEL` | Model identifier | e.g. `llama-3.1-8b-instant` | NO | Required for openai-compatible |
| `LLM_BASE_URL` | Base URL (openai-compatible only) | `https://api.provider.com/v1` | NO | Required for openai-compatible; must be HTTPS in production |

---

## Optional — Job Providers

All providers are optional. If none are configured, the application shows clearly-labelled demo listings.

| Variable | Purpose | Format | Secret | Notes |
|---|---|---|---|---|
| `REMOTIVE_ENABLED` | Enable Remotive (free, no key) | `true` | NO | Public API; check attribution requirements |
| `ARBEITNOW_ENABLED` | Enable Arbeitnow (free, no key) | `true` | NO | Public API |
| `HIMALAYAS_ENABLED` | Enable Himalayas (free, no key) | `true` | NO | Public API |
| `ADZUNA_APP_ID` | Adzuna application ID | Alphanumeric | NO | Must be set with ADZUNA_APP_KEY |
| `ADZUNA_APP_KEY` | Adzuna application key | Alphanumeric | YES | Must be set with ADZUNA_APP_ID |
| `ADZUNA_COUNTRY` | Adzuna country code | `us` / `gb` / `au` etc. | NO | Default: `us` |
| `JSEARCH_API_KEY` | JSearch (RapidAPI) key | RapidAPI key string | YES | Subscription required |
| `JOB_CACHE_TTL_SECONDS` | In-memory cache lifetime for job results | Integer 0–86400 | NO | Default: `3600` (1 hour) |
| `JOB_PROVIDER_TIMEOUT_MS` | Per-provider HTTP request timeout | Integer 1000–30000 | NO | Default: `8000` (8 s) |

---

## Optional — Resume Handling

| Variable | Purpose | Default | Validation |
|---|---|---|---|
| `RESUME_MAX_BYTES` | Maximum accepted upload size | `5000000` (5 MB) | Integer 10000–10000000 |

---

## Frontend Build Variable (apps/web — build-time only)

| Variable | Purpose | Format | Required | Notes |
|---|---|---|---|---|
| `VITE_API_BASE_URL` | API origin embedded in frontend bundle | `https://api.example.com` | **Yes in production** | Set as CI/CD build variable or in `apps/web/.env.local`. Must NOT end with `/api`. Vite proxy is not used in production builds. |

**Critical:** Do not set `VITE_API_BASE_URL=https://api.example.com/api` — the frontend appends `/api` paths itself. A trailing `/api` causes double-prefix errors.

---

## Cross-Field Validation Rules (enforced at startup)

The API will refuse to start (with a clear error message) if:

1. `TOKEN_ENCRYPTION_KEY` does not decode to exactly 32 bytes from base64.
2. `LLM_PROVIDER=openai-compatible` but `LLM_BASE_URL` or `LLM_MODEL` is blank.
3. Exactly one of `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` is set (both or neither required).
4. In `NODE_ENV=production`: `FRONTEND_URL`, `BACKEND_URL`, or `LLM_BASE_URL` uses `http://` (must be `https://`).

---

## Production Checklist

- [ ] `NODE_ENV=production`
- [ ] `MONGODB_URI` points to production cluster with TLS (Atlas or self-hosted)
- [ ] `JWT_SECRET` is at least 64 random characters (not reused from dev/test)
- [ ] `TOKEN_ENCRYPTION_KEY` is a fresh 32-byte base64 key (not reused from dev/test)
- [ ] `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` from the production OAuth app (not dev app)
- [ ] `FRONTEND_URL` exactly matches the production frontend origin (no trailing slash)
- [ ] `BACKEND_URL` exactly matches the production API origin
- [ ] `TRUST_PROXY` matches the actual number of load-balancer hops
- [ ] `VITE_API_BASE_URL` is set during the frontend production build
- [ ] No `.env` file is committed or deployed; variables are injected via platform secrets
