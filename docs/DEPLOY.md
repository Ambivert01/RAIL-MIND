# RailMind — Render Deployment Guide

> 📍 **You are here:** Deployment Guide &nbsp;|&nbsp; [Product Brief](Documentation.md) &nbsp;→&nbsp; [Setup Guide](SETUP.md) &nbsp;→&nbsp; [System Docs](System_Documentataion.md)
>
> ← [Back to README](../README.md)

> Deploy the full stack (Next.js frontend + NestJS backend + PostgreSQL + Redis) to Render.

---

## What Gets Deployed

| Service | Render Type | Plan |
|---|---|---|
| NestJS API (`services/api`) | Web Service (Node) | Starter ($7/mo) |
| Next.js Frontend (`apps/web`) | Web Service (Node) | Starter ($7/mo) |
| PostgreSQL | Managed Database | Starter ($7/mo) |
| Redis | Key-Value (Redis-compatible) | Free |
| Neo4j | **External** — Neo4j AuraDB Free | Free |
| Qdrant | **External** — Qdrant Cloud Free | Free |

> **Why external Neo4j and Qdrant?** Render doesn't offer these databases natively. Both have generous free tiers and work perfectly over the internet.

---

## Step 1 — Provision External Services

### 1a. Neo4j AuraDB Free

1. Go to [console.neo4j.io](https://console.neo4j.io)
2. Create a free account → **New Instance** → **AuraDB Free**
3. Save the generated password somewhere safe (shown once)
4. Note your connection URI: `neo4j+s://xxxxxxxx.databases.neo4j.io`

You'll need:
- `NEO4J_URI` = the `neo4j+s://...` URI
- `NEO4J_PASSWORD` = the password you saved
- `NEO4J_USER` = `neo4j` (default)

### 1b. Qdrant Cloud Free

1. Go to [cloud.qdrant.io](https://cloud.qdrant.io)
2. Create account → **New Cluster** → Free tier
3. Create an API key under **API Keys**
4. Note your cluster URL: `https://xxxxxxxx.us-east4-0.gcp.cloud.qdrant.io`

You'll need:
- `QDRANT_URL` = the cluster URL
- `QDRANT_API_KEY` = the key you created

---

## Step 2 — Push Code to GitHub

Render deploys from Git. If not already on GitHub:

```bash
git add .
git commit -m "chore: add Render deployment config"
git remote add origin https://github.com/YOUR_USERNAME/railmind.git
git push -u origin main
```

---

## Step 3 — Deploy on Render

### Option A: Blueprint Deploy (Recommended — one click)

1. Go to [render.com](https://render.com) → **New** → **Blueprint**
2. Connect your GitHub repo
3. Render detects `render.yaml` and creates all services at once
4. Click **Apply** — Render provisions PostgreSQL, Redis, and both web services

### Option B: Manual (if Blueprint fails)

Deploy services in this order:
1. **Database** — New → PostgreSQL → name: `railmind-postgres`
2. **Redis** — New → Redis → name: `railmind-redis`
3. **API** — New → Web Service → connect repo, set root dir to `.`
4. **Web** — New → Web Service → connect repo, set root dir to `.`

Use the build/start commands from `render.yaml` for each.

---

## Step 4 — Set Environment Variables

After Render creates the services, fill in the `sync: false` variables:

### railmind-api (Dashboard → Environment)

| Variable | Value |
|---|---|
| `NEO4J_URI` | `neo4j+s://xxxxxxxx.databases.neo4j.io` |
| `NEO4J_PASSWORD` | your AuraDB password |
| `QDRANT_URL` | `https://xxxxxxxx.cloud.qdrant.io` |
| `QDRANT_API_KEY` | your Qdrant API key |
| `OPENAI_API_KEY` | (optional) your OpenAI key |
| `FRONTEND_URL` | `https://railmind-web.onrender.com` (your web URL) |

> `DATABASE_URL`, `REDIS_URL`, and `JWT_SECRET` are auto-set by the Blueprint.

### railmind-web (Dashboard → Environment)

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://railmind-api.onrender.com` |
| `NEXT_PUBLIC_WS_URL` | `https://railmind-api.onrender.com` |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | (optional) your Mapbox token |

---

## Step 5 — Run Database Migrations

After the API service is running, open its **Shell** tab on Render and run:

```bash
cd services/api
npx prisma db push
```

This creates all PostgreSQL tables.

---

## Step 6 — Seed Demo Data

In the same API Shell tab:

```bash
# From the repo root
node -e "
const { execSync } = require('child_process');
execSync('npx ts-node --transpile-only --compiler-options \'{\\"module\\":\\"commonjs\\"}\' scripts/seed/index.ts', { stdio: 'inherit' });
"
```

Or use the Render **One-off Job** / **Shell** to run it manually.

---

## Step 7 — Verify Deployment

| Check | URL |
|---|---|
| API health | `https://railmind-api.onrender.com/api/v1/health` |
| API docs | `https://railmind-api.onrender.com/api/docs` (dev only) |
| Frontend | `https://railmind-web.onrender.com` |

---

## WebSocket Note

Render supports WebSocket connections on all web services. The Socket.IO connection from the frontend uses `NEXT_PUBLIC_WS_URL`. Make sure it points to the API URL without trailing slash.

---

## Free Tier Limitations

- **Redis Free** — 25MB storage, no persistence between restarts
- **PostgreSQL Starter** — 1GB storage, 1 connection limit; consider using `?connection_limit=5&pool_timeout=0` in `DATABASE_URL`
- **Web Services** — Free plan spins down after 15 min inactivity; Starter plan stays always-on
- **Neo4j AuraDB Free** — 200K nodes, 400K relationships (more than enough for demo)
- **Qdrant Cloud Free** — 1GB storage (more than enough for demo vectors)

---

## Troubleshooting

### Build fails: `Cannot find module '@railmind/shared-types'`
The build command must run `pnpm --filter @railmind/shared-types build` before building the API or web. This is already in `render.yaml`. If it fails, check that `packages/shared-types/src/index.ts` compiles without errors.

### Neo4j connection error on startup
The API is configured to not throw on Neo4j connection failure — it logs the error and continues. Check your `NEO4J_URI` format: it must be `neo4j+s://` (TLS) not `bolt://` for AuraDB.

### `pnpm: command not found`
The build command installs pnpm globally with `npm install -g pnpm@8.15.9` before running workspace commands. If Render's node environment doesn't persist globals, add `export PATH="$PATH:$(npm root -g)/.bin"` at the start of the build command.

### CORS errors on frontend
Set `FRONTEND_URL` in the API service environment to your exact Render web URL (e.g., `https://railmind-web.onrender.com`). The API already allows all `*.onrender.com` origins as a fallback.

### PostgreSQL: too many connections
Add connection pooling params to `DATABASE_URL`:
```
postgresql://railmind:password@host:5432/railmind?connection_limit=5&pool_timeout=0
```

---

> **Next steps:**
> - Run it locally first? → [Setup Guide](SETUP.md)
> - System internals? → [System Documentation](System_Documentataion.md)
> - ← [Back to README](../README.md)
