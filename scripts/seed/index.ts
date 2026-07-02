import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import * as path from "path";
import * as fs from "fs";
import neo4j from "neo4j-driver";
import { QdrantClient } from "@qdrant/js-client-rest";

// ─── Load seed data ───────────────────────────────────────────────────────────
const load = (file: string) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, "../data", file), "utf-8"));

const stationsData = load("stations.json");
const assetsData = load("assets.json");
const incidentsData = load("incidents.json");
const lessonsData = load("lessons.json");
const proceduresData = load("procedures.json");
const recommendationsData = load("recommendations.json");

const prisma = new PrismaClient();

// ─── Convert string ID to numeric ID for Qdrant ──────────────────────────────
// Convert any string ID to a valid deterministic UUID for Qdrant
function toQdrantId(id: string): string {
  // Build a 32-char hex string deterministically from the input
  let h = [0x6c62272e, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35];
  for (let i = 0; i < id.length; i++) {
    const c = id.charCodeAt(i);
    h[0] = (Math.imul(h[0] ^ c, 0x9e3779b9) + i) >>> 0;
    h[1] = (Math.imul(h[1] ^ c, 0x6c62272e) + i) >>> 0;
    h[2] = (Math.imul(h[2] ^ c, 0x85ebca6b) + i) >>> 0;
    h[3] = (Math.imul(h[3] ^ c, 0xc2b2ae35) + i) >>> 0;
  }
  const hex = h.map(n => n.toString(16).padStart(8, '0')).join('');
  // Format as valid UUID: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    '4' + hex.slice(13, 16),
    (((parseInt(hex[16], 16) & 0x3) | 0x8)).toString(16) + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join('-');
}

// ─── Simple mock embeddings for seed (no API key needed) ─────────────────────
function mockEmbed(text: string): number[] {
  const dim = 1536;
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  const seed = Math.abs(hash);
  const rng = (() => { let s = seed; return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; }; })();
  const vec = Array.from({ length: dim }, () => rng() * 2 - 1);
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return norm > 0 ? vec.map((v) => v / norm) : vec;
}

