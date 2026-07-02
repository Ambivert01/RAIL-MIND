# RailMind — Complete System Documentation
## A to Z Technical Reference

> 📍 **You are here:** System Documentation &nbsp;|&nbsp; [Product Brief](Documentation.md) &nbsp;→&nbsp; [Setup Guide](SETUP.md) &nbsp;→&nbsp; [Deploy](DEPLOY.md)
>
> ← [Back to README](../README.md)

**Version:** 1.0.0 | **Stack:** Next.js 14 · NestJS 10 · LangGraph 0.2 · Neo4j 5 · Qdrant 1.9 · PostgreSQL 16 · Redis 7

---

# PART 1: SYSTEM OVERVIEW

## 1.1 What is RailMind?

RailMind is a **Cognitive Railway Operating System** — an AI-powered intelligence platform for railway infrastructure management. It combines four distinct intelligence layers:

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Operational Facts** | PostgreSQL + Prisma | Assets, incidents, maintenance history, recommendations |
| **Relationship Intelligence** | Neo4j knowledge graph | How assets connect, why incidents recur, who resolved them |
| **Semantic Memory** | Qdrant + OpenAI embeddings | Find relevant lessons/procedures by meaning, not keyword |
| **Reasoning Engine** | LangGraph + OpenAI GPT-4o-mini | 7-agent pipeline to investigate, recommend, and learn |

**Core Value Proposition:**
When Signal S11 shows an anomaly, RailMind doesn't just log it. It investigates: searches 100 historical incidents, traverses the knowledge graph, retrieves relevant lessons from semantic memory, computes risk propagation to connected assets, generates engineering recommendations, schedules maintenance, and learns from each resolution — all in one automated pipeline.

## 1.2 System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js 14)                        │
│  Dashboard │ Digital Twin │ Agents │ Graph │ Risk │ Incidents │ ...  │
│                    Zustand State + React Query                        │
│                  Socket.io Client (WebSocket)                         │
└─────────────────────┬────────────────────────────┬───────────────────┘
                      │ REST API (Axios)             │ WebSocket
                      ▼                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         BACKEND (NestJS 10)                          │
│                                                                       │
│  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌───────┐ ┌────────────────┐  │
│  │  Auth   │ │  Assets  │ │Incident│ │  Risk │ │    Agents      │  │
│  │  JWT    │ │  Twin    │ │  Graph │ │Memory │ │  (LangGraph)   │  │
│  │ Roles  │ │Analytics │ │Maint.  │ │Search │ │  7 AI Agents   │  │
│  └─────────┘ └──────────┘ └────────┘ └───────┘ └────────────────┘  │
│                                                                       │
│  Global: ValidationPipe · Helmet · ThrottleGuard · ExceptionFilter   │
│           RolesGuard · JwtAuthGuard · WebSocket Gateway              │
└──────┬────────────────────┬───────────────────┬──────────────────────┘
       │                    │                    │
       ▼                    ▼                    ▼
┌─────────────┐    ┌─────────────────┐   ┌─────────────────────────┐
│ PostgreSQL  │    │     Neo4j 5     │   │      Qdrant 1.9          │
│ (Facts DB)  │    │  (Graph DB)     │   │   (Vector Memory)        │
│ 13 tables   │    │ 10 node types   │   │  6 collections           │
│ Prisma ORM  │    │ 12 rel types    │   │  Cosine similarity       │
└─────────────┘    └─────────────────┘   └─────────────────────────┘
       │
       ▼
┌─────────────┐
│    Redis    │
│  (Cache +   │
│  Pub/Sub)   │
└─────────────┘
```

## 1.3 Monorepo Structure

```
railmind/                          ← Turborepo root
├── apps/
│   └── web/                       ← Next.js 14 frontend
├── services/
│   └── api/                       ← NestJS 10 backend
├── packages/
│   ├── shared-types/              ← TypeScript interfaces shared FE+BE
│   └── ui/                        ← Shared React UI primitives
├── scripts/
│   ├── seed/index.ts              ← Database seeder
│   ├── data/                      ← JSON seed data files
│   └── start-demo.sh              ← One-command demo setup
├── docker-compose.yml             ← All infrastructure services
├── package.json                   ← Root workspace config
├── pnpm-workspace.yaml            ← PNPM workspace definition
├── turbo.json                     ← Turborepo pipeline config
└── README.md                      ← Setup and demo guide
```

---

# PART 2: INFRASTRUCTURE (docker-compose.yml)

**File:** `docker-compose.yml`

Defines 5 infrastructure services on the `railmind_network` Docker network:

### PostgreSQL 16
```
Container:  railmind_postgres
Port:       5432
Database:   railmind
User:       railmind / railmind_pass
Volume:     postgres_data
Health:     pg_isready -U railmind (every 10s)
```
Primary relational database. Stores all operational facts: assets, incidents, maintenance records, recommendations, users, risk scores, audit logs.

### Neo4j 5.19 Community
```
Container:  railmind_neo4j
Ports:      7474 (Browser UI), 7687 (Bolt protocol)
Auth:       neo4j / railmind_neo4j
Plugins:    APOC (Advanced Procedures)
Memory:     512MB–1GB heap
Volume:     neo4j_data, neo4j_logs
```
Graph database. Stores the Railway Knowledge Graph: 10 node types, 12 relationship types. Powers "why does this keep happening?" queries through graph traversal. Access browser UI at `http://localhost:7474`.

### Qdrant 1.9.0
```
Container:  railmind_qdrant
Ports:      6333 (HTTP), 6334 (gRPC)
Volume:     qdrant_data
```
Vector database for semantic memory. Stores embeddings of incidents, lessons, procedures, maintenance records, and recommendations. Enables "find similar situations" queries using cosine similarity. Dashboard at `http://localhost:6333/dashboard`.

### Redis 7
```
Container:  railmind_redis
Port:       6379
Persistence: appendonly yes (AOF)
Volume:     redis_data
```
Used for: agent result caching (60s TTL), pub/sub event bus (future), session store (future).

### MinIO (reserved)
```
Container:  railmind_minio
Ports:      9000 (API), 9001 (Console)
```
Object storage for future document management (maintenance manuals, reports). Currently reserved — not integrated in application code.

---

# PART 3: BACKEND — NestJS API

**Directory:** `services/api/`

## 3.1 Entry Point — `src/main.ts`

The NestJS bootstrap function. Configures the application in order:

1. **CORS** — allowlist: `localhost:3000`, `FRONTEND_URL`, `*.onrender.com`
2. **Helmet** — security headers (CSP disabled for Mapbox compatibility)
3. **GlobalExceptionFilter** — catches all exceptions, formats consistent JSON errors, hides stack traces in production
4. **Global prefix** — all routes under `/api/v1`
5. **ValidationPipe** — `whitelist: true`, `transform: true`, `enableImplicitConversion: true` — enables DTO validation and automatic type coercion
6. **WebSocket adapter** — Socket.io adapter for real-time agent thoughts
7. **Swagger** — available at `/api/docs` in development only
8. **Health check** — `GET /api/v1/health` checks PostgreSQL connectivity, returns `{status, db, timestamp}`
9. **Shutdown hooks** — `enableShutdownHooks()` + `SIGTERM` handler for graceful container shutdown

## 3.2 Configuration — `src/config/configuration.ts`

Centralized configuration factory. Returns typed config object from environment variables:

```typescript
{
  port,           // PORT env, default 3001
  nodeEnv,        // NODE_ENV
  database.url,   // DATABASE_URL (PostgreSQL connection string)
  neo4j.{uri, user, password},
  qdrant.{url, apiKey},
  redis.url,
  jwt.{secret, expiry, refreshExpiry},
  ai.{openaiApiKey, defaultModel, embeddingModel},
  frontend.url,
}
```

**JWT Secret Guard:** Throws in production if `JWT_SECRET` is not set. Warns in development. Prevents accidental deployment with insecure default.

## 3.3 App Module — `src/app.module.ts`

Root NestJS module. Imports all 16 feature modules plus:
- `ConfigModule.forRoot()` — loads `.env`, makes config injectable
- `ThrottlerModule` — 200 requests/60 seconds global rate limit
- `APP_GUARD` providers: `JwtAuthGuard` (global JWT check), `ThrottlerGuard`, `RolesGuard` (enforces `@Roles()` decorator)

## 3.4 Database Services — `src/database/`

### `prisma.service.ts`
Extends `PrismaClient`. Manages PostgreSQL connection lifecycle:
- `onModuleInit()` — connects to DB
- `onModuleDestroy()` — disconnects cleanly
- `healthCheck()` — runs `$queryRaw\`SELECT 1\`` to verify connectivity
- Query logging: development only (prevents SQL exposure in production)

### `neo4j.service.ts`
Wraps `neo4j-driver` v5. Manages the Neo4j connection:
- `onModuleInit()` — creates driver, verifies connectivity, initializes schema (7 node constraints)
- `getSession(write?)` — returns session with correct access mode
- `query(cypher, params)` — **READ** session, `executeRead()` — returns plain JS objects
- `write(cypher, params)` — **WRITE** session, `executeWrite()` — returns void
- `runTransaction(queries[])` — multiple writes in one transaction
- `healthCheck()` — `driver.verifyConnectivity()`
- Graceful: if Neo4j is down, app starts without it (graph features degrade, not crash)

### `qdrant.service.ts`
Wraps `@qdrant/js-client-rest`. Manages vector collections:
- `onModuleInit()` — connects, creates all 6 collections if absent
- Collections: `incidents`, `lessons`, `procedures`, `maintenance`, `recommendations`, `manuals`
- All collections: `size: 1536` (OpenAI text-embedding-3-small), `distance: Cosine`
- `upsert(collection, points[])` — insert/update vectors with payload
- `search(collection, vector, limit, filter?)` — semantic similarity search
- `delete(collection, id)` — remove by ID
- `getCollectionInfo(name)` — collection stats

