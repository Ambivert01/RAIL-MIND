# RailMind — Render Deployment Guide

> 📍 **You are here:** Deployment Guide &nbsp;|&nbsp; [Product Brief](Documentation.md) &nbsp;→&nbsp; [Setup Guide](SETUP.md) &nbsp;→&nbsp; [System Docs](System_Documentataion.md)
>
> ← [Back to README](../README.md)

Deploy the full RailMind stack (Next.js frontend + NestJS backend + PostgreSQL + Redis) to Render — completely free.

---

## What Gets Deployed

| Service | Where | Plan |
|---|---|---|
| NestJS API (`services/api`) | Render Web Service | Free |
| Next.js Frontend (`apps/web`) | Render Web Service | Free |
| PostgreSQL | Render Managed Database | Free |
| Redis | **External** — Upstash | Free |
| Neo4j | **External** — Neo4j AuraDB | Free |
| Qdrant | **External** — Qdrant Cloud | Free |

> Render removed their free Redis tier. We use Upstash instead — it's free, serverless, and works perfectly with the existing code.

---

## Phase 1 — Provision All External Services First

Do all of this before touching Render. You need 3 accounts.

---

### 1a. Neo4j AuraDB (Graph Database)

**What it's for:** Knowledge graph — stores relationships between assets, incidents, failure patterns.