// ─── PostgreSQL Seed ──────────────────────────────────────────────────────────
async function seedPostgres() {
  console.log("🌱 Seeding PostgreSQL...");

  // Users
  const password = await bcrypt.hash("railmind123", 10);
  const users = await Promise.all([
    prisma.user.upsert({ where: { email: "engineer@railmind.com" }, update: {}, create: { id: "user001", email: "engineer@railmind.com", passwordHash: password, firstName: "Arjun", lastName: "Mehta", role: "ENGINEER" } }),
    prisma.user.upsert({ where: { email: "operator@railmind.com" }, update: {}, create: { id: "user002", email: "operator@railmind.com", passwordHash: password, firstName: "Kavita", lastName: "Rao", role: "OPERATOR" } }),
    prisma.user.upsert({ where: { email: "manager@railmind.com" }, update: {}, create: { id: "user003", email: "manager@railmind.com", passwordHash: password, firstName: "Sameer", lastName: "Singh", role: "MAINTENANCE_MANAGER" } }),
    prisma.user.upsert({ where: { email: "safety@railmind.com" }, update: {}, create: { id: "user004", email: "safety@railmind.com", passwordHash: password, firstName: "Priya", lastName: "Sharma", role: "SAFETY_OFFICER" } }),
    prisma.user.upsert({ where: { email: "admin@railmind.com" }, update: {}, create: { id: "user005", email: "admin@railmind.com", passwordHash: password, firstName: "Admin", lastName: "RailMind", role: "ADMINISTRATOR" } }),
  ]);
  console.log(`  ✅ ${users.length} users created`);

  // Stations
  for (const s of stationsData) {
    await prisma.station.upsert({
      where: { stationCode: s.stationCode },
      update: { status: s.status as any },
      create: {
        id: s.id, stationCode: s.stationCode, name: s.name,
        latitude: s.latitude, longitude: s.longitude,
        status: s.status as any, zone: s.zone, description: s.description,
      },
    });
  }
  console.log(`  ✅ ${stationsData.length} stations created`);

  // Assets
  for (const a of assetsData) {
    await prisma.asset.upsert({
      where: { assetCode: a.assetCode },
      update: { status: a.status as any, healthScore: a.healthScore },
      create: {
        id: a.id, stationId: a.stationId, assetType: a.assetType as any,
        assetCode: a.assetCode, name: a.name, status: a.status as any,
        healthScore: a.healthScore, description: a.description,
        latitude: a.latitude ?? null, longitude: a.longitude ?? null,
        installationDate: a.installationDate ? new Date(a.installationDate) : null,
        lastMaintenanceAt: a.lastMaintenanceAt ? new Date(a.lastMaintenanceAt) : null,
      },
    });
  }
  console.log(`  ✅ ${assetsData.length} assets created`);

  // Incidents
  for (const inc of incidentsData) {
    await prisma.incident.upsert({
      where: { incidentNumber: inc.incidentNumber },
      update: { status: inc.status as any },
      create: {
        id: inc.id, incidentNumber: inc.incidentNumber,
        title: inc.title, description: inc.description,
        severity: inc.severity as any, status: inc.status as any,
        assetId: inc.assetId, rootCause: inc.rootCause ?? null,
        resolution: inc.resolution ?? null,
        lessonsLearned: inc.lessonsLearned ?? null,
        weatherCondition: inc.weatherCondition ?? null,
        occurredAt: new Date(inc.occurredAt),
        resolvedAt: inc.resolvedAt ? new Date(inc.resolvedAt) : null,
        createdById: "user001",
      },
    });
  }
  console.log(`  ✅ ${incidentsData.length} incidents created`);

  // Add timeline events for key incidents
  const keyIncidents = ["inc044", "inc057", "inc081", "inc090"];
  for (const incId of keyIncidents) {
    const inc = incidentsData.find((i: any) => i.id === incId);
    if (!inc) continue;
    await prisma.incidentEvent.deleteMany({ where: { incidentId: incId } });
    const events = [
      { eventType: "INCIDENT_DETECTED", description: `Anomaly detected on ${inc.assetId === "sig011" ? "Signal S11" : "asset"}` },
      { eventType: "INVESTIGATION_STARTED", description: "Maintenance team dispatched", agentName: "INCIDENT" },
      { eventType: "ROOT_CAUSE_IDENTIFIED", description: `Root cause identified: ${inc.rootCause ?? "Under investigation"}`, agentName: "INCIDENT" },
    ];
    if (inc.resolution) {
      events.push({ eventType: "RESOLUTION_APPLIED", description: inc.resolution, agentName: "ENGINEER" });
      events.push({ eventType: "INCIDENT_RESOLVED", description: "Incident closed after verification" });
    }
    for (let i = 0; i < events.length; i++) {
      const ts = new Date(inc.occurredAt);
      ts.setHours(ts.getHours() + i * 2);
      await prisma.incidentEvent.create({
        data: { incidentId: incId, ...events[i] as any, timestamp: ts },
      });
    }
  }

  // Maintenance records
  const maintRecords = [
    { assetId: "sig011", maintenanceType: "INSPECTION", description: "Routine relay resistance test and visual inspection", performedAt: "2025-04-10", outcome: "SUCCESSFUL", findings: "Minor surface oxidation on relay contacts. Cleaned and treated.", performedById: "user001" },
    { assetId: "sig011", maintenanceType: "REPLACEMENT", description: "Emergency relay replacement following INC-044", performedAt: "2024-07-13", outcome: "SUCCESSFUL", findings: "Relay corrosion confirmed. Marine-grade relay installed.", performedById: "user001" },
    { assetId: "sig011", maintenanceType: "REPAIR", description: "Housing seal replacement and drainage installation following INC-057", performedAt: "2025-09-04", outcome: "SUCCESSFUL", performedById: "user003" },
    { assetId: "sig011", maintenanceType: "REPLACEMENT", description: "Connector upgrade following INC-081", performedAt: "2026-01-19", outcome: "SUCCESSFUL", findings: "Gold-plated marine connector installed. Dielectric grease applied.", performedById: "user001" },
    { assetId: "sig011", maintenanceType: "INSPECTION", description: "Pre-monsoon check", performedAt: "2025-11-01", outcome: "PARTIAL", findings: "Housing seal showing wear. Scheduled for replacement.", performedById: "user001" },
    { assetId: "sig012", maintenanceType: "REPLACEMENT", description: "Relay replacement following INC-012", performedAt: "2024-10-23", outcome: "SUCCESSFUL", performedById: "user001" },
    { assetId: "sw002", maintenanceType: "REPLACEMENT", description: "Point motor replacement following INC-023", performedAt: "2024-11-05", outcome: "SUCCESSFUL", performedById: "user003" },
    { assetId: "trk003", maintenanceType: "REPAIR", description: "Track joint replacement at 3.4km following INC-031", performedAt: "2025-02-16", outcome: "SUCCESSFUL", performedById: "user003" },
    { assetId: "sig015", maintenanceType: "CALIBRATION", description: "Temperature calibration following INC-038", performedAt: "2025-04-09", outcome: "SUCCESSFUL", performedById: "user001" },
    { assetId: "sig016", maintenanceType: "REPAIR", description: "Firmware rollback following INC-017", performedAt: "2024-03-01", outcome: "SUCCESSFUL", performedById: "user002" },
    { assetId: "sig013", maintenanceType: "SCHEDULED_MAINTENANCE", description: "Annual overhaul", performedAt: "2026-01-20", outcome: "SUCCESSFUL", performedById: "user001" },
    { assetId: "cc001", maintenanceType: "INSPECTION", description: "SCADA system health check", performedAt: "2026-04-01", outcome: "SUCCESSFUL", performedById: "user005" },
  ];

  for (const m of maintRecords) {
    await prisma.maintenanceRecord.create({
      data: {
        assetId: m.assetId,
        maintenanceType: m.maintenanceType as any,
        description: m.description,
        performedById: m.performedById ?? "user001",
        performedAt: new Date(m.performedAt),
        outcome: m.outcome as any,
        findings: (m as any).findings ?? null,
      },
    });
  }
  console.log(`  ✅ ${maintRecords.length} maintenance records created`);

  // Lessons Learned
  for (const l of lessonsData) {
    await prisma.lessonLearned.upsert({
      where: { id: l.id },
      update: {},
      create: { id: l.id, title: l.title, content: l.content, assetType: l.assetType ?? null, incidentId: l.incidentId ?? null, tags: l.tags },
    });
  }
  console.log(`  ✅ ${lessonsData.length} lessons created`);

  // Procedures
  for (const p of proceduresData) {
    await prisma.procedure.upsert({
      where: { id: p.id },
      update: {},
      create: { id: p.id, title: p.title, category: p.category, version: p.version, content: p.content, tags: p.tags },
    });
  }
  console.log(`  ✅ ${proceduresData.length} procedures created`);

  // Recommendations
  for (const r of recommendationsData) {
    try {
      await prisma.recommendation.upsert({
        where: { id: r.id },
        update: {},
        create: {
          id: r.id,
          assetId: r.assetId ?? null,
          incidentId: r.incidentId ?? null,
          priority: (r.priority ?? "MEDIUM") as any,
          confidence: r.confidence ?? 75,
          action: r.action,
          actionType: (r.actionType ?? "INSPECT") as any,
          reason: r.reason ?? r.action,
          evidence: r.evidence ?? [],
          expectedOutcome: r.expectedOutcome ?? null,
          estimatedResolutionTime: r.estimatedResolutionTime ?? null,
          status: r.status as any,
        },
      });
    } catch (e) { /* skip duplicates */ }
  }
  console.log(`  ✅ ${recommendationsData.length} recommendations created`);

  // Risk records for S11
  await prisma.riskRecord.upsert({
    where: { id: "risk-sig011" },
    update: {},
    create: {
      id: "risk-sig011",
      assetId: "sig011",
      riskScore: 87,
      severity: "CRITICAL",
      confidence: 92,
      possibleFailure: "Complete relay failure within 24-48 hours",
      rootCauseSummary: "Three relay failures in 18 months (INC-044, INC-061, INC-090) with active current anomaly. Pre-monsoon humidity elevation increases failure probability.",
      recommendation: "Replace relay immediately. Apply marine-grade specification. Install resistance monitoring.",
      factors: [
        { name: "Asset Health", weight: 30, value: 77, description: "Health score: 23%" },
        { name: "Maintenance Status", weight: 20, value: 85, description: "Last maintenance: Nov 2025 — 7 months ago" },
        { name: "Incident History", weight: 20, value: 90, description: "3 open/recent incidents, 1 critical" },
        { name: "Environmental Risk", weight: 15, value: 85, description: "Pre-monsoon high humidity in Rivergate zone" },
        { name: "Operational Factors", weight: 15, value: 80, description: "Critical signal on active route" }
      ],
      isActive: true,
    },
  });

  // Alerts
  await prisma.alert.deleteMany({ where: { assetId: { in: ["sig011", "sig012", "sw002"] } } });
  await prisma.alert.createMany({
    data: [
      { assetId: "sig011", alertType: "RISK_CRITICAL", severity: "CRITICAL", message: "Signal S11 at critical risk (87/100) — immediate action required", status: "UNREAD" },
      { assetId: "sig011", alertType: "CURRENT_ANOMALY", severity: "CRITICAL", message: "Abnormal current draw detected on Signal S11 relay circuit", status: "UNREAD" },
      { assetId: "sig012", alertType: "MAINTENANCE_OVERDUE", severity: "HIGH", message: "Signal S12 maintenance overdue by 240 days", status: "UNREAD" },
      { assetId: "sw002", alertType: "PERFORMANCE_DEGRADED", severity: "MEDIUM", message: "Switch SW-002 operation time exceeding threshold", status: "ACKNOWLEDGED" },
    ],
  });
  console.log("  ✅ Alerts created");

  console.log("✅ PostgreSQL seeding complete");
}

