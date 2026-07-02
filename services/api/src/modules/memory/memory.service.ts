import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { QdrantService, COLLECTIONS } from "../../database/qdrant.service";
import { Neo4jService } from "../../database/neo4j.service";
import { EmbeddingsService } from "./embeddings.service";

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    private prisma: PrismaService,
    private qdrant: QdrantService,
    private neo4j: Neo4jService,
    private embeddings: EmbeddingsService,
  ) {}

  // ─── Ingest an incident into memory (vector + graph) ──────────────────────
  async ingestIncident(incidentId: string): Promise<void> {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: { asset: { include: { station: true } } },
    });
    if (!incident) return;

    const text = [
      incident.title,
      incident.description,
      incident.rootCause,
      incident.resolution,
      incident.lessonsLearned,
    ].filter(Boolean).join(". ");

    const vector = await this.embeddings.embed(text);

    await this.qdrant.upsert(COLLECTIONS.INCIDENTS, [{
      id: incident.id,
      vector,
      payload: {
        incidentId: incident.id,
        incidentNumber: incident.incidentNumber,
        title: incident.title,
        description: incident.description,
        severity: incident.severity,
        status: incident.status,
        rootCause: incident.rootCause,
        resolution: incident.resolution,
        assetCode: incident.asset.assetCode,
        assetType: incident.asset.assetType,
        stationName: incident.asset.station?.name,
        occurredAt: incident.occurredAt.toISOString(),
      },
    }]);

    this.logger.debug(`Ingested incident ${incident.incidentNumber} into memory`);
  }

  // ─── Ingest lesson into memory ────────────────────────────────────────────
  async ingestLesson(lessonId: string): Promise<void> {
    const lesson = await this.prisma.lessonLearned.findUnique({ where: { id: lessonId } });
    if (!lesson) return;

    const text = `${lesson.title}. ${lesson.content}`;
    const vector = await this.embeddings.embed(text);

    await this.qdrant.upsert(COLLECTIONS.LESSONS, [{
      id: lesson.id,
      vector,
      payload: {
        lessonId: lesson.id,
        title: lesson.title,
        content: lesson.content,
        assetType: lesson.assetType,
        tags: lesson.tags,
        createdAt: lesson.createdAt.toISOString(),
      },
    }]);
  }

  // ─── Ingest procedure into memory ────────────────────────────────────────
  async ingestProcedure(procedureId: string): Promise<void> {
    const proc = await this.prisma.procedure.findUnique({ where: { id: procedureId } });
    if (!proc) return;

    const text = `${proc.title}. ${proc.content}`;
    const vector = await this.embeddings.embed(text);

    await this.qdrant.upsert(COLLECTIONS.PROCEDURES, [{
      id: proc.id,
      vector,
      payload: {
        procedureId: proc.id,
        title: proc.title,
        content: proc.content,
        category: proc.category,
        tags: proc.tags,
      },
    }]);
  }

  // ─── Hybrid Search: vector + graph + context assembly ─────────────────────
  async search(query: string, options?: {
    limit?: number;
    assetType?: string;
    types?: string[];
  }) {
    const limit = options?.limit ?? 5;
    const queryVector = await this.embeddings.embed(query);

    // 1. Vector search across relevant collections
    const collections = options?.types?.length
      ? options.types.map((t) => t.toLowerCase())
      : [COLLECTIONS.INCIDENTS, COLLECTIONS.LESSONS, COLLECTIONS.PROCEDURES];

    const vectorResults = await this.qdrant.searchMultiCollection(
      collections,
      queryVector,
      limit,
    );

    // 2. Graph expansion — find related entities for top vector results
    const incidentIds = vectorResults
      .filter((r) => r.payload.incidentId)
      .slice(0, 3)
      .map((r) => r.payload.incidentId as string);

    let graphContext: any[] = [];
    if (incidentIds.length > 0) {
      try {
        graphContext = await this.neo4j.query(
          `MATCH (i:Incident)-[r]-(related)
           WHERE i.id IN $ids
           RETURN i, type(r) as relType, related
           LIMIT 20`,
          { ids: incidentIds },
        );
      } catch (e) {
        this.logger.debug("Graph expansion skipped: " + e.message);
      }
    }

    // 3. Enrich results with full data from PostgreSQL
    const enrichedItems = await Promise.all(
      vectorResults.slice(0, limit).map(async (r) => {
        const p = r.payload;
        if (p.incidentId) {
          const full = await this.prisma.incident.findUnique({
            where: { id: p.incidentId },
            include: { asset: { select: { assetCode: true, name: true, assetType: true } } },
          });
          return {
            id: p.incidentId,
            type: "INCIDENT" as const,
            title: p.title,
            content: full?.description ?? p.description,
            summary: `${full?.severity} incident — ${full?.rootCause ?? "Root cause under investigation"}`,
            relevanceScore: Math.round(r.score * 100),
            assetCode: p.assetCode,
            stationName: p.stationName,
            date: p.occurredAt,
            tags: [p.severity, p.assetType].filter(Boolean),
            metadata: { status: full?.status, resolution: full?.resolution },
          };
        }
        if (p.lessonId) {
          return {
            id: p.lessonId,
            type: "LESSON_LEARNED" as const,
            title: p.title,
            content: p.content,
            summary: p.content.slice(0, 120) + "...",
            relevanceScore: Math.round(r.score * 100),
            assetCode: null,
            stationName: null,
            date: p.createdAt,
            tags: p.tags ?? [],
            metadata: {},
          };
        }
        if (p.procedureId) {
          return {
            id: p.procedureId,
            type: "SOP" as const,
            title: p.title,
            content: p.content,
            summary: p.content.slice(0, 120) + "...",
            relevanceScore: Math.round(r.score * 100),
            assetCode: null,
            stationName: null,
            date: p.createdAt ?? new Date().toISOString(),
            tags: p.tags ?? [],
            metadata: {},
          };
        }
        return null;
      }),
    );

    const items = enrichedItems.filter(Boolean);

    return {
      items,
      totalCount: items.length,
      queryTime: 0,
      searchMode: "HYBRID",
      graphContextCount: graphContext.length,
    };
  }

  // ─── Build full knowledge package for agent context ──────────────────────
  async buildKnowledgePackage(query: string, assetId?: string) {
    const [searchResults, lessons, procedures] = await Promise.all([
      this.search(query, { limit: 5 }),
      this.prisma.lessonLearned.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      this.prisma.procedure.findMany({ take: 5 }),
    ]);

    const incidentItems = searchResults.items.filter((i) => i.type === "INCIDENT");

    // Fetch full incidents for package
    const incidentIds = incidentItems.map((i) => i.id);
    const incidents = incidentIds.length
      ? await this.prisma.incident.findMany({
          where: { id: { in: incidentIds } },
          include: { asset: { select: { assetCode: true, name: true } } },
        })
      : [];

    return {
      query,
      similarIncidents: incidents.map((inc) => ({
        id: inc.id,
        incidentNumber: inc.incidentNumber,
        title: inc.title,
        severity: inc.severity,
        status: inc.status,
        rootCause: inc.rootCause,
        resolution: inc.resolution,
        occurredAt: inc.occurredAt,
      })),
      relatedLessons: lessons,
      applicableProcedures: procedures,
      confidence: Math.round(
        (searchResults.items[0]?.relevanceScore ?? 50),
      ),
      totalEvidenceCount: searchResults.totalCount,
    };
  }

  async getLessons(limit = 20) {
    return this.prisma.lessonLearned.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async getProcedures(limit = 20) {
    return this.prisma.procedure.findMany({
      orderBy: { title: "asc" },
      take: limit,
    });
  }



  // ─── Ingest maintenance record into memory ────────────────────────────────
  async ingestMaintenanceRecord(recordId: string): Promise<void> {
    const record = await this.prisma.maintenanceRecord.findUnique({
      where: { id: recordId },
      include: { asset: { include: { station: true } } },
    });
    if (!record) return;

    const text = [
      `${record.maintenanceType} on ${record.asset.assetCode}`,
      record.description,
      record.findings,
      record.outcome,
    ].filter(Boolean).join(". ");

    const vector = await this.embeddings.embed(text);

    await this.qdrant.upsert(COLLECTIONS.MAINTENANCE, [{
      id: record.id,
      vector,
      payload: {
        recordId: record.id,
        assetId: record.assetId,
        assetCode: record.asset.assetCode,
        assetType: record.asset.assetType,
        stationId: record.asset.stationId,
        stationName: record.asset.station?.name,
        maintenanceType: record.maintenanceType,
        description: record.description,
        outcome: record.outcome,
        performedAt: record.performedAt.toISOString(),
      },
    }]);
  }

  // ─── Ingest recommendation into memory ────────────────────────────────────
  async ingestRecommendation(recId: string): Promise<void> {
    const rec = await this.prisma.recommendation.findUnique({
      where: { id: recId },
      include: { asset: { select: { assetCode: true, assetType: true, stationId: true } } },
    });
    if (!rec) return;

    const text = `${rec.action}. ${rec.reason}. Priority: ${rec.priority}`;
    const vector = await this.embeddings.embed(text);

    await this.qdrant.upsert(COLLECTIONS.RECOMMENDATIONS, [{
      id: rec.id,
      vector,
      payload: {
        recId: rec.id,
        action: rec.action,
        actionType: rec.actionType,
        priority: rec.priority,
        reason: rec.reason,
        status: rec.status,
        assetId: rec.assetId,
        assetCode: rec.asset?.assetCode,
        assetType: rec.asset?.assetType,
        stationId: rec.asset?.stationId,
      },
    }]);
  }

  // ─── Batch ingest all (CQ-037) ─────────────────────────────────────────────
  async ingestAll(): Promise<{ incidents: number; lessons: number; procedures: number; maintenance: number; recommendations: number }> {
    const [incidents, lessons, procedures] = await Promise.all([
      this.prisma.incident.findMany({ select: { id: true } }),
      this.prisma.lessonLearned.findMany({ select: { id: true } }),
      this.prisma.procedure.findMany({ select: { id: true } }),
    ]);

    const [maintenance, recommendations] = await Promise.all([
      this.prisma.maintenanceRecord.findMany({ select: { id: true } }),
      this.prisma.recommendation.findMany({ select: { id: true } }),
    ]);

    const batch = async <T>(items: T[], fn: (item: T) => Promise<void>, size = 10): Promise<number> => {
      let count = 0;
      for (let i = 0; i < items.length; i += size) {
        const results = await Promise.allSettled(items.slice(i, i + size).map(fn));
        count += results.filter((r) => r.status === "fulfilled").length;
      }
      return count;
    };

    const [inc, les, proc, maint, recs] = await Promise.all([
      batch(incidents, (x) => this.ingestIncident(x.id)),
      batch(lessons, (x) => this.ingestLesson(x.id)),
      batch(procedures, (x) => this.ingestProcedure(x.id)),
      batch(maintenance, (x) => this.ingestMaintenanceRecord(x.id)),
      batch(recommendations, (x) => this.ingestRecommendation(x.id)),
    ]);

    const ingested = { incidents: inc, lessons: les, procedures: proc, maintenance: maint, recommendations: recs };
    this.logger.log(`✅ Batch ingest complete: ${JSON.stringify(ingested)}`);
    return ingested;
  }

  async getStats() {
    const [incidentCount, lessonCount, procedureCount] = await Promise.all([
      this.prisma.incident.count(),
      this.prisma.lessonLearned.count(),
      this.prisma.procedure.count(),
    ]);

    // Get Qdrant collection sizes
    const collectionStats: Record<string, number> = {};
    for (const col of ["incidents", "lessons", "procedures", "recommendations", "maintenance", "manuals"]) {
      try {
        const info = await this.qdrant.getCollectionInfo(col);
        collectionStats[col] = (info as any)?.vectors_count ?? 0;
      } catch {
        collectionStats[col] = 0;
      }
    }

    return {
      postgresRecords: { incidents: incidentCount, lessons: lessonCount, procedures: procedureCount },
      vectorCollections: collectionStats,
      searchMode: "HYBRID",
    };
  }
}
