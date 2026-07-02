# RailMind — Setup Guide

> 📍 **You are here:** Setup Guide &nbsp;|&nbsp; [Product Brief](Documentation.md) &nbsp;→&nbsp; [System Docs](System_Documentataion.md) &nbsp;→&nbsp; [Deploy](DEPLOY.md)
>
> ← [Back to README](../README.md)

> Complete step-by-step instructions. Follow in order. Do not skip steps.

---

## Prerequisites

Install these before starting. Check versions with the commands shown.

**Node.js 20+**

```bash
node --version   # must show v20.x.x or higher
```

Download: https://nodejs.org

**pnpm 8**

```bash
npm install -g pnpm@8
pnpm --version   # must show 8.x.x
```

**Docker Desktop**

```bash
docker --version          # must be installed
docker compose version    # must be installed
```

Download: https://docker.com/products/docker-desktop

---

## First-Time Setup (run once, in order)

### Step 1 — Clone and install dependencies

Open a terminal in the project folder and run:

```bash
pnpm install
```

Wait 1–2 minutes. This installs all packages for all workspaces.

> If `pnpm` is not found, install it first: `npm install -g pnpm@8`

---

### Step 2 — Create environment files

**Root `.env` (for backend and seed scripts):**

```bash
cp .env.example .env
```

**Copy it to the API service directory as well (Prisma requires it there):**

```bash
cp .env services/api/.env
```

**Frontend environment file:**

```bash
cp .env.example apps/web/.env.local
```

Open `apps/web/.env.local` and verify these two lines are correct:

```env
NEXT_PUBLIC_API_URL="http://localhost:3001"
NEXT_PUBLIC_WS_URL="http://localhost:3001"
```

**Optional keys to fill in:**

| Variable | What to put | Required? |
|---|---|---|
| `OPENAI_API_KEY` | Your OpenAI key from https://platform.openai.com/api-keys | Optional |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Your Mapbox token from https://account.mapbox.com | Optional |

> **Without API keys:** Everything still works. Agent responses use templates instead of GPT. The map shows a fallback grid instead of the interactive map.

---

### Step 3 — Start Docker infrastructure

If you have old RailMind containers from a previous run, remove them first:

```bash
docker rm -f railmind_minio railmind_neo4j railmind_redis railmind_postgres railmind_qdrant 2>/dev/null || true
```

Start all services:

```bash
docker compose up -d
```

Wait **30 seconds** after this command before continuing (Neo4j needs time to initialize).

Verify all are running:

```bash
docker compose ps
```

You should see all 5 containers with status `Up` or `healthy`.

---

### Step 4 — Build shared types

```bash
cd packages/shared-types
npx tsc
cd ../..
```

This compiles the shared TypeScript types that both frontend and backend depend on.

---

### Step 5 — Initialize the database

```bash
cd services/api
npx prisma db push
cd ../..
```

This creates all database tables in PostgreSQL. Takes about 30–60 seconds.

---

### Step 6 — Seed demo data

Run from the project root:

```bash
cd services/api
npx ts-node \
  --transpile-only \
  --compiler-options '{"module":"commonjs","target":"ES2020","esModuleInterop":true,"allowSyntheticDefaultImports":true,"resolveJsonModule":true}' \
  ../../scripts/seed/index.ts
cd ../..
```

Expected output:

```
🚂 RailMind Demo World Seed Starting...
🌱 Seeding PostgreSQL...
  ✅ 5 users created
  ✅ 10 stations created
  ✅ 50 assets created
  ✅ 100 incidents created
  ✅ 12 maintenance records created
  ✅ 30 lessons created
  ✅ 10 procedures created
  ✅ 50 recommendations created
  ✅ Alerts created
✅ PostgreSQL seeding complete
🌱 Seeding Neo4j Knowledge Graph...
  ✅ Neo4j: 424 nodes, 423 relationships
🌱 Seeding Qdrant vector collections...
  ✅ Qdrant: 100 incidents, 30 lessons, 10 procedures vectorized
🎉 Demo world seeded successfully!
```

---

## Running the App (every time you want to start)

You need **2 terminals** open side by side.

### Terminal 1 — Backend API

```bash
cd services/api
npm run dev
```

Wait until you see:

```
🚂 RailMind API running on port 3001
```

Leave this terminal running.

### Terminal 2 — Frontend

```bash
cd apps/web
npm run dev
```

Wait until you see:

```
✓ Ready in Xs
```