// ─── Neo4j Seed ───────────────────────────────────────────────────────────────
async function seedNeo4j() {
  const uri = process.env.NEO4J_URI || "bolt://localhost:7687";
  const user = process.env.NEO4J_USER || "neo4j";
  const password = process.env.NEO4J_PASSWORD || "railmind_neo4j";

  let driver: any;
  try {
    driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
    await driver.verifyConnectivity();
  } catch (e) {
    console.log("  ⚠️  Neo4j not available — skipping graph seed");
    return;
  }

  console.log("🌱 Seeding Neo4j Knowledge Graph...");
  const session = driver.session();

  try {
    // Clear existing
    await session.run("MATCH (n) DETACH DELETE n");

    // Stations
    for (const s of stationsData) {
      await session.run(
        `CREATE (n:Station {id: $id, name: $name, code: $code, zone: $zone})`,
        { id: s.id, name: s.name, code: s.stationCode, zone: s.zone },
      );
    }

    // Assets
    for (const a of assetsData) {
      const label = a.assetType === "SIGNAL" ? "Signal" : a.assetType === "TRACK" ? "Track" : a.assetType === "SWITCH" ? "Switch" : "Asset";
      await session.run(
        `CREATE (n:${label} {id: $id, code: $code, name: $name, type: $type, status: $status})
         WITH n MATCH (s:Station {id: $stationId}) CREATE (n)-[:PART_OF]->(s)`,
        { id: a.id, code: a.assetCode, name: a.name, type: a.assetType, status: a.status, stationId: a.stationId },
      );
    }

    // Incidents
    for (const inc of incidentsData) {
      await session.run(
        `CREATE (i:Incident {id: $id, number: $number, title: $title, severity: $severity, status: $status, occurredAt: $occurredAt})`,
        { id: inc.id, number: inc.incidentNumber, title: inc.title, severity: inc.severity, status: inc.status, occurredAt: inc.occurredAt },
      );

      const assetLabel = inc.assetId.startsWith("sig") ? "Signal" : inc.assetId.startsWith("sw") ? "Switch" : "Asset";
      await session.run(
        `MATCH (a:${assetLabel} {id: $assetId}) MATCH (i:Incident {id: $incId}) CREATE (a)-[:FAILED_IN]->(i)`,
        { assetId: inc.assetId, incId: inc.id },
      );

      if (inc.rootCause) {
        await session.run(
          `MERGE (c:RootCause {id: $cId, name: $name}) WITH c MATCH (i:Incident {id: $incId}) CREATE (i)-[:HAS_CAUSE]->(c)`,
          { cId: `cause_${inc.id}`, name: inc.rootCause, incId: inc.id },
        );
      }

      if (inc.resolution) {
        await session.run(
          `MERGE (r:Resolution {id: $rId, description: $desc}) WITH r MATCH (i:Incident {id: $incId}) CREATE (i)-[:RESOLVED_BY]->(r)`,
          { rId: `res_${inc.id}`, desc: inc.resolution, incId: inc.id },
        );
      }

      if (inc.lessonsLearned) {
        await session.run(
          `CREATE (l:LessonLearned {id: $lId, content: $content}) WITH l MATCH (i:Incident {id: $incId}) CREATE (i)-[:GENERATED]->(l)`,
          { lId: `lesson_from_${inc.id}`, content: inc.lessonsLearned.slice(0, 200), incId: inc.id },
        );
      }
    }

    // SIMILAR_TO links for S11 incidents
    const s11Incidents = ["inc044", "inc057", "inc061", "inc081", "inc090"];
    for (let i = 0; i < s11Incidents.length; i++) {
      for (let j = i + 1; j < s11Incidents.length; j++) {
        await session.run(
          `MATCH (i1:Incident {id: $id1}) MATCH (i2:Incident {id: $id2}) MERGE (i1)-[:SIMILAR_TO]->(i2)`,
          { id1: s11Incidents[i], id2: s11Incidents[j] },
        );
      }
    }

    // Weather nodes for Rivergate incidents
    await session.run(
      `CREATE (w:WeatherEvent {id: 'weather_monsoon_rg', type: 'Heavy Rainfall', location: 'Rivergate', humidity: '85%'})
       WITH w
       MATCH (i:Incident) WHERE i.id IN ['inc044', 'inc057', 'inc065', 'inc081']
       CREATE (i)-[:OCCURRED_DURING]->(w)`,
    );

    // Engineer expertise nodes
    await session.run(
      `CREATE (e1:Engineer {id: 'eng001', name: 'Arjun Mehta', specialization: 'Signals', experience: 25})
       CREATE (e2:Engineer {id: 'eng002', name: 'Kavita Rao', specialization: 'Infrastructure', experience: 20})
       CREATE (e3:Engineer {id: 'eng003', name: 'Sameer Singh', specialization: 'Maintenance', experience: 18})
       WITH e1, e2, e3
       MATCH (i:Incident) WHERE i.id IN ['inc044', 'inc057', 'inc081']
       CREATE (e1)-[:RESOLVED]->(i)`,
    );

    // Station CONNECTED_TO relationships
    const connections = [
      ["st001", "st002"], ["st002", "st003"], ["st001", "st004"],
      ["st004", "st005"], ["st005", "st006"], ["st004", "st007"],
      ["st007", "st008"], ["st008", "st009"], ["st009", "st010"],
    ];
    for (const [a, b] of connections) {
      await session.run(
        `MATCH (s1:Station {id: $a}) MATCH (s2:Station {id: $b}) MERGE (s1)-[:CONNECTED_TO]->(s2)`,
        { a, b },
      );
    }

    const stats = await session.run("MATCH (n) RETURN count(n) as nodes");
    const relStats = await session.run("MATCH ()-[r]->() RETURN count(r) as rels");
    console.log(`  ✅ Neo4j: ${stats.records[0].get("nodes").toNumber()} nodes, ${relStats.records[0].get("rels").toNumber()} relationships`);
  } finally {
    await session.close();
    await driver.close();
  }
}

