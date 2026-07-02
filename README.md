# RailMind — Cognitive Railway Operating System

AI-powered intelligence platform for railway infrastructure management. Combines a knowledge graph, semantic memory, multi-agent reasoning, and real-time digital twin to predict failures, investigate incidents, and generate maintenance recommendations.

---

## 📚 Documentation

| | Document | What you'll find |
|---|---|---|
| 📋 | [Product Brief](docs/Documentation.md) | Problem statement, 15 use cases, ROI, competitive analysis, Signal S11 story |
| ⚙️ | [Setup Guide](docs/SETUP.md) | Local development — step-by-step from clone to running app |
| 🚀 | [Deployment Guide](docs/DEPLOY.md) | Deploy to Render with Neo4j AuraDB + Qdrant Cloud |
| 🔬 | [System Documentation](docs/System_Documentataion.md) | Full A–Z technical reference: every module, agent, schema, API route |

> **New here? Start with the [Product Brief](docs/Documentation.md)** to understand what RailMind does and why, then come back to run it locally.

---

## Architecture

```
Frontend (Next.js 14)          Backend (NestJS)              AI Layer
─────────────────              ────────────────              ────────
Digital Twin (Mapbox)    →     16 REST modules         →    LangGraph (7 agents)
Knowledge Graph (ReactFlow)    WebSocket gateway             OpenAI GPT-4o-mini
Agent Console                  Prisma ORM                    Qdrant vector search
Risk Dashboard                                               Neo4j graph traversal
                               Databases
                               ──────────
                               PostgreSQL  (facts)
                               Neo4j       (relationships)
                               Qdrant      (semantic memory)
                               Redis       (cache + pub/sub)
```

---

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+ — install with `npm install -g pnpm@8`
- Docker Desktop (running)

### 1. Clone & Install

```bash
git clone <repo>
cd railmind
pnpm install
```

### 2. Environment Variables

Create environment files from the example:

```bash
cp .env.example .env
cp .env services/api/.env
cp .env.example apps/web/.env.local
```

The defaults in `.env.example` are pre-configured for local Docker. Optional keys to fill in:

**`services/api/.env`**
```env
OPENAI_API_KEY="sk-..."         # optional — enables GPT responses
```

**`apps/web/.env.local`**
```env
NEXT_PUBLIC_API_URL="http://localhost:3001"    # do NOT append /api/v1
NEXT_PUBLIC_WS_URL="http://localhost:3001"
NEXT_PUBLIC_MAPBOX_TOKEN="pk.eyJ1..."          # optional — fallback map works without it
```

> Without OpenAI key: agent responses use templates, vector search uses hash embeddings — all other features work normally.

### 3. Start Infrastructure

If you have old containers from a previous run, remove them first:

```bash
docker rm -f railmind_minio railmind_neo4j railmind_redis railmind_postgres railmind_qdrant 2>/dev/null || true
```

Start all databases:

```bash
docker compose up -d
# Wait ~30s for Neo4j to fully initialize
```

### 4. Build Shared Types

```bash
cd packages/shared-types
npx tsc
cd ../..
```

### 5. Database Setup

```bash
cd services/api
npx prisma db push
cd ../..
```

### 6. Seed Data

```bash
cd services/api
npx ts-node \
  --transpile-only \
  --compiler-options '{"module":"commonjs","target":"ES2020","esModuleInterop":true,"allowSyntheticDefaultImports":true,"resolveJsonModule":true}' \
  ../../scripts/seed/index.ts
cd ../..
```

Loads: 10 stations · 50 assets · 100 incidents · 30 lessons · 10 procedures · 50 recommendations · Risk scores for all assets · Signal S11 escalating storyline (5 incidents, risk 87/100)

### 7. Start Applications

**Terminal 1 — API:**

```bash
cd services/api
npm run dev
# Wait for: 🚂 RailMind API running on port 3001
```

**Terminal 2 — Frontend:**

```bash
cd apps/web
npm run dev
# Wait for: ✓ Ready in Xs
```

### 8. Initialize AI Memory & Graph

Once both are running (first time only):

```bash
bash scripts/start-demo.sh
```

This runs: Neo4j graph seeding → Risk recalculation → Qdrant vector ingestion

---

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Administrator | admin@railmind.com | railmind123 |
| Engineer | engineer@railmind.com | railmind123 |
| Operator | operator@railmind.com | railmind123 |
| Maintenance Manager | manager@railmind.com | railmind123 |
| Safety Officer | safety@railmind.com | railmind123 |

---