### `redis.service.ts`
Wraps `ioredis`. Cache and pub/sub:
- `get<T>(key)` — returns `JSON.parse(val)` or null
- `set(key, value, ttlSeconds?)` — stores `JSON.stringify(value)` with optional TTL
- `delete(key)` — remove key
- `publish(channel, message)` — pub/sub
- `subscribe(channel, handler)` — listen for events
- `healthCheck()` — `client.ping()`
- Graceful: if Redis is down, operations return null (cache miss) — never blocks the request

## 3.5 Common — `src/common/`

### `decorators/roles.decorator.ts`
```typescript
@Roles("ADMINISTRATOR", "ENGINEER")
```
Attaches required roles as metadata to a route. The global `RolesGuard` reads this metadata and compares against `req.user.role` from the JWT.

### `filters/global-exception.filter.ts`
Catches ALL exceptions (HTTP + unexpected). Returns consistent JSON:
```json
{
  "statusCode": 404,
  "message": "Incident INC-044 not found",
  "path": "/api/v1/incidents/INC-044",
  "timestamp": "2026-06-24T10:00:00.000Z"
}
```
In development: includes `details` with stack trace. In production: hides all internal details.

---

# PART 4: BACKEND MODULES

## 4.1 Auth Module — `src/modules/auth/`

### `auth.module.ts`
Imports `PassportModule`, `JwtModule` (configured with `JWT_SECRET` and `7d` expiry), `LocalStrategy`, `JwtStrategy`.

### `auth.service.ts`
- `validateUser(email, password)` — bcrypt comparison, returns sanitized user
- `login(user)` — issues `accessToken` (7d) + `refreshToken` (30d) via JWT sign
- `refresh(refreshToken)` — validates refresh token, issues new access token
- `changePassword(userId, currentPassword, newPassword)` — verifies current, hashes new with bcrypt cost 10

### `auth.controller.ts`
| Route | Auth | Purpose |
|-------|------|---------|
| `POST /auth/login` | None | Issue JWT tokens |
| `POST /auth/refresh` | None | Refresh access token |
| `GET /auth/me` | JWT | Get current user profile |
| `POST /auth/logout` | JWT | Client-side logout (stateless) |
| `POST /auth/change-password` | JWT | Change own password |

### `strategies/jwt.strategy.ts`
Extracts Bearer token from `Authorization` header. Validates against `JWT_SECRET`. Attaches `{ id, email, role }` to `req.user`.

### `strategies/local.strategy.ts`
Username/password strategy for `POST /auth/login`. Calls `authService.validateUser()`.

## 4.2 Assets Module — `src/modules/assets/`

### `assets.service.ts`
- `findAll(filters?)` — list assets with station info, optional filter by `assetType`, `status`, `stationId`
- `findOne(id)` — single asset with full station info
- `findByCode(code)` — find by `assetCode` (e.g. "S11")
- `getProfile(id)` — **Full intelligence profile:** asset + incident history (last 10) + maintenance history (last 5) + active recommendations + active risk record + alerts + computed stats (`daysSinceLastMaintenance`, `totalIncidents`, `resolvedIncidents`, `openIncidents`)
- `getTwinAssets()` — lightweight list for Digital Twin map (id, code, type, status, healthScore, riskScore, lat/lng, station)

### `assets.controller.ts`
| Route | Roles | Purpose |
|-------|-------|---------|
| `GET /assets` | Any auth | List all assets |
| `GET /assets/twin` | Any auth | Twin-optimized asset list |
| `GET /assets/:id` | Any auth | Single asset detail |
| `GET /assets/:id/profile` | Any auth | Full intelligence profile |
| `GET /assets/code/:code` | Any auth | Find by asset code |

## 4.3 Incidents Module — `src/modules/incidents/`

### `incidents.service.ts`
Core incident lifecycle management. Wired with `LearningAgent` via `forwardRef` to prevent circular dependency.

- `findAll(filters?)` — list with asset/station info, recommendations preview, event count
- `findOne(id)` — full incident with events, recommendations
- `create(data)` — creates incident, assigns `INC-NNN` number, creates INCIDENT_CREATED event, **emits WebSocket event** via `AgentsGateway`
- `update(id, data)` — patch any field
- `close(id, resolution, rootCause?, lessons?)` — marks RESOLVED, creates INCIDENT_RESOLVED event, **triggers `learningAgent.onIncidentClosed(id)`** for knowledge capture
- `addEvent(incidentId, data)` — append to incident timeline
- `getTimeline(id)` — incident + all events ordered by timestamp
- `getSimilarIncidents(assetId, excludeId?, limit?)` — incidents on same asset type (RESOLVED only for similarity)
- `getInvestigation(id)` — full investigation package: incident + similar + root causes + timeline + recommendations
- `getStats()` — counts by status + active critical count

### `incidents.controller.ts`
| Route | Roles | Purpose |
|-------|-------|---------|
| `GET /incidents` | Any auth | List with filters |
| `GET /incidents/stats` | Any auth | Status counts |
| `GET /incidents/:id` | Any auth | Single incident |
| `GET /incidents/:id/timeline` | Any auth | Event timeline |
| `GET /incidents/:id/similar` | Any auth | Similar incidents |
| `GET /incidents/:id/investigation` | Any auth | Full investigation package |
| `POST /incidents` | ENGINEER+ | Create new incident |
| `PATCH /incidents/:id` | ENGINEER+ | Update fields |
| `POST /incidents/:id/close` | ENGINEER+ | Resolve with root cause |
| `POST /incidents/:id/events` | ENGINEER+ | Add timeline event |

## 4.4 Risk Module — `src/modules/risk/`

### `risk.service.ts`
The Risk Intelligence Engine.

**`calculateAndSaveRisk(assetId, hasWeatherRisk?)`** — Core risk calculation:
```
riskScore = 0
+ (100 - healthScore) × 0.3     ← health factor (max 30)
+ min(40, incidentCount × 10)   ← incident history factor
+ maintenanceDelay × 0.2        ← maintenance timeliness (max 20)
+ weatherBoost (10 if weather)  ← weather risk factor
+ ageFactor                     ← age of asset

severity = CRITICAL if ≥81, HIGH if ≥61, MODERATE if ≥31, LOW otherwise
recommendation = human-readable action based on score
```
Saves to `RiskRecord` with `isActive: true`, deactivates previous.

**`getDashboard()`** — Returns: criticalAssets, highRiskAssets, topRisks (all active), stats (counts + avg), networkTrend (7-day).

**`getHeatmap()`** — Returns ALL 50 assets with risk scores. Assets without risk records default to score 0 (green). Powers the heatmap grid on the Risk page.

**`getTrends()`** — Single DB query + in-memory grouping for 7-day trend (was 7 serial queries — now 1).

**`getAssetRisk(assetId)`** — Latest active risk record for one asset.

**`getForecast()`** — Top critical assets with predicted trajectory.

**`recalculateAll()`** — Recomputes risk for all 50 assets in parallel batches of 10.

### `risk.controller.ts`
| Route | Roles | Purpose |
|-------|-------|---------|
| `GET /risk/dashboard` | Any auth | Full risk dashboard |
| `GET /risk/heatmap` | Any auth | All 50 assets with scores |
| `GET /risk/trends` | Any auth | 7-day trend |
| `GET /risk/forecast` | Any auth | Critical asset forecast |
| `GET /risk/assets/:id` | Any auth | Single asset risk |
| `POST /risk/recalculate` | ADMIN + | Recalc all assets |
| `POST /risk/assets/:id/calculate` | ENGINEER+ | Recalc one asset |

## 4.5 Agents Module — `src/modules/agents/`

The heart of RailMind. Orchestrates the 7-agent LangGraph pipeline.

### `agents.service.ts`
- `ask(request)` — Entry point. Checks Redis cache (60s TTL). On miss: emits `workflow:started` WebSocket event, invokes `ExecutiveAgent.run()`, caches result, emits `workflow:completed`.
- `getAgentStatus()` — 7 agent descriptors + last 10 runs
- `getAgentHistory(limit)` — AgentRun records from PostgreSQL
- `getAgentRun(id)` — Single run with full thought trail

### `agents.gateway.ts`
Socket.io WebSocket gateway on namespace `/ws`.

Event emitters:
- `emitAgentThought(thought)` → broadcasts `agent:thought`
- `emitWorkflowStarted(question)` → broadcasts `workflow:started`
- `emitWorkflowCompleted(response)` → broadcasts `workflow:completed`
- `emitAgentCompleted(name, output)` → broadcasts `agent:completed`
- `emitIncidentCreated(incident)` → broadcasts `incident:created` ← wired to incidents.service
- `emitRiskUpdate(assetId, risk)` → broadcasts `risk:update`

### `agents.controller.ts`
| Route | Throttle | Purpose |
|-------|---------|---------|
| `GET /agents/status` | Global | 7 agents + recent runs |
| `GET /agents/history` | Global | Run history |
| `GET /agents/:id` | Global | Single run |
| `POST /agents/ask` | **5/min** | Trigger investigation |

`POST /agents/ask` uses `AskRailMindDto` validation:
- `question`: string, 5–500 chars, required
- `assetId`: string, optional

### `dto/ask-railmind.dto.ts`
Input validation for the Ask endpoint. Uses `class-validator` decorators with descriptive error messages. Prevents empty questions from entering the LangGraph pipeline.

---

# PART 5: AI AGENT SYSTEM

## 5.1 Executive Agent — `agents/executive.agent.ts`

