# NEXUS — Deployment Runbook

**Date:** 2026-11-07  
**Branch:** main  
**Target:** Controlled private beta (single-instance)

This runbook is intended for a developer who has not previously deployed NEXUS. Follow each step in order. Do not skip sections.

All credential placeholders use `<PLACEHOLDER>` notation. Never substitute real secrets into this file.

---

## Prerequisites

### Accounts and services required

| Service | Purpose | Cost | Link |
|---|---|---|---|
| GitHub account | Source code and OAuth app | Free | github.com |
| Node.js 20+ | API runtime | Free | nodejs.org |
| MongoDB Atlas (or self-hosted) | Database | Free tier (M0) available | mongodb.com/atlas |
| Static hosting (Vercel / Netlify / Cloudflare Pages) | Frontend | Free tier available | — |
| PaaS (Render / Railway / Fly.io) or VPS | API server | Free tier or ~$5–7/mo | — |
| Domain name (optional for beta) | Custom URL | ~$10–15/year | — |

### Local tools

```bash
node --version    # Must be >= 20.0.0
npm --version     # Must be >= 10.0.0
git --version     # Any recent version
```

---

## Step 1 — Clone and install

```bash
git clone https://github.com/Kushall-07/nexus.git
cd nexus
npm ci               # Clean install from lockfile — do not use npm install
```

Verify no errors. All packages should install from the lockfile.

---

## Step 2 — Set up MongoDB

### Option A — MongoDB Atlas (recommended for beta)

1. Create a free Atlas account at mongodb.com/atlas.
2. Create a new **Shared** cluster (M0 free tier is sufficient for beta).
3. In **Database Access**, create a database user with `readWrite` on the `nexus` database (do not use admin user).
4. In **Network Access**, add your API server's IP address (or `0.0.0.0/0` temporarily for initial testing — restrict before launch).
5. Click **Connect** → **Connect your application** → copy the connection string.
6. Replace `<password>` and `<dbname>` in the string:
   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/nexus?retryWrites=true&w=majority
   ```
7. Enable **Atlas Backups** (available from M2+). For M0, plan daily `mongodump` exports.

### Option B — Self-hosted MongoDB

```bash
# Start MongoDB (Docker example)
docker run -d \
  --name nexus-mongodb \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=nexus_user \
  -e MONGO_INITDB_ROOT_PASSWORD=<DB_PASSWORD> \
  -v nexus-mongodb-data:/data/db \
  mongo:7

# Connection string
MONGODB_URI=mongodb://nexus_user:<DB_PASSWORD>@localhost:27017/nexus?authSource=admin
```

---

## Step 3 — Create the GitHub OAuth application

1. Go to **GitHub Settings** → **Developer settings** → **OAuth Apps** → **New OAuth App**.
2. Fill in:
   - **Application name:** NEXUS (or your preferred name)
   - **Homepage URL:** `https://app.example.com` (your frontend URL)
   - **Authorization callback URL:** `https://api.example.com/api/auth/github/callback`
3. Click **Register application**.
4. Note the **Client ID**.
5. Click **Generate a new client secret** and note the **Client Secret** immediately (shown once).

**Important:** Create a separate OAuth app for production, never reuse the development app.

---

## Step 4 — Generate production secrets

Run these commands locally. Store outputs in your secrets manager — never commit them.

```bash
# JWT_SECRET (64-char hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# TOKEN_ENCRYPTION_KEY (32 bytes as base64)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Step 5 — Deploy the API server

### Option A — Render (recommended for simplicity)

1. Go to render.com → New → **Web Service**.
2. Connect your GitHub repository.
3. Configure:
   - **Root Directory:** leave blank (monorepo root)
   - **Build Command:** `npm ci && npm run build --workspace=packages/domain && npm run build --workspace=apps/api`
   - **Start Command:** `node apps/api/dist/server.js`
   - **Node version:** 20
4. Set environment variables (see Step 6).
5. Configure the **Health Check Path:** `/health`

### Option B — Railway

1. New project → Deploy from GitHub repo.
2. Select the repository.
3. Set **Start Command:** `node apps/api/dist/server.js`
4. Set environment variables (see Step 6).

### Option C — VPS (nginx reverse proxy)

```bash
# On the server
npm ci
npm run build --workspace=packages/domain
npm run build --workspace=apps/api

# Create systemd service (see /etc/systemd/system/nexus-api.service):
# ExecStart=/usr/bin/node /path/to/nexus/apps/api/dist/server.js
# WorkingDirectory=/path/to/nexus
# Environment variables: set in EnvironmentFile=/etc/nexus/api.env