Leave this terminal running.

### Step 7 — Initialize AI memory and graph (first time only)

Once both terminals are running, open a third terminal:

```bash
bash scripts/start-demo.sh
```

This seeds the Neo4j knowledge graph, recalculates risk scores for all 50 assets, and ingests vectors into Qdrant.

---

## Open the App

| What | URL |
|---|---|
| **App (start here)** | http://localhost:3000 |
| **API Docs (Swagger)** | http://localhost:3001/api/docs |
| **Neo4j Browser** | http://localhost:7474 |
| **Qdrant Dashboard** | http://localhost:6333/dashboard |

---

## Login Credentials

| Role | Email | Password |
|---|---|---|
| Railway Engineer | engineer@railmind.com | railmind123 |
| Control Operator | operator@railmind.com | railmind123 |
| Maintenance Manager | manager@railmind.com | railmind123 |
| Safety Officer | safety@railmind.com | railmind123 |
| Administrator | admin@railmind.com | railmind123 |

---

## Stopping Everything

To stop the app: press `Ctrl+C` in both terminals.

To stop Docker services:

```bash
docker compose down
```

---

## Restarting After a Stop

Docker services persist data in volumes. You only need to restart Docker and the two app servers:

```bash
docker compose up -d
```

**Terminal 1 — Backend:**

```bash
cd services/api
npm run dev
```

**Terminal 2 — Frontend:**

```bash
cd apps/web
npm run dev
```

---

## Troubleshooting

**`pnpm: command not found`**

```bash
npm install -g pnpm@8
```

**Docker container name conflict on `docker compose up -d`**

Previous containers from another run are still around. Remove them:

```bash
docker rm -f railmind_minio railmind_neo4j railmind_redis railmind_postgres railmind_qdrant
docker compose up -d
```

**`DATABASE_URL not found` during `prisma db push`**

Prisma reads `.env` from `services/api/`, not the root. Run:

```bash
cp .env services/api/.env
```

Then retry `npx prisma db push` from inside `services/api/`.

**PostgreSQL auth error during `prisma db push`**

The Docker volume has an old password. Reset it:

```bash
docker exec railmind_postgres psql -U railmind -c "ALTER USER railmind WITH PASSWORD 'railmind_pass';"
```

Then retry `npx prisma db push`.

**Neo4j connection failed during seed**

Neo4j takes up to 60 seconds to start. Wait and retry the seed command.

**Login fails in the browser**

Check that `apps/web/.env.local` exists and has:

```env
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

Note: do NOT add `/api/v1` at the end — the API client appends it automatically.

**`module is not defined` CSS error or stale build**

Clear the Next.js cache and restart the frontend:

```bash
rm -rf apps/web/.next
cd apps/web
npm run dev
```

**Graph shows placeholder nodes**

Neo4j not seeded. Run: `bash scripts/start-demo.sh` or call `POST /api/v1/graph/seed` as admin.

**Memory search returns irrelevant results**

Qdrant not ingested. Run: `bash scripts/start-demo.sh` or call `POST /api/v1/memory/ingest-all` as engineer+.

**Risk heatmap shows all green**

Risk not calculated. Call `POST /api/v1/risk/recalculate` as admin.

**Map shows grid instead of Mapbox**

`NEXT_PUBLIC_MAPBOX_TOKEN` not set. All features work in fallback mode.

**Reset everything and start fresh**

```bash
docker compose down -v    # wipes all database volumes
docker rm -f railmind_minio railmind_neo4j railmind_redis railmind_postgres railmind_qdrant 2>/dev/null || true
docker compose up -d
sleep 30
cd services/api && npx prisma db push && cd ../..
# then run the seed command from Step 6
```

---

## What's Running Where

```
Browser → http://localhost:3000  (Next.js frontend)
             ↓
        http://localhost:3001  (NestJS backend API)
             ↓
   PostgreSQL :5432   — users, assets, incidents, maintenance
   Neo4j      :7687   — knowledge graph relationships
   Qdrant     :6333   — vector embeddings for semantic search
   Redis      :6379   — WebSocket event bus, cache
   MinIO      :9000   — file storage (reserved, not yet integrated)
```

---

> **Next steps:**
> - Want to deploy to production? → [Deployment Guide](DEPLOY.md)
> - Understand the system internals? → [System Documentation](System_Documentataion.md)
> - Why does this exist? → [Product Brief](Documentation.md)
> - ← [Back to README](../README.md)