**The orchestrator.** Builds and runs the LangGraph `StateGraph` in the constructor, then `invoke()`s it on every request.

### LangGraph StateGraph

State schema (`Annotation.Root`):
```typescript
{
  request:         AskRailMindRequest   // incoming question + assetId
  asset:           any                  // loaded asset with station
  thoughts:        AgentThought[]       // accumulated from all agents (merge reducer)
  incidentResult:  IncidentAgentOutput
  knowledgeResult: KnowledgeAgentOutput
  riskResult:      RiskAgentOutput
  engineerResult:  EngineerAgentOutput
  plannerResult:   PlannerAgentOutput
  hasWeatherRisk:  boolean
  onThought:       callback function    // streams thoughts to WebSocket
}
```

### Node Graph

```
START
  ↓
load_asset          ← Loads asset + station from PostgreSQL
  ↓
incident_agent      ← Searches incident history + Qdrant hybrid search
  ↓
knowledge_agent     ← Retrieves lessons and procedures from memory
  ↓
risk_agent          ← Calculates risk + Neo4j graph propagation
  ↓
engineer_agent      ← Generates technical recommendations from root causes
  ↓ (conditional)
  ├── [riskScore ≥ 31] → planner_agent  ← Creates maintenance schedule
  └── [riskScore < 31] → learning_agent
  ↓
learning_agent      ← Updates memory with new context
  ↓
END
  ↓
DecisionService.synthesize()  ← 7-layer decision synthesis
```

### Timeout & Error Handling
- `Promise.race()` with 60-second timeout
- `DecisionService` has 3-attempt LLM retry with exponential backoff

## 5.2 Incident Agent — `agents/incident.agent.ts`

**Investigates historical incident patterns.**

Input: `{ query, assetId, assetCode, assetType }`

Process:
1. Direct query: finds all incidents for this asset (ALL statuses — including OPEN/INVESTIGATING)
2. Hybrid search: queries Qdrant `incidents` collection by question semantics
3. Neo4j query: finds SIMILAR_TO incidents in graph
4. Deduplication + merging of all three sources
5. Root cause extraction from incident `rootCause` fields
6. Pattern detection (most common root cause across all results)

Output: `{ similarIncidents[], rootCauses[], confidence, evidence[], thoughts[] }`

**Confidence formula:** `50 + min(40, incidentCount × 10) + (rootCauses.length × 5)`

## 5.3 Knowledge Agent — `agents/knowledge.agent.ts`

**Retrieves organizational memory and institutional knowledge.**

Input: `{ query, assetId, incidentIds[] }`

Process:
1. Semantic search: queries Qdrant `lessons` collection by question meaning
2. Procedure search: queries Qdrant `procedures` collection
3. Graph traversal: finds lessons linked to the specific incidents via `LEARNED_FROM` relationships
4. Builds context string from top lessons for the decision engine

Output: `{ lessons[], procedures[], confidence, thoughts[] }`

## 5.4 Risk Agent — `agents/risk.agent.ts`

**Computes and propagates risk scores.**

Input: `{ assetId, incidentCount, rootCauses[], hasWeatherRisk }`

Process:
1. Calls `riskService.calculateAndSaveRisk(assetId, hasWeatherRisk)` — saves to PostgreSQL
2. If `hasWeatherRisk`: boosts score by +15 if formula didn't capture it
3. **Risk Propagation:** Neo4j query `PART_OF` traversal — finds co-located assets at same station
4. Applies risk bump to connected assets: CRITICAL=+20, HIGH=+12, LOW=+6
5. Triggers async `calculateAndSaveRisk()` for each affected neighbor

Output: `{ riskScore, severity, confidence, propagatedAssets[], possibleFailure, thoughts[] }`

## 5.5 Engineer Agent — `agents/engineer.agent.ts`

**Generates technical maintenance recommendations.**

Input: `{ rootCauses[], assetType, riskScore }`

Process:
1. Maps root causes to known failure categories (relay, water, connector, mechanical, software, power)
2. Fetches relevant procedures from database by category
3. Generates specific `action` strings per root cause
4. Determines `estimatedResolutionTime` based on severity
5. Computes confidence from recommendation count + procedure count

Output: `{ recommendations[], primaryAction, procedures[], estimatedResolutionTime, confidence, thoughts[] }`

## 5.6 Planner Agent — `agents/planner.agent.ts`

**Creates actionable maintenance schedules.** Only runs if `riskScore ≥ 31`.

Input: `{ assetId, recommendations[], riskScore, assetType }`

Process:
1. Creates maintenance work order in PostgreSQL if one doesn't exist for this asset
2. Determines `scheduledDate`: CRITICAL → today, HIGH → 7 days, MODERATE → 30 days
3. Assigns priority based on risk score
4. Saves `MaintenanceRecord` with agent-generated description

Output: `{ workOrderId, scheduledDate, priority, estimatedDuration, thoughts[] }`

## 5.7 Learning Agent — `agents/learning.agent.ts`

**Captures and preserves institutional knowledge.** Has two entry points:

### `run(input)` — Called during investigation
- Ingests any `resolvedIncidents` passed in from the investigation into Qdrant
- Reports current memory statistics (lesson count, procedure count)
- Non-destructive: only adds, never modifies existing knowledge

### `onIncidentClosed(incidentId)` — Called when incident is resolved
This is the full knowledge capture pipeline:
1. Ingests incident into Qdrant `incidents` collection (embedding the full text)
2. If `lessonsLearned` + `rootCause` both exist: auto-creates `LessonLearned` record in PostgreSQL with tags
3. Ingests the new lesson into Qdrant `lessons` collection
4. Creates `AuditLog` entry `KNOWLEDGE_CAPTURED`
5. Emits completion thought

## 5.8 Decision Service — `src/modules/decision/decision.service.ts`

**7-layer evidence synthesis and final answer generation.**

Called after all agents complete. Takes combined results from all 6 specialist agents.

| Layer | Function | Description |
|-------|----------|-------------|
| 1 | `evaluateEvidence()` | Scores evidence quality: incidents (max 40) + lessons (max 20) + root causes (20) + weather (10) + factors (10) |
| 2 | `synthesizeContext()` | Builds context string for LLM: asset + root causes + risk score + weather flag |
| 3 | Recommendation | Picks primary action from engineer output |
| 4 | `calculatePriority()` | IMMEDIATE / HIGH / MEDIUM / LOW based on composite of risk + evidence + weather |
| 5 | `computeConfidence()` | Weighted: incident 45% + knowledge 30% + risk 25% + evidence bonus − no-data penalty |
| 6 | `resolveConflicts()` | 3 rules: low formula + high incident count → bump risk; weather not reflected → bump; low confidence + CRITICAL → downgrade |
| 7 | `buildExplainabilityChain()` | 6-step reasoning audit trail returned in response |

**Answer generation:** Calls OpenAI GPT-4o-mini with structured context. Falls back to `templateAnswer()` if OpenAI unavailable or fails after 3 retries.

---

# PART 6: REMAINING BACKEND MODULES

## 6.1 Graph Module — `src/modules/graph/`

### `graph.service.ts`
Manages the Neo4j knowledge graph.

**`createSchema()`** — Creates 12 UNIQUE constraints on startup.

**`seedFromPostgres()`** — Full graph seeding pipeline (called via admin endpoint):
1. Stations → `Station` nodes
2. Assets → `Signal`, `Track`, `Switch`, `Asset` nodes + `PART_OF` → Station
3. Incidents (ALL statuses) → `Incident` nodes + `FAILED_IN` → Asset
4. Root causes → `RootCause` nodes + `HAS_CAUSE` → Incident
5. Resolutions → `Resolution` nodes + `RESOLVED_BY` → Incident
6. Weather → `WeatherEvent` nodes + `OCCURRED_DURING` → Incident (from `incident.weatherCondition`)
7. `SIMILAR_TO` — bulk Cypher: same asset type incidents, `LIMIT 500`
8. Engineers → `Engineer` nodes (from Users with ENGINEER/ADMINISTRATOR/MAINTENANCE_MANAGER role) + deterministic `RESOLVED` → Incident
9. `RELATED_TO` — incidents sharing same root cause
10. Lesson → Incident `LEARNED_FROM` links
11. `AFFECTED_BY` — Station → Incident (via asset)
12. Procedures → `Procedure` nodes
13. `CONNECTED_TO` — co-located assets at same station (same type, `LIMIT 200`)
14. Recommendations → `Recommendation` nodes + `HAS_RECOMMENDATION` → Asset

**`getAssetGraph(assetId)`** — 3-hop traversal from asset, returns nodes + edges with UUID IDs (TD-001 fixed: uses `startNode(rel).id` not `rel.start`).

**`getNeighbours(nodeId, nodeType, depth)`** — Expand from any node up to N hops.

**`getIncidentGraph(incidentId)`** — Incident-centric graph (asset → incident → causes/resolutions/similar).

**`searchNodes(query)`** — Full-text search across name, title, description properties.

**`findPath(fromId, toId)`** — Shortest path between two nodes.

**`getStats()`** — Node count, relationship count, node type distribution.

### `graph.controller.ts`
| Route | Roles | Purpose |
|-------|-------|---------|
| `GET /graph/asset/:id` | Any auth | Asset knowledge graph |
| `GET /graph/neighbours/:nodeId` | Any auth | Expand node |
| `GET /graph/incident/:id` | Any auth | Incident graph |
| `GET /graph/search` | Any auth | Search nodes |
| `GET /graph/stats` | Any auth | Graph statistics |
| `POST /graph/query` | **ADMIN** | Raw Cypher (dangerous — guarded) |
| `POST /graph/seed` | **ADMIN** | Reseed from PostgreSQL |