// ─── Qdrant Seed ──────────────────────────────────────────────────────────────
async function seedQdrant() {
  const url = process.env.QDRANT_URL || "http://localhost:6333";
  let client: QdrantClient;

  try {
    client = new QdrantClient({ url });
    await client.getCollections();
  } catch (e) {
    console.log("  ⚠️  Qdrant not available — skipping vector seed");
    return;
  }

  console.log("🌱 Seeding Qdrant vector collections...");

  const collections = ["incidents", "lessons", "procedures", "recommendations"];
  for (const name of collections) {
    try {
      const exists = (await client.getCollections()).collections.some((c) => c.name === name);
      if (!exists) {
        await client.createCollection(name, { vectors: { size: 1536, distance: "Cosine" } });
      } else {
        await client.delete(name, { wait: true, filter: { must: [{ is_empty: { key: "id" } }] } }).catch(() => {});
      }
    } catch { }
  }

  // Seed incidents
  const incidentPoints = incidentsData.map((inc: any) => ({
    id: toQdrantId(inc.id),
    vector: mockEmbed(`${inc.title} ${inc.description} ${inc.rootCause ?? ""} ${inc.resolution ?? ""}`),
    payload: {
      incidentId: inc.id, incidentNumber: inc.incidentNumber, title: inc.title,
      description: inc.description, severity: inc.severity, status: inc.status,
      rootCause: inc.rootCause, resolution: inc.resolution,
      assetCode: assetsData.find((a: any) => a.id === inc.assetId)?.assetCode,
      assetType: assetsData.find((a: any) => a.id === inc.assetId)?.assetType,
      occurredAt: inc.occurredAt,
    },
  }));
  await client.upsert("incidents", { wait: true, points: incidentPoints });

  // Seed lessons
  const lessonPoints = lessonsData.map((l: any) => ({
    id: toQdrantId(l.id),
    vector: mockEmbed(`${l.title} ${l.content}`),
    payload: { lessonId: l.id, title: l.title, content: l.content, assetType: l.assetType, tags: l.tags, createdAt: new Date().toISOString() },
  }));
  await client.upsert("lessons", { wait: true, points: lessonPoints });

  // Seed procedures
  const procPoints = proceduresData.map((p: any) => ({
    id: toQdrantId(p.id),
    vector: mockEmbed(`${p.title} ${p.content}`),
    payload: { procedureId: p.id, title: p.title, content: p.content, category: p.category, tags: p.tags },
  }));
  await client.upsert("procedures", { wait: true, points: procPoints });

  console.log(`  ✅ Qdrant: ${incidentPoints.length} incidents, ${lessonPoints.length} lessons, ${procPoints.length} procedures vectorized`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🚂 RailMind Demo World Seed Starting...\n");

  try {
    await seedPostgres();
    await seedNeo4j();
    await seedQdrant();
    
  // ─── Auto-ingest all content into Qdrant vector memory (WF2-02 fix) ─────────
  console.log("\n📡 Ingesting knowledge into vector memory...");
  try {
    const { MemoryService } = await import("../services/api/src/modules/memory/memory.service");
    // We call the REST API instead since services have DI dependencies
    const baseUrl = process.env.API_URL || "http://localhost:3001/api/v1";
    const token = process.env.SEED_API_TOKEN;
    
    if (token) {
      // Ingests: incidents, lessons, procedures, maintenance records, recommendations
      const resp = await fetch(`${baseUrl}/memory/ingest-all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (resp.ok) {
        const result = await resp.json();
        console.log(`   Ingested: ${JSON.stringify(result)}`);
      } else {
        console.log("   Memory ingestion skipped (API not running during seed — run POST /memory/ingest-all after start)");
      }
    } else {
      console.log("   ⚠️  Set SEED_API_TOKEN env var to auto-ingest memory after seeding");
      console.log("      Or run: curl -X POST http://localhost:3001/api/v1/memory/ingest-all -H \"Authorization: Bearer <token>\"");
    }
  } catch {
    console.log("   Memory ingestion deferred — run POST /memory/ingest-all after starting API");
  }

console.log("\n🎉 Demo world seeded successfully!");
    console.log("\n📊 Credentials:");
    console.log("   engineer@railmind.com / railmind123");
    console.log("   operator@railmind.com / railmind123");
    console.log("   admin@railmind.com   / railmind123");
    console.log("\n🎯 Demo Asset: Signal S11 (assetCode: S11)");
    console.log("   Risk Score: 87 | Severity: CRITICAL | Confidence: 92%");

  // ─── Seed initial risk records for all assets (WF4-01 fix) ─────────────────
  console.log("   Seeding initial risk records...");
  const allAssets = await prisma.asset.findMany({ select: { id: true, assetCode: true, healthScore: true } });
  
  for (const asset of allAssets) {
    if (asset.id === "sig011") continue; // already seeded above
    
    const incidentCount = await prisma.incident.count({ where: { assetId: asset.id } });
    const healthScore = asset.healthScore ?? 70;
    
    // Simple risk formula for seeding
    let score = Math.max(5, Math.min(97,
      (100 - healthScore) * 0.4 +
      incidentCount * 12 +
      (healthScore < 50 ? 20 : 0)
    ));
    score = Math.round(score);
    const severity = score >= 81 ? "CRITICAL" : score >= 61 ? "HIGH" : score >= 31 ? "MODERATE" : "LOW";
    
    await prisma.riskRecord.upsert({
      where: { id: `risk-${asset.id}` },
      update: { riskScore: score, severity: severity as any },
      create: {
        id: `risk-${asset.id}`,
        assetId: asset.id,
        riskScore: score,
        severity: severity as any,
        confidence: 65,
        isActive: true,
        factors: [
          { name: "Health Score", weight: 40, value: 100 - healthScore, description: `Asset health at ${healthScore}%` },
          { name: "Incident History", weight: 40, value: Math.min(100, incidentCount * 15), description: `${incidentCount} incidents recorded` },
        ],
        possibleFailure: score >= 61 ? "Component degradation — preventive maintenance recommended" : "Within normal operating parameters",
        calculatedAt: new Date(),
      },
    });
  }
  console.log(`   Risk records: ${allAssets.length} assets scored`);

  // ─── Seed 7-day historical risk trend for S11 (WF4-05 fix) ──────────────────
  const trendScores = [72, 75, 79, 81, 83, 85, 87]; // escalating risk over 7 days
  for (let d = 6; d >= 0; d--) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    const score = trendScores[6 - d];
    await prisma.riskRecord.create({
      data: {
        id: `risk-sig011-hist-${d}`,
        assetId: "sig011",
        riskScore: score,
        severity: (score >= 81 ? "CRITICAL" : "HIGH") as any,
        confidence: 85,
        isActive: false, // historical record
        factors: [],
        possibleFailure: "Relay degradation pattern",
        calculatedAt: date,
      },
    }).catch(() => {}); // ignore duplicates on re-seed
  }
  console.log("   7-day trend data seeded for S11");


    console.log("   Key incidents: INC-044, INC-057, INC-081, INC-090");
  } catch (e) {
    console.error("❌ Seed failed:", e);
    throw e;
  } finally {
    await prisma.$disconnect();
  }
}

main();