# nginx example (reverse proxy to port 4000)
server {
    listen 443 ssl;
    server_name api.example.com;
    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        # Set TRUST_PROXY=1 in env to trust this header
    }
}
```

---

## Step 6 — Set API environment variables

Configure the following on your hosting platform (never in a committed file):

```
NODE_ENV=production
PORT=4000
MONGODB_URI=<atlas-or-self-hosted-uri>
JWT_SECRET=<generated-in-step-4>
TOKEN_ENCRYPTION_KEY=<generated-in-step-4>
GITHUB_CLIENT_ID=<from-step-3>
GITHUB_CLIENT_SECRET=<from-step-3>
FRONTEND_URL=https://app.example.com
BACKEND_URL=https://api.example.com
TRUST_PROXY=1
```

Optional (enable as needed):
```
REMOTIVE_ENABLED=true
ARBEITNOW_ENABLED=true
HIMALAYAS_ENABLED=true
ADZUNA_APP_ID=<id>
ADZUNA_APP_KEY=<key>
JSEARCH_API_KEY=<key>
LLM_PROVIDER=groq
LLM_API_KEY=<key>
```

Verify startup: check platform logs for `NEXUS API running on port 4000`.  
Check health: `curl https://api.example.com/health` → `{"status":"ok"}`

---

## Step 7 — Deploy the frontend

### Build the frontend with the production API URL

```bash
# Set the API URL as a build variable (replace with your actual API URL)
VITE_API_BASE_URL=https://api.example.com npm run build --workspace=apps/web
```

The compiled output is in `apps/web/dist/`.

### Option A — Vercel

1. Import the repository in Vercel.
2. Set **Framework Preset:** Vite.
3. Set **Root Directory:** `apps/web`.
4. Set build environment variable: `VITE_API_BASE_URL=https://api.example.com`
5. Set **Build Command:** `npm run build`
6. Set **Output Directory:** `dist`
7. Deploy.

**SPA routing:** Vercel handles this automatically for Vite projects.

### Option B — Netlify

1. Import the repository.
2. Set **Base directory:** `apps/web`
3. Set **Build command:** `npm run build`
4. Set **Publish directory:** `apps/web/dist`
5. Set environment variable: `VITE_API_BASE_URL=https://api.example.com`
6. Add `apps/web/public/_redirects`:
   ```
   /*    /index.html    200
   ```
   (Required for client-side routing)

### Option C — Cloudflare Pages

1. Connect repository.
2. Set framework preset: Vite.
3. Set root directory: `apps/web`.
4. Set build environment variable: `VITE_API_BASE_URL=https://api.example.com`

---

## Step 8 — Configure CORS

The API's CORS allowlist is set by `FRONTEND_URL`. It must exactly match the origin of the deployed frontend:

- If frontend is at `https://app.example.com`, set `FRONTEND_URL=https://app.example.com`
- No trailing slash.
- If using `www.`, include it: `FRONTEND_URL=https://www.app.example.com`

The API sets `SameSite=None; Secure` on session cookies in production, which is required for cross-origin cookie authentication.

---

## Step 9 — Update the GitHub OAuth callback URL

After both frontend and API are deployed and you know the final URLs:

1. Go to GitHub Settings → Developer settings → OAuth Apps → your production app.
2. Update **Authorization callback URL** to `https://api.example.com/api/auth/github/callback`.
3. Update **Homepage URL** to `https://app.example.com`.

---

## Step 10 — HTTPS configuration