## 6.2 Memory Module — `src/modules/memory/`

### `embeddings.service.ts`
Manages OpenAI text-embedding-3-small. 1536-dimension vectors.

- `embed(text)` — single embedding
- `embedBatch(texts[])` — batch embedding with `OPENAI_EMBEDDING_BATCH_SIZE` limit
- **Mock fallback:** if no OpenAI key, uses deterministic hash-based vectors (warned at startup). `usingMockEmbeddings: boolean` flag exposed.

### `memory.service.ts`
Manages all 5 Qdrant collections + Neo4j memory enrichment.

**Ingest methods:**
- `ingestIncident(id)` — embeds title+description+rootCause+resolution+lessons → Qdrant `incidents`
- `ingestLesson(id)` — embeds title+content → Qdrant `lessons`
- `ingestProcedure(id)` — embeds title+content → Qdrant `procedures`
- `ingestMaintenanceRecord(id)` — embeds type+description+findings+outcome → Qdrant `maintenance`
- `ingestRecommendation(id)` — embeds action+reason → Qdrant `recommendations`
- `ingestAll()` — parallel batch (10 concurrent) ingestion of ALL records in all 5 collections

**Search:**
- `hybridSearch(query, options)` — Qdrant semantic search + Neo4j graph enrichment → merged, deduplicated, relevance-scored results

**`getStats()`** — PostgreSQL counts + Qdrant vector counts per collection + `usingMockEmbeddings` flag + `embeddingMode` description.

### `memory.controller.ts`
| Route | Roles | Purpose |
|-------|-------|---------|
| `GET /memory/stats` | Any auth | Collection sizes + embedding mode |
| `GET /memory/search` | Any auth | Hybrid semantic search |
| `POST /memory/ingest-all` | ENGINEER+ | Batch ingest all 5 collections |
| `POST /memory/ingest/incident/:id` | ENGINEER+ | Ingest one incident |
| `POST /memory/ingest/lesson/:id` | ENGINEER+ | Ingest one lesson |

## 6.3 Other Modules (Summary)

### Maintenance Module
- `getQueue()` — assets with overdue maintenance, ranked by risk
- `getWorkOrders(filters?)` — filtered by assetId + outcome status (fixed)
- `getStats()` — counts by outcome type + avg cost
- `createWorkOrder(data)` — create `MaintenanceRecord`
- `updateWorkOrder(id, data)` — update outcome/findings

### Recommendations Module
- Full CRUD with `create`, `findAll` (paginated), `findOne`, `update(PATCH)`, `approve`, `reject`, `complete`
- `getStats()` — counts by status + critical count
- `generateForAsset(assetId, riskScore)` — auto-generate from risk analysis (called by Planner Agent)

### Analytics Module
- `getDashboard()` — network health, KPIs, agent activity count
- `getIncidentAnalytics()` — 30-day trend (single query + in-memory group), severity distribution, top assets
- `getRiskAnalytics()` — 7-day risk trend (single query), severity distribution
- `getKnowledgeAnalytics()` — lessons count, memory search volume, agent run stats

### Twin Module
- `getState()` — all 50 assets with lat/lng + risk scores + station info for Digital Twin map
- `getLayers()` — layer configuration for the Mapbox map controls

### Search Module
- `search(q, limit)` — queries PostgreSQL across: incidents (title, description, number), assets (code, name), recommendations (action), lessons (title, content)
- Returns typed `{ results: [{ type, id, title, description, relevance, url }], total }`

### Stations Module
- `findAll()` — all 10 stations with asset counts + risk summary
- `findOne(id)` — single station
- `getDashboard(id)` — station-level risk summary, incident history, asset health

### Users Module
- `findAll()` — all users (admin only)
- `findOne(id)` — single user
- `create(data)` — create user with bcrypt password hash
- `update(id, data)` — update any user field (admin) or own profile
- `updateProfile()` — self-service route (`PATCH /users/profile`) using JWT `userId`
- `delete(id)` — soft/hard delete (admin only)

### Notifications Module
- `findAll(userId)` — notifications for current user
- `getUnreadCount(userId)` — count of unread
- `markReadOwned(id, userId)` — marks read **only if owned** (IDOR fix)
- `markAllRead(userId)` — bulk mark

### Audit Module
- `getLogs(filters)` — paginated audit log
- `getStats()` — action type distribution
- `getDecisionTrace(id)` — full reasoning trace for a decision
- `getAgentRunTrace(id)` — full thought trail for an agent run

---

# PART 7: FRONTEND — Next.js 14

**Directory:** `apps/web/src/`

## 7.1 Root Layout — `app/layout.tsx`

Root Next.js layout. Applies:
- Google Fonts (Geist Sans, Geist Mono)
- Global CSS variables (dark theme tokens)
- `<Toaster>` from react-hot-toast (bottom-right, dark theme)
- Global metadata: title template `"%s | RailMind"`, description

## 7.2 Auth Layout — `app/(auth)/layout.tsx`

Wraps login page. Centered full-screen layout with RailMind branding. No sidebar/topbar. Redirects to dashboard if already authenticated.

## 7.3 Login Page — `app/(auth)/login/page.tsx`

- Form: email + password inputs
- Calls `authApi.login()` → stores tokens in Zustand auth store
- Redirects to `/dashboard` on success
- Shows error toast on failure
- Demo credential pre-fill buttons for judge convenience

## 7.4 Root Redirect — `app/page.tsx`

Redirects: authenticated → `/dashboard`, unauthenticated → `/login`.

## 7.5 Dashboard — `app/dashboard/page.tsx`

**Overview of the entire railway network.**

Data loaded in parallel:
- `analyticsApi.getDashboard()` → network health KPIs
- `incidentsApi.getAll({ status: "OPEN", limit: 5 })` → active incidents
- `recommendationsApi.getAll({ status: "PENDING", priority: "CRITICAL" })` → urgent actions
- `riskApi.getDashboard()` → critical assets list

Renders:
- 4 KPI stat cards (healthy assets %, open incidents, critical risk count, agent investigations)
- Active incidents list → links to `/incidents/:id`
- Critical assets list → links to `/assets/:id`
- Pending critical recommendations list
- Real-time agent activity feed (from Zustand `agentStore`)

Loading: `<PageSkeleton />` while data loads.

## 7.6 Digital Twin — `app/twin/page.tsx`

**Interactive map of all 50 railway assets.**

Renders either `<MapboxMap>` (if `NEXT_PUBLIC_MAPBOX_TOKEN` set) or `<FallbackMap>` (grid layout by station).

Mapbox mode:
- Each asset rendered as a colored circle marker (risk-based color)
- Click marker → navigate to `/assets/:id`
- Layer controls: toggle signals, switches, tracks, risk overlay
- 30-second polling for live updates
- Popups on hover showing asset code + status

Fallback mode (no Mapbox token):
- Station cards with asset lists per station
- Same risk-coloring
- Same navigation on click
- Fully functional — all demo steps work in fallback mode

## 7.7 Asset Intelligence Profile — `app/assets/[id]/page.tsx`

**The most complex page. 5 tabs.**

Loads `assetsApi.getProfile(id)` which returns the full intelligence bundle.

**Tab 1: Overview**
- Asset details (code, type, status, station, install date)
- Health score gauge
- Risk score badge with severity
- Stats grid: days since maintenance, total incidents, open incidents, last maintenance date

**Tab 2: Incidents**
- Chronological list of all incidents for this asset
- Severity + status badges
- Root cause if resolved
- Link to full incident detail

**Tab 3: Maintenance**
- Maintenance history table: date, type, technician, findings, outcome
- "Add Work Order" button → navigates to `/maintenance/new?assetId=:id`

**Tab 4: Recommendations**
- Active recommendations with priority badges
- Approve/reject/complete buttons (with ConfirmDialog on reject)
- Link to full recommendations page

**Tab 5: Graph**
- "Open in Graph Explorer" button → `/graph?assetId=:id&assetCode=:code`
- Shows relationship count preview

**"Ask RailMind" button:**
- Opens inline question form
- Calls `agentsApi.ask(question, assetId)`
- Shows loading state while agents work
- Navigates to `/agents` when complete (response pre-loaded in store)

## 7.8 Incident Explorer — `app/incidents/page.tsx`

**List view with filtering.**

- Filter by severity (CRITICAL/HIGH/MEDIUM/LOW) and status (OPEN/INVESTIGATING/RESOLVED/ARCHIVED)
- Stats cards: total, open, investigating, resolved
- Table with incident number, title, asset, severity, status, date
- Click row → `/incidents/:id`
- "Create Incident" button → `/incidents/new`
- Loading: `<PageSkeleton />`

## 7.9 Incident Detail — `app/incidents/[id]/page.tsx`

**Full investigation view.**

Left panel:
- Incident metadata (number, title, severity, status, dates)
- Asset link
- Root cause + resolution (if resolved)
- Lessons learned

Right panel (tabs):
- **Timeline** — chronological event log with agent thoughts, user actions, system events
- **Similar** — up to 5 similar past incidents (same asset type + RESOLVED)
- **Recommendations** — linked recommendations

Actions:
- "Close Incident" → ConfirmDialog → opens resolution form → `incidentsApi.close()`
- "Add Event" → inline event form

## 7.10 Create Incident — `app/incidents/new/page.tsx`

Form fields: title, description, severity (dropdown), asset (select from all 50), occurred at (datetime), weather condition (optional).

Validates: title + assetId required. Calls `incidentsApi.create()`. Redirects to new incident detail page.

## 7.11 Knowledge Graph Explorer — `app/graph/page.tsx`

**ReactFlow-powered graph visualization.**

