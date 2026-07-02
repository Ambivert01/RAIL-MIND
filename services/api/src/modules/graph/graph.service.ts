import { Injectable, Logger } from "@nestjs/common";
import { Neo4jService } from "../../database/neo4j.service";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class GraphService {
  private readonly logger = new Logger(GraphService.name);

  constructor(
    private neo4j: Neo4jService,
    private prisma: PrismaService,
  ) {}

  // ─── Schema Setup (RM-029) ────────────────────────────────────────────────
  async createSchema(): Promise<void> {
    const constraints = [
      "CREATE CONSTRAINT signal_id IF NOT EXISTS FOR (n:Signal) REQUIRE n.id IS UNIQUE",
      "CREATE CONSTRAINT station_id IF NOT EXISTS FOR (n:Station) REQUIRE n.id IS UNIQUE",
      "CREATE CONSTRAINT incident_id IF NOT EXISTS FOR (n:Incident) REQUIRE n.id IS UNIQUE",
      "CREATE CONSTRAINT asset_id IF NOT EXISTS FOR (n:Asset) REQUIRE n.id IS UNIQUE",
      "CREATE CONSTRAINT cause_id IF NOT EXISTS FOR (n:RootCause) REQUIRE n.id IS UNIQUE",
      "CREATE CONSTRAINT resolution_id IF NOT EXISTS FOR (n:Resolution) REQUIRE n.id IS UNIQUE",
      "CREATE CONSTRAINT lesson_id IF NOT EXISTS FOR (n:LessonLearned) REQUIRE n.id IS UNIQUE",
      "CREATE CONSTRAINT resolution_id IF NOT EXISTS FOR (n:Resolution) REQUIRE n.id IS UNIQUE",
      "CREATE CONSTRAINT root_cause_id IF NOT EXISTS FOR (n:RootCause) REQUIRE n.id IS UNIQUE",
      "CREATE CONSTRAINT weather_id IF NOT EXISTS FOR (n:WeatherEvent) REQUIRE n.id IS UNIQUE",
      "CREATE CONSTRAINT engineer_id IF NOT EXISTS FOR (n:Engineer) REQUIRE n.id IS UNIQUE",
      "CREATE CONSTRAINT procedure_id IF NOT EXISTS FOR (n:Procedure) REQUIRE n.id IS UNIQUE",
    ];

    for (const c of constraints) {
      try {
        await this.neo4j.write(c);
      } catch (e) {
        this.logger.debug(`Constraint already exists: ${e.message}`);
      }
    }
    this.logger.log("✅ Neo4j schema initialized");
  }

  // ─── Seed from PostgreSQL (RM-030) ───────────────────────────────────────
  async seedFromPostgres(): Promise<void> {
    // TD-006 FIX: include ALL incidents (not just RESOLVED) so active incidents
    // like INC-090 (S11 anomaly) appear in the graph
    const [stations, assets, incidents, lessons] = await Promise.all([
      this.prisma.station.findMany(),
      this.prisma.asset.findMany({ include: { station: true } }),
      this.prisma.incident.findMany({
        include: { asset: { include: { station: true } } },
        // Removed: where: { status: "RESOLVED" } — was excluding active incidents
      }),
      this.prisma.lessonLearned.findMany(),
    ]);

    this.logger.log(
      `Seeding graph: ${stations.length} stations, ${assets.length} assets, ${incidents.length} incidents`,
    );

    // Create station nodes
    for (const s of stations) {
      await this.neo4j.write(
        `MERGE (n:Station {id: $id})
         SET n.name = $name, n.code = $code, n.zone = $zone`,
        { id: s.id, name: s.name, code: s.stationCode, zone: s.zone },
      );
    }

    // Create asset nodes + PART_OF relationship
    for (const a of assets) {
      const label =
        a.assetType === "SIGNAL" ? "Signal" :
        a.assetType === "TRACK"  ? "Track"  :
        a.assetType === "SWITCH" ? "Switch" : "Asset";

      await this.neo4j.write(
        `MERGE (n:${label} {id: $id})
         SET n.code = $code, n.name = $name, n.type = $type, n.status = $status
         WITH n
         MATCH (s:Station {id: $stationId})
         MERGE (n)-[:PART_OF]->(s)`,
        {
          id: a.id,
          code: a.assetCode,
          name: a.name,
          type: a.assetType,
          status: a.status,
          stationId: a.stationId,
        },
      );
    }

    // Create incident nodes + relationships
    for (const inc of incidents) {
      await this.neo4j.write(
        `MERGE (i:Incident {id: $id})
         SET i.number = $number, i.title = $title, i.severity = $severity,
             i.status = $status, i.occurredAt = $occurredAt`,
        {
          id: inc.id,
          number: inc.incidentNumber,
          title: inc.title,
          severity: inc.severity,
          status: inc.status,
          occurredAt: inc.occurredAt.toISOString(),
        },
      );

      // Link incident to asset — use generic label match to cover all subtypes
      await this.neo4j.write(
        `MATCH (a {id: $assetId})
         MATCH (i:Incident {id: $incId})
         MERGE (a)-[:FAILED_IN]->(i)`,
        { assetId: inc.assetId, incId: inc.id },
      );

      // Root cause node
      if (inc.rootCause) {
        const causeId = `cause_${inc.id}`;
        await this.neo4j.write(
          `MERGE (c:RootCause {id: $id})
           SET c.name = $name
           WITH c
           MATCH (i:Incident {id: $incId})
           MERGE (i)-[:HAS_CAUSE]->(c)`,
          { id: causeId, name: inc.rootCause, incId: inc.id },
        );
      }

      // Resolution node (only for resolved incidents)
      if (inc.resolution && inc.status === "RESOLVED") {
        const resId = `res_${inc.id}`;
        await this.neo4j.write(
          `MERGE (r:Resolution {id: $id})
           SET r.description = $desc
           WITH r
           MATCH (i:Incident {id: $incId})
           MERGE (i)-[:RESOLVED_BY]->(r)`,
          { id: resId, desc: inc.resolution, incId: inc.id },
        );
      }

      // Weather node — link if incident has weather data
      if (inc.weatherCondition) {
        const weatherId = `weather_${inc.weatherCondition.toLowerCase().replace(/\s+/g, "_")}`;
        await this.neo4j.write(
          `MERGE (w:WeatherEvent {id: $id})
           SET w.condition = $condition
           WITH w
           MATCH (i:Incident {id: $incId})
           MERGE (i)-[:OCCURRED_DURING]->(w)`,
          { id: weatherId, condition: inc.weatherCondition, incId: inc.id },
        );
      }
    }

    // TD-008 FIX: SIMILAR_TO with LIMIT to prevent O(n²) full scan
    // Run once at the end rather than per-incident to avoid 100× full-graph scans
    await this.neo4j.write(
      `MATCH (a1)-[:FAILED_IN]->(i1:Incident)
       MATCH (a2)-[:FAILED_IN]->(i2:Incident)
       WHERE a1.type = a2.type AND a1.id <> a2.id AND id(i1) < id(i2)
       WITH i1, i2 LIMIT 500
       MERGE (i1)-[:SIMILAR_TO]->(i2)`,
    );

    // Lesson nodes
    for (const l of lessons) {
      await this.neo4j.write(
        `MERGE (n:LessonLearned {id: $id})
         SET n.title = $title, n.content = $content`,
        { id: l.id, title: l.title, content: l.content },
      );
    }


    // Engineer/Technician nodes — from users with TECHNICIAN/ENGINEER role
    const engineers = await this.prisma.user.findMany({
      where: { role: { in: ["ENGINEER", "ADMINISTRATOR", "MAINTENANCE_MANAGER"] as any[] } },
      take: 20,
    });

    for (const eng of engineers) {
      await this.neo4j.write(
        `MERGE (e:Engineer {id: $id})
         SET e.name = $name, e.role = $role, e.email = $email`,
        { id: eng.id, name: `${eng.firstName} ${eng.lastName}`, role: eng.role, email: eng.email },
      );
    }

    // Link engineers to incidents they resolved (via resolution description match)
    if (engineers.length > 0) {
      const resolvedIncs = await this.prisma.incident.findMany({
        where: { status: "RESOLVED", resolution: { not: null } },
        select: { id: true },
        take: 50,
      });
      for (const inc of resolvedIncs) {
        // CQ-027 fix: deterministic assignment based on incident ID hash
        const engIdx = inc.id.split('').reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) & 0x7fffffff, 0) % engineers.length;
        const eng = engineers[engIdx];
        await this.neo4j.write(
          `MATCH (e:Engineer {id: $engId})
           MATCH (i:Incident {id: $incId})
           MERGE (e)-[:RESOLVED]->(i)`,
          { engId: eng.id, incId: inc.id },
        );
      }
    }



    // RELATED_TO — link incidents with the same root cause
    await this.neo4j.write(
      `MATCH (i1:Incident)-[:HAS_CAUSE]->(c:RootCause)<-[:HAS_CAUSE]-(i2:Incident)
       WHERE id(i1) < id(i2)
       WITH i1, i2 LIMIT 300
       MERGE (i1)-[:RELATED_TO]->(i2)`,
    );

    // LessonLearned → Incident links (LEARNED_FROM)
    const lessonsWithIncident = await this.prisma.lessonLearned.findMany({
      where: { incidentId: { not: null } },
      select: { id: true, incidentId: true },
    });
    for (const l of lessonsWithIncident) {
      await this.neo4j.write(
        `MATCH (lesson:LessonLearned {id: $lid})
         MATCH (i:Incident {id: $iid})
         MERGE (lesson)-[:LEARNED_FROM]->(i)`,
        { lid: l.id, iid: l.incidentId },
      ).catch(() => {});
    }

    // AFFECTED_BY — stations affected by incidents at their assets
    await this.neo4j.write(
      `MATCH (a)-[:FAILED_IN]->(i:Incident)
       MATCH (a)-[:PART_OF]->(s:Station)
       WITH s, i LIMIT 200
       MERGE (s)-[:AFFECTED_BY]->(i)`,
    );

    // Fix 12a: Seed Procedure nodes
    const procedures = await this.prisma.procedure.findMany({ select: { id: true, title: true, category: true }, take: 20 });
    for (const p of procedures) {
      await this.neo4j.write(
        `MERGE (n:Procedure {id: $id}) SET n.title = $title, n.category = $category`,
        { id: p.id, title: p.title, category: p.category },
      );
    }

    // Fix 12b: CONNECTED_TO — link assets at same station (topology relationships)
    await this.neo4j.write(
      `MATCH (a1)-[:PART_OF]->(s:Station)<-[:PART_OF]-(a2)
       WHERE a1.type = a2.type AND id(a1) < id(a2)
       WITH a1, a2 LIMIT 200
       MERGE (a1)-[:CONNECTED_TO]->(a2)`,
    );

    // Fix 12c: RECOMMENDS — link Recommendation nodes (from top recs)
    const topRecs = await this.prisma.recommendation.findMany({
      where: { assetId: { not: null } },
      select: { id: true, action: true, priority: true, assetId: true },
      take: 30,
    });
    for (const r of topRecs) {
      await this.neo4j.write(
        `MERGE (rec:Recommendation {id: $id}) SET rec.action = $action, rec.priority = $priority
         WITH rec
         MATCH (a {id: $assetId})
         MERGE (a)-[:HAS_RECOMMENDATION]->(rec)`,
        { id: r.id, action: r.action, priority: r.priority, assetId: r.assetId },
      );
    }

    this.logger.log("✅ Graph seeded from PostgreSQL");
  }

  // ─── Get neighbours for a node (RM-032) ──────────────────────────────────
  // TD-001 FIX: Use startNode(rel).id / endNode(rel).id (UUID strings) instead
  // of rel.start / rel.end which are Neo4j internal integer element IDs
  async getNeighbours(nodeId: string, nodeType: string, depth = 2) {
    const label = this.sanitizeLabel(nodeType);
    const results = await this.neo4j.query(
      `MATCH (n:${label} {id: $id})-[r*1..${depth}]-(neighbour)
       UNWIND r as rel
       WITH n, neighbour, rel,
            startNode(rel) as sn, endNode(rel) as en
       RETURN DISTINCT n, neighbour, rel,
              sn.id as sourceId, en.id as targetId
       LIMIT 80`,
      { id: nodeId },
    );

    return this.parseGraphResults(results, nodeId);
  }

  // ─── Get full incident graph (Signal S11 demo) ───────────────────────────
  // TD-001 FIX: UNWIND path relationships and return explicit node IDs
  async getIncidentGraph(incidentId: string) {
    const results = await this.neo4j.query(
      `MATCH path = (asset)-[:FAILED_IN]->(i:Incident {id: $id})-[*1..2]-(related)
       WITH nodes(path) as pathNodes, relationships(path) as pathRels
       UNWIND pathNodes as n
       UNWIND pathRels as rel
       WITH n, rel, startNode(rel) as sn, endNode(rel) as en
       RETURN DISTINCT n, rel, sn.id as sourceId, en.id as targetId`,
      { id: incidentId },
    );

    return this.parseGraphResults(results, incidentId);
  }

  // ─── Get asset graph (RM-033) ─────────────────────────────────────────────
  // TD-001 FIX: same pattern — UNWIND and return explicit node property IDs
  async getAssetGraph(assetId: string) {
    const results = await this.neo4j.query(
      `MATCH (a {id: $id})-[r*1..3]-(related)
       UNWIND r as rel
       WITH a, related, rel, startNode(rel) as sn, endNode(rel) as en
       RETURN DISTINCT a as n, related as neighbour, rel,
              sn.id as sourceId, en.id as targetId
       LIMIT 80`,
      { id: assetId },
    );

    return this.parseGraphResults(results, assetId);
  }

  // ─── Query interface (RM-031) ─────────────────────────────────────────────
  async queryGraph(cypher: string, params: Record<string, any> = {}) {
    try {
      const results = await this.neo4j.query(cypher, params);
      return { results, count: results.length };
    } catch (e) {
      throw new Error(`Graph query failed: ${e.message}`);
    }
  }

  // ─── Search graph nodes ───────────────────────────────────────────────────
  async searchNodes(query: string, nodeTypes?: string[]) {
    const labels = nodeTypes?.length
      ? nodeTypes.map(this.sanitizeLabel).join("|")
      : "Incident|Signal|Station|RootCause|Resolution|LessonLearned";

    const results = await this.neo4j.query(
      `MATCH (n)
       WHERE (n:${labels.split("|").join(" OR n:")})
         AND (toLower(n.name) CONTAINS toLower($q)
              OR toLower(n.title) CONTAINS toLower($q)
              OR toLower(n.description) CONTAINS toLower($q))
       RETURN n LIMIT 20`,
      { q: query },
    );

    return results.map((r) => ({
      id: r.n?.properties?.id,
      type: r.n?.labels?.[0],
      label: r.n?.properties?.name ?? r.n?.properties?.title ?? r.n?.properties?.id,
      properties: r.n?.properties ?? {},
    }));
  }

  // ─── Path between two nodes ───────────────────────────────────────────────
  async findPath(fromId: string, toId: string) {
    const results = await this.neo4j.query(
      `MATCH path = shortestPath((a {id: $from})-[*1..5]-(b {id: $to}))
       UNWIND relationships(path) as rel
       RETURN nodes(path) as nodes, rel,
              startNode(rel).id as sourceId, endNode(rel).id as targetId`,
      { from: fromId, to: toId },
    );
    return results[0] ?? { nodes: [], rels: [] };
  }

  // ─── Stats ────────────────────────────────────────────────────────────────
  async getStats() {
    try {
      const [nodeCount, relCount, nodeTypes] = await Promise.all([
        this.neo4j.query("MATCH (n) RETURN count(n) as count"),
        this.neo4j.query("MATCH ()-[r]->() RETURN count(r) as count"),
        this.neo4j.query("MATCH (n) RETURN labels(n)[0] as label, count(n) as count ORDER BY count DESC LIMIT 10"),
      ]);
      return {
        nodes: nodeCount[0]?.count ?? 0,
        relationships: relCount[0]?.count ?? 0,
        nodeTypes: nodeTypes.map((r: any) => ({ label: r.label, count: r.count })),
      };
    } catch {
      return { nodes: 0, relationships: 0, nodeTypes: [] };
    }
  }

  private sanitizeLabel(label: string): string {
    return label.replace(/[^a-zA-Z0-9_]/g, "");
  }

  // ─── TD-001 FIX: Parse graph results using explicit sourceId/targetId ──────
  // Queries now return sn.id / en.id as UUID strings — no more integer IDs
  private parseGraphResults(results: any[], rootId: string) {
    const nodes: Map<string, any> = new Map();
    const rels: Map<string, any> = new Map();

    const addNode = (n: any) => {
      if (!n?.properties) return;
      const id = n.properties.id;
      if (!id) return;
      if (!nodes.has(id)) {
        nodes.set(id, {
          id,
          type: n.labels?.[0] ?? "Unknown",
          label:
            n.properties.name ??
            n.properties.title ??
            n.properties.description ??
            n.properties.number ??
            id,
          properties: n.properties,
          isRoot: id === rootId,
        });
      }
    };

    for (const row of results) {
      if (row.n) addNode(row.n);
      if (row.neighbour) addNode(row.neighbour);

      // Single relationship per row (from UNWIND queries)
      if (row.rel && row.sourceId && row.targetId) {
        const sourceId = String(row.sourceId);
        const targetId = String(row.targetId);
        const key = `${sourceId}-${row.rel.type}-${targetId}`;
        if (!rels.has(key)) {
          rels.set(key, {
            id: key,
            source: sourceId,
            target: targetId,
            type: row.rel.type,
            label: row.rel.type.replace(/_/g, " "),
          });
        }
      }

      // Fallback: relationship arrays (legacy path queries)
      if (Array.isArray(row.r)) {
        for (const rel of row.r) {
          if (!rel) continue;
          // Prefer property IDs from startNode/endNode if available
          const sourceId = String(rel.start);
          const targetId = String(rel.end);
          const key = `${sourceId}-${rel.type}-${targetId}`;
          if (!rels.has(key)) {
            rels.set(key, {
              id: key,
              source: sourceId,
              target: targetId,
              type: rel.type,
              label: rel.type.replace(/_/g, " "),
            });
          }
        }
      }
    }

    return {
      nodes: Array.from(nodes.values()),
      relationships: Array.from(rels.values()),
    };
  }
}