- **Vercel / Netlify / Cloudflare Pages**: HTTPS is automatic.
- **Render**: HTTPS is automatic on `onrender.com` subdomains; also supports custom domains with auto-SSL.
- **Custom domain + nginx**: Use Certbot (Let's Encrypt):
  ```bash
  certbot --nginx -d api.example.com
  ```

The API enforces HTTPS at the env-validation layer: `FRONTEND_URL` and `BACKEND_URL` must start with `https://` in production mode.

---

## Step 11 — Health verification

After deployment:

```bash
# 1. API liveness
curl https://api.example.com/health
# Expected: {"status":"ok","service":"nexus-api"}

# 2. API readiness (confirms MongoDB connected)
curl https://api.example.com/ready
# Expected: {"status":"ready","service":"nexus-api"}
# If 503: check MONGODB_URI, Atlas network access, DB user permissions

# 3. Frontend loads
curl -I https://app.example.com/
# Expected: HTTP/2 200

# 4. API CORS
curl -v -H "Origin: https://app.example.com" https://api.example.com/health
# Expected: Access-Control-Allow-Origin: https://app.example.com
```

---

## Step 12 — Smoke tests

Run through each item manually or with the Playwright E2E suite (requires separate E2E environment):

- [ ] Frontend loads at the production URL
- [ ] Landing page displays correctly on desktop and mobile
- [ ] "Sign in with GitHub" button is visible and correct
- [ ] OAuth flow: click Sign in → GitHub authorization page → callback → authenticated state
- [ ] After auth: sidebar navigation loads (Skill Graph, Role Gaps, etc.)
- [ ] GitHub username displayed in app header
- [ ] Skill overview page loads (may be empty for a new user — expected)
- [ ] "Connect GitHub" or "Analyze" flow works
- [ ] Job search returns results (or demo listings if no providers configured)
- [ ] Logout works; session cookie is cleared
- [ ] After logout: re-visiting the app shows the landing page
- [ ] Unauthenticated API requests return 401 (not 500)
- [ ] `GET /api/auth/me` returns 401 without cookie

---

## Step 13 — Rollback procedure

### API rollback

The API is stateless (all state in MongoDB). To roll back to a previous version:

1. In your hosting platform, redeploy the previous commit or image.
2. Or locally: `git checkout <previous-commit> && npm run build --workspace=apps/api`
3. Restart the server.
4. Run `GET /health` and `GET /ready` to verify.

### Frontend rollback

Static files are immutable. Roll back by redeploying a previous build:

1. In Vercel/Netlify/Cloudflare Pages, go to **Deployments** and promote a previous deployment.

### Database rollback

If a schema change caused data issues:

1. Stop the API server to prevent further writes.
2. Restore from the most recent Atlas snapshot (Atlas UI → Cluster → Restore).
3. Restore to a test cluster first, verify data, then restore to production.
4. Restart the API server on the compatible version.

**Warning:** Restoring MongoDB overwrites all data since the backup point. Ensure the restore point is verified before proceeding.

---

## Step 14 — Log inspection

### Structured logs

NEXUS outputs JSON logs to stdout. Each line is a JSON object:

```json
{"ts":"2026-11-07T12:00:00.000Z","level":"info","msg":"request finished","correlationId":"abc123","method":"GET","path":"/api/auth/me","status":200,"durationMs":12}
```

**Fields:**
- `ts`: ISO 8601 timestamp
- `level`: `info` / `warn` / `error`
- `msg`: event name
- `correlationId`: UUID, unique per request — use to trace a request across log lines
- `method`, `path`, `status`, `durationMs`: HTTP telemetry

**Filtering errors:**
```bash
# In Render/Railway: filter by level=error in the dashboard
# Locally: use jq
cat api.log | jq 'select(.level == "error")'
```

**Filtering a specific request by correlation ID:**
```bash
cat api.log | jq 'select(.correlationId == "abc123")'
```

---

## Step 15 — Incident response

### API not responding

1. Check platform health dashboard for resource exhaustion (CPU, memory).
2. `GET /health` → timeout: API process crashed or hung. Restart.
3. `GET /health` → 200 but `GET /ready` → 503: MongoDB connection lost. Check Atlas status, network access rules, URI.
4. Check logs for `Uncaught exception` or `Unhandled promise rejection` messages.

### Authentication failures

1. Check GitHub OAuth app settings: callback URL must match exactly.
2. Check `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are set correctly.
3. Check `FRONTEND_URL` matches the actual frontend origin exactly.
4. Check `JWT_SECRET` is set and unchanged (rotation invalidates all sessions).

### Database connection issues

1. Check Atlas status page.
2. Verify IP allowlist in Atlas Network Access.
3. Verify database user credentials and `readWrite` permission.
4. Check `MONGODB_URI` encoding (special characters in password must be percent-encoded).

### High error rate (5xx)

1. Filter logs: `jq 'select(.status >= 500)'`
2. Look for correlation IDs with errors; trace the full request.
3. Check for `Unhandled promise rejection` — if present, review recent code changes.

---

## Common Deployment Failures

| Symptom | Cause | Fix |
|---|---|---|
| API exits at startup with Zod error | Missing or invalid environment variable | Read the error message — it names the variable and the constraint |
| `GET /ready` returns 503 | MongoDB not reachable | Check URI, network access, DB user credentials |
| OAuth callback fails | Mismatched callback URL | Update GitHub OAuth app callback URL to match exactly |
| Session cookie not sent | CORS / SameSite mismatch | Verify `FRONTEND_URL` matches frontend origin; ensure HTTPS on both |
| `VITE_API_BASE_URL` wrong | Double `/api` in requests | Set URL without trailing `/api`: `https://api.example.com` |
| 401 on all API requests | `JWT_SECRET` changed | Re-login; changing JWT_SECRET invalidates all sessions |
| Frontend shows blank page | SPA routing not configured | Add `_redirects` (Netlify) or equivalent fallback rule |
| Rate limit errors during testing | `TRUST_PROXY` wrong | Match `TRUST_PROXY` to actual proxy count; default 0 is safe |