**`GraphContent` component:**
- Initializes ReactFlow with MiniMap, Controls, Background
- On mount: loads graph based on URL params (`assetId`, `assetCode`) or default (S11)
- `loadGraph(id)` → `graphApi.getAssetGraph(id)` → `buildFlowData()` → ReactFlow nodes + edges
- `handleSearchDirect(label)` → `graphApi.search(label)` → load first result's graph (stale closure fixed)
- `handleSearch()` → reads from `searchQ` text input
- `loadPlaceholder()` → hardcoded 9-node S11 demo graph (fallback when Neo4j offline)

**Quick Load buttons:** Signal S11, Rivergate Station, INC-044 — each directly calls `graphApi.search()` without stale closure

**Node styling:**
- Signal = blue, Incident = orange, RootCause = red, Resolution = green, Station = purple, Engineer = cyan, WeatherEvent = yellow, LessonLearned = teal

**Node positions:** Deterministic hash-based (no random jitter on reload)

**Edge labels:** Relationship type name, displayed on hover

## 7.12 Agent Console — `app/agents/page.tsx`

**The RailMind AI investigation interface.**

Left panel:
- Question input with asset selector
- Quick investigation buttons (pre-filled S11 question)
- 7 agent status indicators (IDLE / THINKING / COMPLETED)
- Recent investigation history

Right panel:
- **Thought stream:** Real-time agent thoughts from WebSocket (`agentStore.thoughts`)
- **Investigation result** (when `lastResponse` is set):
  - Answer text
  - Evidence list with relevance scores
  - Risk score + severity badge
  - Confidence percentage
  - Recommended actions
  - Agent trail timeline
  - Processing time

Response auto-displays when navigating from Asset Profile (pre-loaded in `agentStore.lastResponse`).

## 7.13 Memory Explorer — `app/memory/page.tsx`

**Semantic search interface for the knowledge base.**

- Search input + type filter (incidents / lessons / procedures / all)
- Calls `memoryApi.search(query, type)`
- Displays results with: relevance score, type badge, title, summary, asset/date metadata
- Stats panel: collection sizes, embedding mode (REAL / MOCK warning)
- Lessons list section
- Procedures list section

## 7.14 Risk Intelligence Center — `app/risk/page.tsx`

**Network-wide risk dashboard.**

- 4 KPI cards: total critical, total high, avg network risk, total assessed
- Critical assets list with scores + links
- **Risk Heatmap:** All 50 assets as colored cells in a 10-column grid. Hover shows score. Click navigates to asset profile. Color scale: green (0–30) → yellow (31–60) → orange (61–80) → red (81+).
- All-risks table with sort by score
- 7-day trend chart (S11 shows escalating 72→87 pattern)
- "Recalculate" button → `POST /risk/recalculate` (admin/safety officer roles)

## 7.15 Recommendations — `app/recommendations/page.tsx`

**Evidence-based action queue.**

- Filter tabs: PENDING / APPROVED / IN_PROGRESS / COMPLETED
- Stats: pending, approved, completed, critical counts
- Recommendation cards with: priority badge, action text, reason, asset link, estimated time
- Approve/Complete buttons → direct action with toast
- Reject button → **ConfirmDialog** confirmation before rejecting
- Loading: `<PageSkeleton />`

## 7.16 Maintenance — `app/maintenance/page.tsx`

**Maintenance operations center.** 3 tabs:

**Queue:** Assets with overdue/upcoming maintenance, risk-ranked. "Create Work Order" → `/maintenance/new`.

**Work Orders:** All maintenance records, filterable by outcome. Shows technician, type, date, findings, outcome badge.

**Stats:** Charts of maintenance outcomes, types, cost trends.

## 7.17 Create Work Order — `app/maintenance/new/page.tsx`

Form: asset selector (all 50), datetime picker, maintenance type grid (7 types), description textarea, findings textarea, outcome selector (4 options). Validates: assetId + description required. Calls `maintenanceApi.createWorkOrder()`. Redirects to `/maintenance`.

## 7.18 Analytics — `app/analytics/page.tsx`

**3 analytics tabs:**

**Incidents:** 30-day trend BarChart (single query + in-memory group), severity distribution PieChart, top 5 assets by incident count.

**Risk:** 7-day avg risk trend LineChart, severity distribution.

**Knowledge:** Memory collection sizes, lesson creation over time, agent investigation count.

## 7.19 Settings — `app/settings/page.tsx`

**5-tab settings panel:**

1. **Profile** — name, email display, avatar initial, save via `PATCH /users/profile`
2. **Notifications** — 4 toggles (critical alerts, high risk, agent completion, weekly digest)
3. **Agent Config** — cache TTL, min confidence, auto-investigate toggle
4. **System** — connection status for all 6 infra components
5. **Security** — password change form → `POST /auth/change-password`

## 7.20 Notifications — `app/notifications/page.tsx`

- Lists all notifications for current user
- Unread count badge in topbar
- "Mark as read" per notification (IDOR-safe via `markReadOwned`)
- "Mark all read" bulk action
- Type icons: ALERT, RECOMMENDATION, AGENT, SYSTEM, MAINTENANCE

---

# PART 8: FRONTEND INFRASTRUCTURE

## 8.1 App Layout — `components/layout/app-layout.tsx`

Persistent shell wrapping all authenticated pages.

- **Sidebar** — navigation menu
- **Topbar** — search, notifications badge, user menu
- **ErrorBoundary** — wraps page content (catches render crashes)
- **PageMotion** — Framer Motion wrapper (fade-in transitions on route change)
- **useWebSocket()** — hook initialized here so WebSocket persists across navigation

## 8.2 Sidebar — `components/layout/sidebar.tsx`

Navigation items (icons from lucide-react):
- Dashboard (LayoutDashboard)
- Digital Twin (Globe2)
- Agents (Brain)
- Incidents (AlertTriangle)
- Knowledge Graph (GitBranch)
- Memory Search (Search)
- Risk Center (ShieldAlert)
- Recommendations (Lightbulb)
- Maintenance (Wrench)
- Analytics (BarChart3)
- Notifications (Bell) + unread count badge
- Settings (Settings)

Active state: `pathname === href || pathname.startsWith(href + "/")`

## 8.3 Topbar — `components/layout/topbar.tsx`

- Global search input → calls `searchApi.search(q)` on Enter → shows dropdown results
- Notification bell with unread count badge
- User avatar with role badge
- Logout button → `clearAuth()` → redirect to login

## 8.4 Common Components

### `components/common/error-boundary.tsx`
React class component. Catches render errors. Shows: error icon, message, "Reload page" button. In development: shows stack trace. Wraps all page content via `app-layout.tsx`.

### `components/common/skeleton.tsx`
Loading state primitives:
- `Skeleton` — single animated shimmer block
- `StatCardSkeleton` — stat card placeholder
- `TableRowSkeleton` — table row placeholder
- `CardSkeleton` — card with N rows
- `PageSkeleton` — full page layout placeholder (4 stat cards + table)

All pages show `<PageSkeleton />` while loading instead of blank screen.

### `components/common/confirm-dialog.tsx`
Modal confirmation dialog. Props: `title`, `message`, `confirmLabel`, `variant` (danger/warning), `onConfirm` (async), `onCancel`.

Used on:
- Recommendations page: reject action (red variant)
- Incident detail: close incident action (warning variant)

### `components/common/motion.tsx`
Framer Motion wrappers. `FadeIn`, `SlideIn`, `ScaleIn`, `PageMotion` — used via `app-layout.tsx` for page transitions.

## 8.5 Zustand Stores

### `stores/auth.store.ts`
Single source of truth for authentication.

State: `{ user, token, isAuthenticated }`

- `setAuth(user, token)` — stores in Zustand (persisted to `railmind-auth` localStorage key)
- `clearAuth()` — clears state AND removes `railmind-auth` key (complete logout, no stale token)
- `getAuthToken()` — helper for axios interceptor

Persisted via Zustand `persist` middleware to `localStorage['railmind-auth']`. Token NOT stored separately to avoid double-storage bug.

### `stores/agent.store.ts`
Real-time agent pipeline state.

State: `{ thoughts[], workflowStatus, currentQuestion, lastResponse }`

- `addThought(thought)` — append to thoughts array (called by WebSocket handler)
- `setWorkflowStatus(status, question?)` — IDLE / RUNNING / COMPLETED
- `setLastResponse(response)` — stores final investigation result
- `clearThoughts()` — reset before new investigation

### `stores/twin.store.ts`
Digital Twin state.

State: `{ assets[], activeLayers, selectedAsset, loading }`

- `setAssets(assets)` — update from twin API
- `toggleLayer(layer)` — show/hide signal/switch/track/risk layers
- `selectAsset(id)` — highlight on map

## 8.6 Hooks

### `hooks/use-websocket.ts`
WebSocket connection manager. Module-level singleton with ref-count lifecycle.

- Creates one Socket.io connection to `NEXT_PUBLIC_WS_URL/ws`
- Ref-counted: first mount creates, last unmount destroys
- React StrictMode safe: off/on handlers per instance, not recreating socket
- Events handled: `agent:thought`, `workflow:started`, `workflow:completed`
- Writes to `agentStore` on each event

Initialized in `app-layout.tsx` — persists across all page navigations.

## 8.7 API Client — `lib/api-client.ts`

Axios instance configured:
- Base URL: `NEXT_PUBLIC_API_URL` (default: `http://localhost:3001/api/v1`)
- Request interceptor: reads `useAuthStore.getState().token` → adds `Authorization: Bearer`
- Response interceptor: on 401 → `clearAuth()` → redirect to login

