import { Injectable, NotFoundException, Inject, forwardRef } from "@nestjs/common";
import { AgentsGateway } from "../agents/agents.gateway";
import { PrismaService } from "../../database/prisma.service";
import { LearningAgent } from "../agents/agents/learning.agent";

@Injectable()
export class IncidentsService {
  constructor(
    private prisma: PrismaService,
    // TD-010 FIX: Inject LearningAgent to call onIncidentClosed() properly
    // forwardRef prevents circular dependency (AgentsModule ↔ IncidentsModule)
    @Inject(forwardRef(() => LearningAgent))
    private learningAgent: LearningAgent,
    @Inject(forwardRef(() => AgentsGateway))
    private gateway: AgentsGateway,
  ) {}

  async findAll(filters?: {
    status?: string;
    severity?: string;
    assetId?: string;
    stationId?: string;
    limit?: number;
  }) {
    return this.prisma.incident.findMany({
      where: {
        ...(filters?.status && { status: filters.status as any }),
        ...(filters?.severity && { severity: filters.severity as any }),
        ...(filters?.assetId && { assetId: filters.assetId }),
        ...(filters?.stationId && {
          asset: { stationId: filters.stationId },
        }),
      },
      include: {
        asset: {
          include: { station: { select: { id: true, name: true } } },
        },
        recommendations: {
          select: { id: true, priority: true, action: true, status: true },
          take: 3,
        },
        _count: { select: { events: true } },
      },
      orderBy: { occurredAt: "desc" },
      take: filters?.limit ?? 100,
    });
  }

  async findOne(id: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      include: {
        asset: { include: { station: true } },
        events: { orderBy: { timestamp: "asc" } },
        recommendations: { orderBy: { priority: "desc" } },
      },
    });
    if (!incident) throw new NotFoundException(`Incident ${id} not found`);
    return incident;
  }

  async create(data: {
    title: string;
    description: string;
    severity: string;
    assetId: string;
    occurredAt?: Date;
    createdById?: string;
    weatherCondition?: string;
  }) {
    const count = await this.prisma.incident.count();
    const incidentNumber = `INC-${String(count + 1).padStart(3, "0")}`;

    const incident = await this.prisma.incident.create({
      data: {
        incidentNumber,
        title: data.title,
        description: data.description,
        severity: data.severity as any,
        status: "OPEN",
        assetId: data.assetId,
        occurredAt: data.occurredAt ?? new Date(),
        createdById: data.createdById,
        weatherCondition: data.weatherCondition,
      },
      include: { asset: { include: { station: true } } },
    });

    // CQ-038 fix: emit real-time WebSocket event
    this.gateway?.emitIncidentCreated?.(incident);

    await this.addEvent(incident.id, {
      eventType: "INCIDENT_CREATED",
      description: `Incident ${incidentNumber} created with severity ${data.severity}`,
    });

    return incident;
  }

  async update(
    id: string,
    data: Partial<{
      status: string;
      rootCause: string;
      resolution: string;
      lessonsLearned: string;
      resolvedAt: Date;
    }>,
  ) {
    await this.findOne(id);
    return this.prisma.incident.update({
      where: { id },
      data: data as any,
      include: { asset: true },
    });
  }

  async close(id: string, resolution: string, rootCause?: string, lessons?: string) {
    const incident = await this.update(id, {
      status: "RESOLVED",
      resolution,
      rootCause,
      lessonsLearned: lessons,
      resolvedAt: new Date(),
    });

    await this.addEvent(id, {
      eventType: "INCIDENT_RESOLVED",
      description: `Resolved: ${resolution}`,
    });

    // TD-010 FIX: Use LearningAgent.onIncidentClosed() which does the full
    // knowledge capture pipeline: vector ingestion + lesson creation + audit log.
    // Previously this called memoryService.ingestIncident() directly, bypassing
    // lesson extraction and audit logging.
    try {
      await this.learningAgent.onIncidentClosed(id);
    } catch {
      // Non-critical — memory will be updated on next search
    }

    return incident;
  }

  async addEvent(
    incidentId: string,
    data: {
      eventType: string;
      description: string;
      agentName?: string;
      metadata?: Record<string, any>;
    },
  ) {
    return this.prisma.incidentEvent.create({
      data: {
        incidentId,
        eventType: data.eventType,
        description: data.description,
        agentName: data.agentName,
        metadata: data.metadata,
      },
    });
  }

  async getTimeline(id: string) {
    const [incident, events] = await Promise.all([
      this.findOne(id),
      this.prisma.incidentEvent.findMany({
        where: { incidentId: id },
        orderBy: { timestamp: "asc" },
      }),
    ]);
    return { incident, events };
  }

  async getSimilarIncidents(assetId: string, excludeId?: string, limit = 5) {
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) return [];

    return this.prisma.incident.findMany({
      where: {
        asset: { assetType: asset.assetType },
        status: "RESOLVED",
        ...(excludeId && { id: { not: excludeId } }),
      },
      include: {
        asset: { select: { assetCode: true, name: true } },
      },
      orderBy: { occurredAt: "desc" },
      take: limit,
    });
  }

  async getInvestigation(id: string) {
    const incident = await this.findOne(id);
    const [similar, timeline, recommendations] = await Promise.all([
      this.getSimilarIncidents(incident.assetId, id, 5),
      this.prisma.incidentEvent.findMany({
        where: { incidentId: id },
        orderBy: { timestamp: "asc" },
      }),
      this.prisma.recommendation.findMany({
        where: { incidentId: id },
        orderBy: { priority: "desc" },
      }),
    ]);

    const rootCauses = [
      ...(incident.rootCause ? [incident.rootCause] : []),
      ...similar.map((s) => (s as any).rootCause).filter(Boolean),
    ];
    const uniqueRootCauses = [...new Set(rootCauses)];

    return {
      incident,
      similarIncidents: similar,
      rootCauses: uniqueRootCauses,
      timeline,
      recommendations,
      summary: {
        totalSimilar: similar.length,
        mostCommonCause: uniqueRootCauses[0] ?? "Under investigation",
        hasResolution: !!incident.resolution,
        hasLessonsLearned: !!incident.lessonsLearned,
      },
    };
  }

  async getStats() {
    const [total, open, investigating, resolved, critical] = await Promise.all([
      this.prisma.incident.count(),
      this.prisma.incident.count({ where: { status: "OPEN" } }),
      this.prisma.incident.count({ where: { status: "INVESTIGATING" } }),
      this.prisma.incident.count({ where: { status: "RESOLVED" } }),
      this.prisma.incident.count({
        where: { severity: "CRITICAL", status: { in: ["OPEN", "INVESTIGATING"] } },
      }),
    ]);
    return { total, open, investigating, resolved, critical };
  }
}