## Demo Walkthrough (Judge Path)

### Step 1 — Dashboard
Login as `engineer@railmind.com`. Dashboard shows:
- Network health across 50 assets
- 100 incidents with open/investigating/resolved breakdown
- Real-time agent activity feed

### Step 2 — Digital Twin
Navigate to **Twin**. The Mapbox map renders all 50 assets risk-colored:
- 🔴 Red = CRITICAL (score 81+)
- 🟠 Orange = HIGH (61–80)
- 🟡 Yellow = MODERATE (31–60)
- 🟢 Green = LOW (0–30)

Click **Signal S11** (Rivergate station, red marker).

### Step 3 — Asset Intelligence Profile
Signal S11 profile loads with 5 tabs:
- **Overview**: Health 13%, Risk 87/100 CRITICAL, 5 incidents
- **Incidents**: INC-044 through INC-090 — full escalation pattern
- **Maintenance**: Last maintenance history
- **Recommendations**: Pre-generated maintenance actions
- **Graph**: Relationship visualization

### Step 4 — Ask RailMind
Click **Ask RailMind** and type:
```
Why is Signal S11 unstable?
```
Watch the agent trail in real-time (WebSocket):
1. **EXECUTIVE** → Workflow started
2. **INCIDENT** → Found 5 similar incidents (INC-044, INC-057, INC-081, INC-061, INC-090)
3. **KNOWLEDGE** → Retrieved lessons on relay corrosion
4. **RISK** → Score 87/100 CRITICAL — weather correlation detected
5. **ENGINEER** → Relay replacement + housing seal inspection
6. **PLANNER** → Emergency inspection within 24 hours
7. **LEARNING** → Knowledge captured

Response includes:
- Root cause: Relay degradation + water ingress
- Evidence: 5 cited incidents
- Risk score: 87/100
- Confidence: ~85%
- Recommended action: Schedule emergency relay inspection

### Step 5 — Knowledge Graph
Navigate to **Graph**. Click Quick Load → **Signal S11**.

Visualizes (ReactFlow):
```
Signal S11 ──FAILED_IN──► INC-044 (Relay Corrosion)
                    └──► INC-057 (Water Ingress)
                    └──► INC-081 (Connector Degradation)
                    └──► INC-090 (Current Anomaly) ← ACTIVE
INC-044 ──HAS_CAUSE──► Relay Contact Degradation
INC-057 ──OCCURRED_DURING──► WeatherEvent:Heavy Rainfall
INC-044 ──RESOLVED_BY──► Resolution:Relay Replaced
Signal S11 ──PART_OF──► Station:Rivergate
INC-044 ──SIMILAR_TO──► INC-057
```

### Step 6 — Risk Intelligence Center
Navigate to **Risk**. Shows:
- Network KPIs: Critical assets count, average risk score
- Critical assets list with S11 at top
- Risk heatmap (50 asset grid, color-coded)
- 7-day trend chart (S11 escalating from 72→87)
- 30-day forecast per critical asset

### Step 7 — Recommendations
Navigate to **Recommendations**. Shows 50 recommendations:
- Filter by status: PENDING / APPROVED / IN_PROGRESS / COMPLETED
- Click approve/reject/complete on any recommendation
- S11 recommendation: "Replace relay — component 15 years past spec"

---

## API Reference

Swagger UI: `http://localhost:3001/api/v1/docs`