Exports typed API objects:
```typescript
authApi      // login, refresh, me, logout, changePassword
assetsApi    // getAll, getTwin, getOne, getProfile, getByCode
incidentsApi // getAll, getStats, getOne, getTimeline, getSimilar, 
             // getInvestigation, create, update, close, addEvent
recommendationsApi // getAll, getStats, getOne, create, update, 
                   // approve, reject, complete
maintenanceApi  // getQueue, getStats, getWorkOrders, getWorkOrder,
                // createWorkOrder, updateWorkOrder, getAssetHistory
riskApi         // getDashboard, getHeatmap, getTrends, getForecast,
                // getAssetRisk, recalculate, calculateAsset
graphApi        // getAssetGraph, getNeighbours, getIncidentGraph,
                // search, getStats, seedGraph, queryGraph
memoryApi       // getStats, search, ingestAll, ingestIncident, ingestLesson
agentsApi       // getStatus, getHistory, getRun, ask
analyticsApi    // getDashboard, getIncidents, getRisk, getKnowledge
twinApi         // getState, getLayers
stationsApi     // getAll, getOne, getDashboard
usersApi        // getAll, getStats, getOne, create, update, 
                // updateProfile, delete
notificationsApi // getAll, getUnreadCount, markRead, markAllRead
auditApi        // getLogs, getStats, getDecisionTrace, getAgentRunTrace
searchApi       // search
```

## 8.8 Utils — `lib/utils.ts`

Utility functions:
- `cn(...classes)` — Tailwind class merger (clsx + tailwind-merge)
- `formatDate(date)` — `DD MMM YYYY` format
- `formatDateTime(date)` — `DD MMM YYYY HH:MM` format
- `formatRelative(date)` — "2 hours ago", "yesterday", etc.
- `getSeverityColor(severity)` — returns `{ text, bg, border }` Tailwind classes
- `getRiskColor(severity)` — risk-specific color set
- `getStatusColor(status)` — incident status color set
- `truncate(str, n)` — safe string truncation
- `formatCurrency(amount)` — ₹ formatted (Indian railway context)

---

# PART 9: SHARED PACKAGES

## 9.1 shared-types — `packages/shared-types/src/`

TypeScript interfaces shared between frontend and backend. Barrel export via `index.ts`.

| File | Types |
|------|-------|
| `agent.types.ts` | AgentName, AgentStatus, AgentThought, AskRailMindRequest, AskRailMindResponse, EvidenceRef, AgentRun, AgentWsEvent |
| `asset.types.ts` | Asset, AssetType, AssetStatus, AssetProfile, TwinAsset |
| `auth.types.ts` | User, UserRole, AuthTokens, LoginResponse |
| `graph.types.ts` | GraphNode, GraphEdge, GraphData |
| `incident.types.ts` | Incident, IncidentSeverity, IncidentStatus, IncidentEvent |
| `maintenance.types.ts` | MaintenanceRecord, MaintenanceType, WorkOrderStatus |
| `memory.types.ts` | MemorySearchResult, SearchItem, EvidencePackage |
| `recommendation.types.ts` | Recommendation, RecommendationPriority, ActionType |
| `risk.types.ts` | RiskRecord, RiskSeverity, RiskFactor, RiskDashboard |
| `api.types.ts` | PaginatedResponse, ApiError, SearchResult |

## 9.2 UI Package — `packages/ui/src/`

Shared React UI primitives for use across apps.

| Component | Props | Purpose |
|-----------|-------|---------|
| `Badge` | label, variant | Severity/status label with color variants |
| `StatusDot` | status | Color dot: green/yellow/red/blue per status |
| `RiskBadge` | score | Risk score + severity label with color |
| `EmptyState` | icon, title, description | Centered empty state placeholder |
| `StatCard` | label, value, icon, sub | Metric display card |

Dependencies: `clsx`, `tailwind-merge` (in package.json). Peer deps: `react`, `lucide-react`.

---

# PART 10: DATABASE SCHEMA

## 10.1 PostgreSQL — Prisma Schema (`services/api/prisma/schema.prisma`)

### Users
```
id, email (unique), firstName, lastName, passwordHash, role (enum),
avatarUrl, isActive, lastLoginAt, createdAt, updatedAt
```
Roles: ENGINEER, OPERATOR, MAINTENANCE_MANAGER, SAFETY_OFFICER, ADMINISTRATOR, TRAINING_OFFICER

### Stations
```
id, name, stationCode (unique), zone, city, latitude, longitude,
totalPlatforms, isActive, metadata (Json), createdAt
```
Indexes: `stationCode`

### Assets
```
id, stationId (FK→Station), assetType (enum), assetCode (unique),
name, description, status (enum), healthScore, latitude, longitude,
installationDate, lastMaintenanceAt, metadata (Json),
createdAt, updatedAt
```
AssetType: SIGNAL, TRACK, SWITCH, CONTROL_CENTER, POWER_UNIT, BRIDGE, LEVEL_CROSSING
AssetStatus: HEALTHY, WARNING, CRITICAL, MAINTENANCE, DECOMMISSIONED
Indexes: `stationId`, `assetType`, `status`

### Incidents
```
id, incidentNumber (unique), title, description, severity (enum),
status (enum), assetId (FK→Asset), occurredAt, resolvedAt, closedAt,
rootCause, resolution, lessonsLearned, weatherCondition,
createdById (FK→User nullable), createdAt, updatedAt
```
IncidentSeverity: LOW, MEDIUM, HIGH, CRITICAL
IncidentStatus: OPEN, INVESTIGATING, RESOLVED, ARCHIVED
Indexes: `assetId`, `status`, `severity`, `occurredAt`

### IncidentEvents
```
id, incidentId (FK→Incident cascade), eventType, description,
agentName, performedById, metadata (Json), timestamp
```
Indexes: `incidentId`, `timestamp`

### MaintenanceRecords
```
id, assetId (FK→Asset), maintenanceType (enum), description,
findings, outcome (enum), performedAt, durationHours, cost,
partsReplaced (Json), performedById (FK→User nullable), createdAt
```
MaintenanceType: INSPECTION, REPAIR, REPLACEMENT, CALIBRATION, UPGRADE, EMERGENCY_REPAIR, SCHEDULED_MAINTENANCE
Outcome: SUCCESSFUL, PARTIAL, FAILED, DEFERRED
Indexes: `assetId`, `performedAt`

### Recommendations
```
id, action, actionType (enum), priority (enum), status (enum),
reason, confidence, expectedOutcome, assetId (FK→Asset nullable),
incidentId (FK→Incident nullable), approvedAt, approvedById,
completedAt, createdAt, updatedAt
```
ActionType: MONITOR, INSPECT, REPAIR, REPLACE, ESCALATE, INVESTIGATE, SCHEDULE_MAINTENANCE, EMERGENCY_ACTION
Priority: LOW, MEDIUM, HIGH, CRITICAL
Status: PENDING, APPROVED, REJECTED, COMPLETED, IN_PROGRESS
Indexes: `assetId`, `incidentId`, `priority`, `status`

### RiskRecords
```
id, assetId (FK→Asset), riskScore, severity (enum), confidence,
isActive, factors (Json), possibleFailure, recommendation,
rootCauseSummary, calculatedAt
```
Indexes: `assetId`, `severity`, `isActive`

### LessonsLearned
```
id, title, content, assetType, incidentId (FK→Incident nullable),
tags (String[]), createdById, createdAt
```
Indexes: `incidentId`, `assetType`

### Procedures
```
id, title, content, category, tags (String[]), createdAt
```
Index: `category`

### AgentRuns
```
id, agentName, taskType, status, input (Json), output (Json),
thoughts (Json), startedAt, completedAt, durationMs,
triggeredById (FK→User nullable)
```
Indexes: `agentName`, `status`, `startedAt`, `completedAt`

### AuditLogs
```
id, action, resourceType, resourceId, userId (FK→User nullable),
metadata (Json), ipAddress, userAgent, createdAt
```
Indexes: `userId`, `resourceType`, `createdAt`, `[resourceType, createdAt]` (composite)

### Alerts
```
id, assetId (FK→Asset), alertType, severity, title, message,
isActive, resolvedAt, createdAt
```

### Notifications
```
id, userId (FK→User), type, title, message, read,
relatedEntityType, relatedEntityId, createdAt
```
Indexes: `userId`, `read`

## 10.2 Neo4j — Knowledge Graph

### Node Types (10)
| Node | Properties | Created from |
|------|-----------|--------------|
| Station | id, name, code, zone | stations table |
| Signal | id, code, name, type, status | assets (SIGNAL) |
| Track | id, code, name, type, status | assets (TRACK) |
| Switch | id, code, name, type, status | assets (SWITCH) |
| Asset | id, code, name, type, status | assets (other types) |
| Incident | id, number, title, severity, status, occurredAt | incidents table |
| RootCause | id, name | incident.rootCause |
| Resolution | id, description | incident.resolution |
| WeatherEvent | id, condition | incident.weatherCondition |
| Engineer | id, name, role, email | users (ENGINEER/ADMIN/MAINTENANCE_MANAGER) |
| LessonLearned | id, title, content | lessons_learned table |
| Procedure | id, title, category | procedures table |
| Recommendation | id, action, priority | recommendations table |

### Relationship Types (12)
| Relationship | From → To | Meaning |
|-------------|-----------|---------|
| FAILED_IN | Asset → Incident | This asset experienced this incident |
| HAS_CAUSE | Incident → RootCause | This incident was caused by |
| RESOLVED_BY | Incident → Resolution | This incident was resolved by |
| SIMILAR_TO | Incident ↔ Incident | Same asset type, same era |
| PART_OF | Asset → Station | Asset belongs to station |
| OCCURRED_DURING | Incident → WeatherEvent | Incident happened during weather |
| RESOLVED | Engineer → Incident | Engineer resolved this incident |
| RELATED_TO | Incident ↔ Incident | Share the same root cause |
| LEARNED_FROM | LessonLearned → Incident | Lesson derived from incident |
| AFFECTED_BY | Station → Incident | Station affected by incident |
| CONNECTED_TO | Asset ↔ Asset | Co-located assets at same station |
| HAS_RECOMMENDATION | Asset → Recommendation | Asset has this recommendation |

