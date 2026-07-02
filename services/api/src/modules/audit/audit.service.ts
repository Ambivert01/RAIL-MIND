import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async getLogs(filters?: {
    userId?: string;
    resourceType?: string;
    action?: string;
    limit?: number;
  }) {
    return this.prisma.auditLog.findMany({
      where: {
        ...(filters?.userId && { userId: filters.userId }),
        ...(filters?.resourceType && { resourceType: filters.resourceType }),
        ...(filters?.action && { action: { contains: filters.action, mode: "insensitive" as any } }),
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take: filters?.limit ?? 100,
    });
  }

  async getDecisionTrace(agentRunId: string) {
    const run = await this.prisma.agentRun.findUnique({
      where: { id: agentRunId },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    });
    if (!run) return null;

    return {
      run,
      thoughts: run.thoughts,
      input: run.input,
      output: run.output,
      durationMs: run.durationMs,
      explanation: "Complete agent reasoning trail with evidence and decision steps",
    };
  }

  async getAgentRunTrace(id: string) {
    return this.prisma.agentRun.findUnique({
      where: { id },
      include: {
        user: { select: { firstName: true, lastName: true, role: true } },
      },
    });
  }

  async createLog(data: {
    userId?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    metadata?: any;
    ipAddress?: string;
  }) {
    return this.prisma.auditLog.create({ data: data as any });
  }

  async getStats() {
    const [total, byType, recent] = await Promise.all([
      this.prisma.auditLog.count(),
      this.prisma.auditLog.groupBy({ by: ["resourceType"], _count: { id: true } }),
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { user: { select: { firstName: true, lastName: true } } },
      }),
    ]);
    return {
      total,
      byResourceType: Object.fromEntries(byType.map((t) => [t.resourceType, t._count.id])),
      recentActivity: recent,
    };
  }
}