### Key Endpoints
```
POST /auth/login                    Authentication
GET  /twin/state                    Digital twin state (50 assets)
GET  /assets/:id/profile            Full asset intelligence profile
POST /agents/ask                    Trigger 7-agent investigation
GET  /graph/asset/:id               Asset knowledge graph
GET  /risk/dashboard                Network risk summary
GET  /risk/heatmap                  All 50 assets with risk scores
POST /memory/ingest-all             Batch vector ingestion
POST /graph/seed                    Seed Neo4j from PostgreSQL
POST /risk/recalculate              Recalculate all asset risk scores
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, Tailwind CSS, shadcn/ui |
| State | Zustand + React Query |
| Maps | Mapbox GL JS (+ fallback SVG grid) |
| Graph UI | ReactFlow 11 |
| Charts | Recharts |
| Animations | Framer Motion |
| Backend | NestJS 10, TypeScript |
| ORM | Prisma 5 |
| AI Orchestration | LangGraph 0.2 (StateGraph) |
| LLM | OpenAI GPT-4o-mini |
| Embeddings | OpenAI text-embedding-3-small |
| Graph DB | Neo4j 5 |
| Vector DB | Qdrant |
| Cache | Redis |
| Relational DB | PostgreSQL 15 |
| Real-time | Socket.io |
| API Docs | Swagger/OpenAPI |
| Monorepo | Turborepo + pnpm workspaces |

---

## Signal S11 Demo Storyline

Signal S11 at Rivergate Station has a documented failure pattern over 18 months:

| Incident | Date | Issue | Severity | Status |
|---------|------|-------|----------|--------|
| INC-044 | 18 months ago | Relay corrosion → intermittent failure | MEDIUM | RESOLVED |
| INC-057 | 14 months ago | Water ingress during heavy rainfall | HIGH | RESOLVED |
| INC-081 | 10 months ago | Connector degradation → comms loss | HIGH | RESOLVED |
| INC-061 | 8 months ago | Relay resistance drift detected | HIGH | RESOLVED |
| INC-090 | Current | Current anomaly — active investigation | CRITICAL | INVESTIGATING |

RailMind connects all 5 incidents through graph relationships, identifies the root cause pattern (relay degradation + environmental exposure), and recommends immediate relay replacement before total failure.

---

## Project Structure

```
railmind/
├── apps/
│   └── web/                    Next.js frontend
│       ├── src/app/            17 pages (all functional)
│       ├── src/components/     Shared UI components
│       ├── src/stores/         Zustand state stores
│       ├── src/hooks/          Custom hooks (WebSocket, etc.)
│       └── src/lib/            API client, utilities
├── services/
│   └── api/                    NestJS backend
│       ├── src/modules/        16 feature modules
│       ├── src/database/       DB service clients
│       ├── prisma/             Schema + migrations
│       └── src/common/         Guards, decorators, filters
├── packages/
│   ├── shared-types/           TypeScript interfaces
│   └── ui/                     Shared UI primitives
├── scripts/
│   ├── seed/                   Database seed script
│   ├── data/                   JSON seed data (50 assets, 100 incidents)
│   └── start-demo.sh           One-command demo setup
└── docker-compose.yml          Infrastructure stack
```

---

## Environment Without OpenAI

The system degrades gracefully:
- Agent answers use template fallback (not LLM-generated)
- Vector search uses deterministic hash embeddings (non-semantic)
- Risk scores, graph, and all other features work normally
- Warning displayed in `/memory/stats` response

For best demo quality, set `OPENAI_API_KEY`.

---

## Troubleshooting

**`pnpm: command not found`**
Install pnpm first: `npm install -g pnpm@8`

**Docker container name conflict**
Remove old containers: `docker rm -f railmind_minio railmind_neo4j railmind_redis railmind_postgres railmind_qdrant`

**`DATABASE_URL not found` during `prisma db push`**
Prisma needs `.env` inside `services/api/`. Run: `cp .env services/api/.env`

**Login fails in the browser**
Check `apps/web/.env.local` has `NEXT_PUBLIC_API_URL="http://localhost:3001"` — without `/api/v1`.

**Graph shows placeholder nodes (9 nodes)**
Neo4j not seeded. Run: `bash scripts/start-demo.sh` or `POST /api/v1/graph/seed` as admin.

**Memory search returns irrelevant results**
Qdrant not ingested. Run: `bash scripts/start-demo.sh` or `POST /api/v1/memory/ingest-all` as engineer+.

**Risk heatmap shows all green**
Risk not calculated. Run: `POST /api/v1/risk/recalculate` as admin.

**Map shows grid instead of Mapbox**
`NEXT_PUBLIC_MAPBOX_TOKEN` not set. All features work in fallback mode.

**Agent investigation hangs**
60-second timeout active. Check `OPENAI_API_KEY` validity.

**WebSocket not connecting**
Ensure `NEXT_PUBLIC_WS_URL` matches backend URL. Default: `http://localhost:3001`

**Stale build / UI errors after code changes**
Clear Next.js cache: `rm -rf apps/web/.next` then restart frontend.

---

## Documentation Index

| Document | Contents |
|---|---|
| [docs/Documentation.md](docs/Documentation.md) | Problem statement, 15 use cases, ROI, market context, competitive analysis, Signal S11 demo story |
| [docs/System_Documentataion.md](docs/System_Documentataion.md) | Full A–Z technical reference: every file, module, agent, schema, and API route explained |
| [docs/SETUP.md](docs/SETUP.md) | Complete local setup guide with all known fixes |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Deploy to Render — Neo4j AuraDB, Qdrant Cloud, PostgreSQL, Redis |