## 10.3 Qdrant — Vector Collections

All 6 collections use:
- Vector size: `1536` (OpenAI text-embedding-3-small)
- Distance: `Cosine`
- Indexing threshold: `100`

| Collection | Content | Key Payload Fields |
|-----------|---------|-------------------|
| incidents | 100 incidents | incidentId, title, severity, status, assetType, stationId, rootCause |
| lessons | 30 lessons | lessonId, title, assetType, tags |
| procedures | 10 procedures | procedureId, title, category |
| maintenance | 10+ records | recordId, assetCode, maintenanceType, outcome, stationId |
| recommendations | 50 recs | recId, action, priority, status, assetType, stationId |
| manuals | (reserved) | — |

---

# PART 11: SEED DATA

## 11.1 Seed Script — `scripts/seed/index.ts`

Complete database seeder. Run with `pnpm run seed`.

**Order of operations:**
1. Create users (5 demo users, all passwords: `railmind123`)
2. Create 10 stations (New Junction through Coastal Yard)
3. Upsert 50 assets (15 new signals S26–S40, 7 switches SW-003–SW-009, 6 tracks TRK-004–TRK-009)
4. Create 30 lessons learned
5. Create 10 procedures
6. Create 100 incidents (20 original S11 storyline + 80 distributed across all assets)
7. Create 50 recommendations (8 original + 42 new across all assets)
8. **Signal S11 risk record:** riskScore=87, CRITICAL
9. **All 50 assets risk records:** computed from healthScore + incident count
10. **7-day historical trend** for S11 (scores 72→75→79→81→83→85→87)
11. Attempt **memory ingest-all** via API (if `SEED_API_TOKEN` set)

## 11.2 Seed Data Files — `scripts/data/`

| File | Records | Description |
|------|---------|-------------|
| stations.json | 10 | Station codes, coords, zones |
| assets.json | 50 | All assets with lat/lng, healthScore, status |
| incidents.json | 100 | S11 storyline + 80 distributed incidents |
| lessons.json | 30 | Pre-authored organizational lessons |
| procedures.json | 10 | Maintenance SOPs |
| recommendations.json | 50 | Pre-generated recommendations |

## 11.3 Signal S11 Demo Storyline

Signal S11 (sig011) at Rivergate Station is the centerpiece demo asset.

| Incident | Date | Issue | Severity | Status |
|---------|------|-------|----------|--------|
| INC-044 | 18 months ago | Relay corrosion → intermittent failure | MEDIUM | RESOLVED |
| INC-057 | 14 months ago | Water ingress during heavy rainfall | HIGH | RESOLVED |
| INC-081 | 10 months ago | Connector degradation → comms loss | HIGH | RESOLVED |
| INC-061 | 8 months ago | Relay resistance drift detected | HIGH | RESOLVED |
| INC-090 | Current | Current anomaly — active investigation | CRITICAL | INVESTIGATING |

**Risk history:** 72 → 75 → 79 → 81 → 83 → 85 → **87** (escalating over 7 days)

All 5 incidents are seeded in both PostgreSQL and Neo4j. INC-090 is the first INVESTIGATING incident included in the graph (TD-006 fix).

---

# PART 12: SCRIPTS & DEPLOYMENT

## 12.1 start-demo.sh

One-command demo environment initializer. Run after `pnpm dev`:

```bash
bash scripts/start-demo.sh
```

Steps:
1. Waits for API health check (up to 60s)
2. Authenticates as admin user (gets JWT token)
3. `POST /graph/seed` — seeds Neo4j from PostgreSQL (~200 nodes, ~400 relationships)
4. `POST /risk/recalculate` — computes risk for all 50 assets
5. `POST /memory/ingest-all` — ingests all 5 Qdrant collections

Prints demo credentials and 6-step demo path after completion.

## 12.2 Environment Variables Reference

**`services/api/.env`:**
```
DATABASE_URL          PostgreSQL connection string
NEO4J_URI             bolt://localhost:7687
NEO4J_USER            neo4j
NEO4J_PASSWORD        railmind_neo4j
QDRANT_URL            http://localhost:6333
QDRANT_API_KEY        (optional, for Qdrant Cloud)
REDIS_URL             redis://localhost:6379
OPENAI_API_KEY        sk-... (required for LLM + real embeddings)
JWT_SECRET            min 32 chars random string
JWT_EXPIRY            7d
REFRESH_TOKEN_EXPIRY  30d
NODE_ENV              development | production
PORT                  3001
FRONTEND_URL          http://localhost:3000
AI_MODEL              gpt-4o-mini (default)
EMBEDDING_MODEL       text-embedding-3-small (default)
```

**`apps/web/.env.local`:**
```
NEXT_PUBLIC_API_URL     http://localhost:3001/api/v1
NEXT_PUBLIC_WS_URL      http://localhost:3001
NEXT_PUBLIC_MAPBOX_TOKEN pk.eyJ1... (optional — fallback map works without)
```

## 12.3 Setup from Zero

```bash
# 1. Infrastructure
docker-compose up -d
sleep 15  # wait for databases

# 2. Install dependencies
pnpm install

# 3. Database schema
cd services/api
pnpm prisma migrate dev --name init
pnpm prisma generate
cd ../..

# 4. Seed data
pnpm run seed

# 5. Start applications
pnpm dev
# → API:      http://localhost:3001/api/v1
# → Frontend: http://localhost:3000
# → Swagger:  http://localhost:3001/api/docs
# → Neo4j:    http://localhost:7474
# → Qdrant:   http://localhost:6333/dashboard

# 6. Initialize AI memory & graph
bash scripts/start-demo.sh
```

---

# PART 13: COMPLETE API REFERENCE

## Authentication
```
POST /api/v1/auth/login          { email, password } → { user, tokens }
POST /api/v1/auth/refresh        { refreshToken } → { accessToken }
GET  /api/v1/auth/me             → User
POST /api/v1/auth/logout         → { message }
POST /api/v1/auth/change-password { currentPassword, newPassword } → { message }
```

## Assets
```
GET  /api/v1/assets              ?assetType&status&stationId → Asset[]
GET  /api/v1/assets/twin         → TwinAsset[]
GET  /api/v1/assets/:id          → Asset
GET  /api/v1/assets/:id/profile  → AssetProfile (full intelligence bundle)
GET  /api/v1/assets/code/:code   → Asset
```

## Incidents
```
GET  /api/v1/incidents           ?status&severity&assetId&limit → Incident[]
GET  /api/v1/incidents/stats     → { total, open, investigating, resolved, critical }
GET  /api/v1/incidents/:id       → Incident (with events + recommendations)
GET  /api/v1/incidents/:id/timeline    → { incident, events[] }
GET  /api/v1/incidents/:id/similar     → Incident[]
GET  /api/v1/incidents/:id/investigation → Investigation package
POST /api/v1/incidents           { title, description, severity, assetId, ... } → Incident
PATCH /api/v1/incidents/:id      { status?, rootCause?, ... } → Incident
POST /api/v1/incidents/:id/close { resolution, rootCause?, lessons? } → Incident
POST /api/v1/incidents/:id/events { eventType, description, agentName? } → Event
```

## Risk
```
GET  /api/v1/risk/dashboard      → RiskDashboard
GET  /api/v1/risk/heatmap        → RiskCell[] (all 50 assets)
GET  /api/v1/risk/trends         → { trend[7d], period }
GET  /api/v1/risk/forecast       → ForecastItem[]
GET  /api/v1/risk/assets/:id     → RiskRecord
POST /api/v1/risk/recalculate    [ADMIN] → { updated, total }
POST /api/v1/risk/assets/:id/calculate → RiskRecord
```

## Agents
```
GET  /api/v1/agents/status       → { agents[], recentRuns[] }
GET  /api/v1/agents/history      ?limit → AgentRun[]
GET  /api/v1/agents/:id          → AgentRun (with full thoughts)
POST /api/v1/agents/ask          { question, assetId? } → AskRailMindResponse
     (Rate limited: 5 req/min)
```

## Graph
```
GET  /api/v1/graph/asset/:id     → { nodes[], relationships[] }
GET  /api/v1/graph/neighbours/:nodeId ?type&depth → { nodes[], relationships[] }
GET  /api/v1/graph/incident/:id  → { nodes[], relationships[] }
GET  /api/v1/graph/search        ?q → Node[]
GET  /api/v1/graph/stats         → { nodes, relationships, nodeTypes[] }
POST /api/v1/graph/query         [ADMIN] { cypher, params? } → results[]
POST /api/v1/graph/seed          [ADMIN] → { message }
```

## Memory
```
GET  /api/v1/memory/stats        → { postgresRecords, vectorCollections, embeddingMode }
GET  /api/v1/memory/search       ?q&type&limit → { items[], totalCount }
POST /api/v1/memory/ingest-all   [ENGINEER+] → { incidents, lessons, procedures, maintenance, recommendations }
POST /api/v1/memory/ingest/incident/:id → void
POST /api/v1/memory/ingest/lesson/:id   → void
```

## Analytics
```
GET  /api/v1/analytics/dashboard  → { networkHealth, kpis, agentActivity }
GET  /api/v1/analytics/incidents  → { trend[30d], severityDist, topAssets }
GET  /api/v1/analytics/risk       → { trend[7d], severityDist }
GET  /api/v1/analytics/knowledge  → { collectionSizes, agentRuns }
```

