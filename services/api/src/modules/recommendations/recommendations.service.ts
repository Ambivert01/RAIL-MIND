import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class RecommendationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: { status?: string; priority?: string; assetId?: string; limit?: number; skip?: number }) {
    return this.prisma.recommendation.findMany({
      where: {
        ...(filters?.status && { status: filters.status as any }),
        ...(filters?.priority && { priority: filters.priority as any }),
        ...(filters?.assetId && { assetId: filters.assetId }),
      },
      include: {
        asset: { select: { assetCode: true, name: true, assetType: true } },
        incident: { select: { incidentNumber: true, title: true } },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: filters?.limit ?? 100,
      skip: filters?.skip ?? 0,
    });
  }

  async findOne(id: string) {
    const rec = await this.prisma.recommendation.findUnique({
      where: { id },
      include: {
        asset: true,
        incident: true,
        approvedBy: { select: { firstName: true, lastName: true } },
      },
    });
    if (!rec) throw new NotFoundException(`Recommendation ${id} not found`);
    return rec;
  }

  async create(data: {
    incidentId?: string;
    assetId?: string;
    priority: string;
    confidence: number;
    action: string;
    actionType: string;
    reason: string;
    evidence?: any[];
    expectedOutcome?: string;
    estimatedResolutionTime?: string;
  }) {
    return this.prisma.recommendation.create({
      data: {
        ...(data.incidentId && { incidentId: data.incidentId }),
        ...(data.assetId && { assetId: data.assetId }),
        priority: data.priority as any,
        confidence: data.confidence,
        action: data.action,
        actionType: data.actionType as any,
        reason: data.reason,
        evidence: data.evidence ?? [],
        expectedOutcome: data.expectedOutcome,
        estimatedResolutionTime: data.estimatedResolutionTime,
        status: "PENDING",
      },
    });
  }

  async update(id: string, data: { action?: string; priority?: string; reason?: string }) {
    await this.findOne(id);
    return this.prisma.recommendation.update({
      where: { id },
      data: { action: data.action, priority: data.priority as any, reason: data.reason } as any,
    });
  }

  async approve(id: string, userId: string) {
    return this.prisma.recommendation.update({
      where: { id },
      data: { status: "APPROVED", approvedById: userId },
    });
  }

  async reject(id: string, note?: string) {
    return this.prisma.recommendation.update({
      where: { id },
      data: { status: "REJECTED", outcomeNote: note },
    });
  }

  async complete(id: string, outcomeNote?: string) {
    return this.prisma.recommendation.update({
      where: { id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        outcomeNote,
      },
    });
  }

  // ─── Confidence Calculation (RM-047) — used by external callers ─────────────
  calculateConfidence(input: {
    evidenceCount: number;
    similarityScore: number;
    historicalSuccessRate?: number;
    agentAgreement?: number;
  }): number {
    const base = 40;
    const evidenceBonus = Math.min(20, input.evidenceCount * 5);
    const similarityBonus = Math.round(input.similarityScore * 20);
    const historyBonus = input.historicalSuccessRate ? Math.round(input.historicalSuccessRate * 0.1) : 5;
    const agentBonus = input.agentAgreement ? Math.round(input.agentAgreement * 0.1) : 5;
    return Math.min(97, base + evidenceBonus + similarityBonus + historyBonus + agentBonus);
  }

  // ─── Evidence Packaging (RM-048) — used by external callers ─────────────────
  buildEvidencePackage(incidents: any[], lessons: any[], maintenanceRecords: any[]) {
    return [
      ...incidents.map((inc) => ({
        type: "INCIDENT",
        referenceId: inc.id,
        title: inc.incidentNumber ?? inc.title,
        date: inc.occurredAt,
        relevanceScore: 90,
        summary: `${inc.severity} — ${inc.rootCause ?? "Root cause documented"}`,
      })),
      ...lessons.map((l) => ({
        type: "LESSON",
        referenceId: l.id,
        title: l.title,
        date: l.createdAt,
        relevanceScore: 75,
        summary: l.content.slice(0, 100),
      })),
      ...maintenanceRecords.map((m) => ({
        type: "MAINTENANCE",
        referenceId: m.id,
        title: `${m.maintenanceType} on ${m.performedAt?.toISOString().slice(0, 10)}`,
        date: m.performedAt,
        relevanceScore: 65,
        summary: m.outcome,
      })),
    ];
  }

  async getStats() {
    const [pending, approved, completed, critical] = await Promise.all([
      this.prisma.recommendation.count({ where: { status: "PENDING" } }),
      this.prisma.recommendation.count({ where: { status: "APPROVED" } }),
      this.prisma.recommendation.count({ where: { status: "COMPLETED" } }),
      this.prisma.recommendation.count({ where: { priority: "CRITICAL", status: { in: ["PENDING", "APPROVED"] } } }),
    ]);
    return { pending, approved, completed, critical };
  }
}