1. Go to [console.neo4j.io](https://console.neo4j.io) → Sign up for free
2. Click **New Instance** → select **AuraDB Free**
3. After creation, a password is shown **once** — copy and save it immediately
4. Your instance dashboard shows the connection URI: `neo4j+s://xxxxxxxx.databases.neo4j.io`

**You'll need these 3 values:**

| Variable | Where to find it | Example |
|---|---|---|
| `NEO4J_URI` | Instance dashboard → Connection URI | `neo4j+s://34266ce9.databases.neo4j.io` |
| `NEO4J_USER` | Always `neo4j` (default) | `neo4j` |
| `NEO4J_PASSWORD` | Shown once at instance creation | `lwzlbHRmyjT1tjkw...` |

> ⚠️ **Important:** Use `neo4j+s://` (TLS) — not `bolt://`. AuraDB only accepts TLS connections.

---

### 1b. Qdrant Cloud (Vector Database)

**What it's for:** Semantic memory — stores vector embeddings of incidents, lessons, and procedures for AI search.

1. Go to [cloud.qdrant.io](https://cloud.qdrant.io) → Sign up for free
2. Click **New Cluster** → select the **Free** tier → choose any region
3. Once cluster is created, go to **API Keys** → click **Create API Key**
4. Copy the API key (shown once) and the cluster URL from the dashboard

**You'll need these 2 values:**

| Variable | Where to find it | Example |
|---|---|---|
| `QDRANT_URL` | Cluster dashboard → Cluster URL | `https://9ace80a4-0c8a-4587-824b-8d89a488a332.eu-central-1-0.aws.cloud.qdrant.io` |
| `QDRANT_API_KEY` | API Keys section → your created key | `eyJhbGciOiJIUzI1NiIsInR5cCI6...` |

---

### 1c. Upstash Redis (Cache + WebSocket Pub/Sub)

**What it's for:** Caching agent responses and real-time WebSocket event bus.

> Render removed free Redis. Upstash is the free alternative — works with the same `ioredis` code, no changes needed.

1. Go to [upstash.com](https://upstash.com) → Sign up for free
2. Click **Create Database** → select **Redis**
3. Choose any region → **Free** tier → Create
4. On the database dashboard, find **REST URL** section → copy the **`rediss://`** connection string (TLS version)

**You'll need this 1 value:**

| Variable | Where to find it | Example |
|---|---|---|
| `REDIS_URL` | Database dashboard → Redis connection string (TLS) | `rediss://default:PASSWORD@concrete-tetra-105681.upstash.io:6379` |

> ⚠️ Use the `rediss://` URL (with double `s`) — not `redis://`. The `s` means TLS/SSL which Upstash requires.

---

### 1d. OpenAI API Key (Optional but Recommended)

**What it's for:** Powers the 7-agent AI investigation pipeline and semantic embeddings.

> Without this key, the system still works — agents use template responses and embeddings use hash-based fallback.

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys) → Sign in
2. Click **Create new secret key** → copy it immediately (shown once)

| Variable | Where to find it |
|---|---|
| `OPENAI_API_KEY` | OpenAI dashboard → API Keys section |

---

## Phase 2 — Push Code to GitHub

Render deploys from Git. Push your code to GitHub if not already done:

```bash
git add .
git commit -m "chore: ready for Render deployment"
git remote add origin https://github.com/YOUR_USERNAME/railmind.git
git push -u origin main
```

---

## Phase 3 — Deploy on Render (Manual — Free)

Deploy in this exact order. Each service depends on the previous one.

---

### Step 1 — Create PostgreSQL Database

1. Go to [render.com](https://render.com) → **New** → **PostgreSQL**
2. Fill in:
   - Name: `railmind-postgres`
   - Database: `railmind`
   - User: `railmind`
   - Plan: **Free**
   - Region: Oregon (or closest to you)
3. Click **Create Database**
4. Wait for it to become available (~1 min)
5. On the database dashboard, copy the **Internal Database URL** — looks like:
   ```
   postgresql://railmind_user:PASSWORD@dpg-xxxxx-a/railmind_postgres
   ```

---

### Step 2 — Create API Service

1. Render → **New** → **Web Service**
2. Connect your GitHub repo
3. Fill in:
   - Name: `railmind-api`
   - Root Directory: *(leave blank)*
   - Runtime: **Node**
   - Build Command:
     ```
     npm install -g pnpm@8.15.9 && NODE_ENV=development pnpm install --frozen-lockfile && pnpm --filter @railmind/shared-types build && cd services/api && node_modules/.bin/prisma generate && node_modules/.bin/prisma db push && node_modules/.bin/nest build
     ```
   - Start Command:
     ```
     cd services/api && node dist/main
     ```
   - Plan: **Free**

4. Under **Environment Variables**, add each one individually (no quotes, just the value):

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `DATABASE_URL` | Internal URL from Step 1 |
| `REDIS_URL` | Upstash `rediss://...` URL |
| `NEO4J_URI` | `neo4j+s://xxxxxxxx.databases.neo4j.io` |
| `NEO4J_USER` | `neo4j` |
| `NEO4J_PASSWORD` | Your AuraDB password |
| `QDRANT_URL` | Your Qdrant cluster URL |
| `QDRANT_API_KEY` | Your Qdrant API key |
| `JWT_SECRET` | Any long random string (e.g. `railmind_super_secret_jwt_2024_xyz`) |
| `JWT_EXPIRY` | `7d` |
| `REFRESH_TOKEN_EXPIRY` | `30d` |
| `OPENAI_API_KEY` | Your OpenAI key (optional) |
| `FRONTEND_URL` | `https://railmind-web.onrender.com` |

5. Click **Create Web Service** — wait for build to complete (~5 min)

---

### Step 3 — Seed Demo Data

> ⚠️ **Render Shell requires a paid plan.** Run the seed from your **local machine** instead — it connects to the production database over the internet using the External Database URL.

**Get the External Database URL** from Render → `railmind-postgres` → **Info** tab → **External Database URL**. It looks like:
```
postgresql://railmind_postgres_user:PASSWORD@dpg-xxxxx-a.oregon-postgres.render.com/railmind_postgres
```

Run from your local machine (from the repo root):

```bash
cd services/api && \
DATABASE_URL="postgresql://railmind_postgres_user:PASSWORD@dpg-xxxxx-a.oregon-postgres.render.com/railmind_postgres" \
npx ts-node --transpile-only \
  --compiler-options '{"module":"commonjs","target":"ES2020","esModuleInterop":true,"allowSyntheticDefaultImports":true,"resolveJsonModule":true}' \
  ../../scripts/seed/index.ts
```

> ⚠️ **Critical:** Use the **External** URL (with full hostname like `dpg-xxxxx-a.oregon-postgres.render.com`), not the Internal URL. The Internal URL only works from within Render's network.

Expected output:
```
🚂 RailMind Demo World Seed Starting...
✅ PostgreSQL seeding complete
✅ Neo4j: 424 nodes, 423 relationships
✅ Qdrant: 100 incidents, 30 lessons, 10 procedures vectorized
🎉 Demo world seeded successfully!
```

Verify seed worked:
```bash
curl -X POST https://railmind-api.onrender.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@railmind.com","password":"railmind123"}'
```
You should get back a JWT token — if you get `401 Invalid credentials`, the seed did not reach the production DB (wrong DATABASE_URL used).

---

### Step 5 — Create Frontend Service

1. Render → **New** → **Web Service**
2. Connect same GitHub repo
3. Fill in:
   - Name: `railmind-web`
   - Root Directory: *(leave blank)*
   - Runtime: **Node**
   - Build Command:
     ```
     npm install -g pnpm@8.15.9 && NODE_ENV=development pnpm install --frozen-lockfile && pnpm --filter @railmind/shared-types build && pnpm --filter web build
     ```
   - Start Command:
     ```
     cd apps/web && node_modules/.bin/next start -p $PORT
     ```
   - Plan: **Free**

4. Environment Variables:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://railmind-api.onrender.com` |
| `NEXT_PUBLIC_WS_URL` | `https://railmind-api.onrender.com` |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Your Mapbox token (optional — fallback map works without it) |

5. Click **Create Web Service**

---

## Phase 4 — Verify Everything Works

| Check | URL |
|---|---|
| API health | `https://railmind-api.onrender.com/api/v1/health` |
| Frontend | `https://railmind-web.onrender.com` |

Login with: `admin@railmind.com` / `railmind123`

---

## All Environment Variables — Complete Reference

### railmind-api

| Variable | Required | Where to Get It |
|---|---|---|
| `NODE_ENV` | ✅ | Set to `production` |
| `PORT` | ✅ | Set to `3001` |
| `DATABASE_URL` | ✅ | Render PostgreSQL → Internal Database URL |
| `REDIS_URL` | ✅ | Upstash → Database → Redis connection string (TLS `rediss://`) |
| `NEO4J_URI` | ✅ | Neo4j AuraDB → console.neo4j.io → Instance URI |
| `NEO4J_USER` | ✅ | Always `neo4j` |
| `NEO4J_PASSWORD` | ✅ | Neo4j AuraDB → password shown at instance creation |
| `QDRANT_URL` | ✅ | Qdrant Cloud → cloud.qdrant.io → Cluster URL |
| `QDRANT_API_KEY` | ✅ | Qdrant Cloud → API Keys section |
| `JWT_SECRET` | ✅ | Any random string (keep secret) |
| `JWT_EXPIRY` | ✅ | `7d` |
| `REFRESH_TOKEN_EXPIRY` | ✅ | `30d` |
| `OPENAI_API_KEY` | Optional | platform.openai.com/api-keys |
| `ANTHROPIC_API_KEY` | Optional | console.anthropic.com |
| `FRONTEND_URL` | ✅ | `https://railmind-web.onrender.com` |

### railmind-web

| Variable | Required | Where to Get It |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ | `https://railmind-api.onrender.com` |
| `NEXT_PUBLIC_WS_URL` | ✅ | `https://railmind-api.onrender.com` |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Optional | account.mapbox.com → Tokens |

---

## Free Tier Limitations

| Service | Limit | Impact |
|---|---|---|
| Render Free Web Services | Spin down after 15 min inactivity | Cold start ~30-60s on first request |
| Render Free PostgreSQL | 1GB storage, expires after 90 days | Fine for demo |
| Upstash Redis Free | 10,000 commands/day, 256MB | Fine for demo |
| Neo4j AuraDB Free | 200K nodes, 400K relationships | More than enough |
| Qdrant Cloud Free | 1GB storage | More than enough |

---

## Troubleshooting

### Build fails: `ERR_PNPM_OUTDATED_LOCKFILE`
The `pnpm-lock.yaml` is out of sync. Fix locally and push:
```bash
pnpm install
git add pnpm-lock.yaml
git commit -m "fix: sync pnpm lockfile"
git push origin main
```

### Build fails: `moduleResolution=node10 is deprecated`
Already fixed in the repo — `packages/shared-types/tsconfig.json` has `"ignoreDeprecations": "5.0"`.

### Build fails: `useSearchParams() should be wrapped in a suspense boundary`
Already fixed in the repo — `apps/web/src/app/maintenance/new/page.tsx` wraps `useSearchParams` in `<Suspense>`.

### Neo4j: `authentication failure` (app still starts fine)
Neo4j auth failure does **not** prevent the app from starting — all other features work normally. To fix:
- Check `NEO4J_URI` starts with `neo4j+s://` not `bolt://`
- The password shown at AuraDB instance creation is the only valid password — if lost, delete the instance and create a new one, copying the password immediately
- Check for hidden leading/trailing spaces in the Render env var field
- Neo4j is only required for the Knowledge Graph feature — Dashboard, Twin, Risk, Agents all work without it

### Login returns `401 Invalid credentials` after seed
The seed ran against the wrong database (local Docker instead of production). Always use the **External Database URL** with the full hostname when seeding from your local machine:
```bash
DATABASE_URL="postgresql://user:pass@dpg-xxxxx-a.oregon-postgres.render.com/railmind_postgres" \
npx ts-node ...
```
Verify the URL contains `.oregon-postgres.render.com` — the Internal URL (without hostname) only works inside Render's network.

### Qdrant: `fetch failed` warnings on startup
- Verify `QDRANT_URL` is the full HTTPS cluster URL
- Check `QDRANT_API_KEY` is pasted correctly (it's a long JWT string)
- These are warnings only — the API still starts successfully

### Redis connection fails
- Make sure you're using the `rediss://` URL (with double `s`), not `redis://`
- Copy the TLS connection string from Upstash dashboard

### `devDependencies skipped` during build
- This is expected when `NODE_ENV=production`
- The build command uses `node_modules/.bin/` paths so devDeps aren't needed at runtime

### CORS errors on frontend
- Set `FRONTEND_URL` in API env vars to your exact Render web URL
- No trailing slash

### PostgreSQL: too many connections
Add pool params to `DATABASE_URL`:
```
postgresql://user:pass@host/db?connection_limit=5&pool_timeout=0
```

### Service returns 502 Bad Gateway
Free tier services spin down after 15 min inactivity. Go to Render → service → **Restart Service**. First request after cold start takes 30–60s.

---

> **Next steps:**
> - Run it locally first? → [Setup Guide](SETUP.md)
> - System internals? → [System Documentation](System_Documentataion.md)
> - ← [Back to README](../README.md)