## Other
```
GET  /api/v1/search              ?q&limit → { results[], total }
GET  /api/v1/twin/state          → { assets[], stats }
GET  /api/v1/twin/layers         → LayerConfig[]
GET  /api/v1/stations            → Station[]
GET  /api/v1/stations/:id        → Station
GET  /api/v1/stations/:id/dashboard → StationDashboard
GET  /api/v1/maintenance/queue   → MaintenanceQueueItem[]
GET  /api/v1/maintenance/work-orders ?assetId&status → MaintenanceRecord[]
POST /api/v1/maintenance/work-orders → MaintenanceRecord
PATCH /api/v1/maintenance/work-orders/:id → MaintenanceRecord
GET  /api/v1/recommendations     ?status&priority&limit → Recommendation[]
GET  /api/v1/recommendations/stats → RecommendationStats
PATCH /api/v1/recommendations/:id → Recommendation
POST /api/v1/recommendations/:id/approve → Recommendation
POST /api/v1/recommendations/:id/reject  → Recommendation
POST /api/v1/recommendations/:id/complete → Recommendation
GET  /api/v1/notifications       → Notification[]
GET  /api/v1/notifications/unread-count → number
POST /api/v1/notifications/:id/read → void (ownership verified)
POST /api/v1/notifications/read-all → void
GET  /api/v1/audit/logs          → AuditLog[]
GET  /api/v1/audit/agent-run/:id → AgentRun (full trace)
GET  /api/v1/users               [ADMIN] → User[]
PATCH /api/v1/users/profile      → User (own profile)
PATCH /api/v1/users/:id          [ADMIN] → User
GET  /api/v1/health              → { status, db, timestamp }
```

---

# PART 14: DEMO CREDENTIALS

| User | Email | Password | Role | Access |
|------|-------|----------|------|--------|
| Admin | admin@railmind.com | railmind123 | ADMINISTRATOR | Everything |
| Engineer | engineer@railmind.com | railmind123 | ENGINEER | Create incidents, recommendations, maintenance |
| Operator | operator@railmind.com | railmind123 | OPERATOR | View all, create incidents |
| Manager | manager@railmind.com | railmind123 | MAINTENANCE_MANAGER | Maintenance + recommendations |
| Safety | safety@railmind.com | railmind123 | SAFETY_OFFICER | Risk recalculation + audit |

**Recommended demo user:** `engineer@railmind.com` — has access to all workflow steps without needing admin.

---

# PART 15: TECHNOLOGY DECISIONS

## Why LangGraph over a simple chain?
LangGraph's `StateGraph` provides **stateful, conditional orchestration**. The conditional edge after `engineer_agent` skips maintenance planning for LOW risk assets — saving processing time and preventing unnecessary work orders. Each node gets the full accumulated state from previous nodes. Future work: parallel execution of `incident_agent` and `knowledge_agent` simultaneously.

## Why Neo4j + Qdrant together?
**Qdrant** finds *semantically similar* content ("incidents about water damage"). **Neo4j** finds *structurally connected* content ("incidents on the same track section that were resolved by Engineer Chen"). The hybrid search combines both: semantic relevance from Qdrant, graph enrichment from Neo4j. Neither alone gives the full picture.

## Why PostgreSQL as primary + both graph + vector?
Each database is optimized for its query pattern:
- PostgreSQL: transactional facts, aggregations, JOINs (fast for counts, filters)
- Neo4j: relationship traversal, pattern matching (fast for "all incidents on connected assets")
- Qdrant: vector similarity (fast for "find similar maintenance records by description")

## Why 7 agents instead of 1?
Each agent has focused expertise and a single responsibility. This enables: parallel execution (future), individual retry logic, granular audit trails, and cognitive separation that mirrors real railway operations (incident investigator ≠ risk analyst ≠ maintenance planner).

## Why Mapbox + Fallback?
Mapbox provides the best cartographic quality for railway maps (custom rail layers available). But Mapbox requires a paid API key. The `FallbackMap` ensures the full demo works at any hackathon/presentation without requiring credentials — a station grid with risk-colored assets is functionally equivalent for all demo steps.

---

# PART 16: SECURITY MODEL

## Authentication Flow
```
Client → POST /auth/login → LocalStrategy.validate() → bcrypt.compare()
       → JWT signed (7d) + RefreshToken (30d) → stored in Zustand persist
Client → every request → Authorization: Bearer <token>
       → JwtStrategy.validate() → { id, email, role } on req.user
       → RolesGuard checks @Roles() metadata → allow/deny
```

## Guards (all global via APP_GUARD)
- `JwtAuthGuard` — every route protected by default
- `RolesGuard` — enforces `@Roles()` decorator; public routes use `@Public()` skip decorator
- `ThrottlerGuard` — 200 req/60s global; 5 req/60s on `POST /agents/ask`

## Security Headers (Helmet)
- `X-DNS-Prefetch-Control`, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security` (production), `X-XSS-Protection`
- CSP disabled (Mapbox GL requires inline scripts)

## Input Validation
- `ValidationPipe`: whitelist, transform, forbidNonWhitelisted
- `AskRailMindDto`: question 5–500 chars, required
- All string params: ParseIntPipe where numeric expected
- `GlobalExceptionFilter`: hides stack traces in production

## Password Security
- bcrypt cost factor: 10
- `changePassword`: verifies current before hashing new
- Timing attack mitigation: bcrypt always called (constant time) regardless of user existence — **partial** (user existence check still leaks via timing delta; marked for future fix with dummy bcrypt call)

---

# PART 17: PERFORMANCE CHARACTERISTICS

## Database Query Optimizations Applied
| Query | Before | After |
|-------|--------|-------|
| 30-day incident trend | 30 serial Prisma queries | 1 query + in-memory group |
| 7-day risk trend | 7 serial Prisma queries | 1 query + in-memory group |
| Risk recalculate all | Serial per-asset | Parallel batches of 10 |
| Memory ingestAll | Serial per-record | `Promise.allSettled` batches of 10 |
| Heatmap (assets + risk) | N+1 pattern | `Promise.all([assets, riskRecords])` + Map join |

## Caching
- Agent results: Redis 60s TTL (identical question + assetId)
- No frontend SWR/React Query — all data fetched fresh on mount (acceptable for demo; add stale-while-revalidate for production)

## WebSocket
- Single module-level Socket.io connection (ref-counted)
- React StrictMode safe (off/on handlers per instance)
- Reconnects: 10 attempts, 1s delay
- Namespace: `/ws`

---

# PART 18: ERROR HANDLING STRATEGY

## Backend
- `GlobalExceptionFilter` → all uncaught exceptions → structured JSON
- Each service method: try/catch with `NotFoundException`, `UnauthorizedException`, `BadRequestException`
- Database errors: Prisma throws on constraint violations → caught by filter
- Neo4j down: `onModuleInit` warns, continues — graph endpoints return empty/fallback
- Qdrant down: same pattern — memory endpoints return empty
- Redis down: `get()` returns null (cache miss), `set()` is no-op — never blocks request
- LLM failure: 3 retries → template answer fallback — never throws to client

## Frontend
- `ErrorBoundary` (class component) wraps all page content — catches render errors
- Axios interceptor: 401 → clearAuth + redirect to login
- All API calls: try/catch with `toast.error(...)` on failure
- Loading states: `<PageSkeleton />` on all pages — no blank screens
- `ConfirmDialog` on destructive actions — prevents accidental data loss

---

# PART 19: WEBSOCKET EVENTS REFERENCE

| Event | Direction | Payload | Trigger |
|-------|-----------|---------|---------|
| `agent:thought` | Server→Client | `AgentThought` | Each agent step |
| `workflow:started` | Server→Client | `{ question }` | `POST /agents/ask` received |
| `workflow:completed` | Server→Client | `AskRailMindResponse` | All agents finished |
| `agent:completed` | Server→Client | `{ agentName, output }` | Single agent done |
| `incident:created` | Server→Client | `Incident` | `POST /incidents` |
| `risk:update` | Server→Client | `{ assetId, riskScore, severity }` | Risk recalculated |

Frontend subscribes in `use-websocket.ts`:
- `agent:thought` → `agentStore.addThought()`
- `workflow:started` → `agentStore.setWorkflowStatus("running")`
- `workflow:completed` → `agentStore.setLastResponse()`

---

# PART 20: KNOWN LIMITATIONS & FUTURE WORK

| Item | Current | Future |
|------|---------|--------|
| LLM model | GPT-4o-mini (cost optimized) | GPT-4o for production |
| Embeddings | text-embedding-3-small (1536d) | text-embedding-3-large (3072d) for better accuracy |
| Agent parallelism | Sequential (incident→knowledge→risk→...) | Parallel: incident + knowledge simultaneously |
| Mock embeddings | Hash-based (non-semantic) | Block startup if no OpenAI key in production |
| ManualS collection | Reserved (no data) | Ingest PDF maintenance manuals |
| Time Travel Mode | Not implemented | Event-sourced snapshots of network state at any point in time |
| Admin Console | Basic settings page | Full CRUD user management, role assignment |
| MinIO | Docker service only | Document attachment on incidents/maintenance |
| Mobile app | Web responsive only | React Native app for field engineers |
| bcrypt timing | Leaks user existence | Add dummy `bcrypt.compare()` for non-existent users |
| Frontend types | Some `any` remaining | Full TypeScript strict mode |


---

> **Next steps:**
> - Run it locally → [Setup Guide](SETUP.md)
> - Deploy to production → [Deployment Guide](DEPLOY.md)
> - ← [Back to README](../README.md)
