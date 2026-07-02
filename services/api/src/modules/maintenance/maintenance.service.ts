import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class MaintenanceService {
  constructor(private prisma: PrismaService) {}

  // ─── Maintenance Queue (risk-prioritised) ────────────────────────────────
  async getQueue() {
    const assets = await this.prisma.asset.findMany({
      where: { status: { in: ["WARNING", "CRITICAL"] } },
      include: {
        risks: { where: { isActive: true }, orderBy: { riskScore: "desc" }, take: 1 },
        maintenanceRecords: { orderBy: { performedAt: "desc" }, take: 1 },
        station: { select: { name: true } },
      },
    });

    const queue = assets.map((a) => {
      const risk = a.risks[0];
      const lastMaint = a.maintenanceRecords[0];
      const daysSince = lastMaint
        ? Math.floor((Date.now() - new Date(lastMaint.performedAt).getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      return {
        assetId: a.id,
        assetCode: a.assetCode,
        assetName: a.name,
        assetType: a.assetType,
        stationName: a.station?.name,
        status: a.status,
        healthScore: a.healthScore,
        riskScore: risk?.riskScore ?? 0,
        severity: risk?.severity ?? "LOW",
        priority:
          (risk?.riskScore ?? 0) >= 81 ? "CRITICAL" :
          (risk?.riskScore ?? 0) >= 61 ? "HIGH" :
          (risk?.riskScore ?? 0) >= 31 ? "MEDIUM" : "LOW",
        recommendedAction: risk?.recommendation ?? "Schedule inspection",
        daysSinceLastMaintenance: daysSince,
        lastMaintenanceAt: lastMaint?.performedAt ?? null,
        dueBy:
          (risk?.riskScore ?? 0) >= 81 ? "Within 24 hours" :
          (risk?.riskScore ?? 0) >= 61 ? "Within 72 hours" :
          "Within 7 days",
      };
    }).sort((a, b) => b.riskScore - a.riskScore);

    return { queue, total: queue.length };
  }

  // ─── Work Orders ──────────────────────────────────────────────────────────
  async getWorkOrders(filters?: { status?: string; assetId?: string }) {
    // Maintenance records serve as work orders
    return this.prisma.maintenanceRecord.findMany({
      where: {
        ...(filters?.assetId && { assetId: filters.assetId }),
        // API-003 fix: apply outcome/status filter
        ...(filters?.status && { outcome: filters.status as any }),
      },
      include: {
        asset: { select: { assetCode: true, name: true, assetType: true, station: { select: { name: true } } } },
        performedBy: { select: { firstName: true, lastName: true, role: true } },
      },
      orderBy: { performedAt: "desc" },
      take: 100,
    });
  }

  async createWorkOrder(data: {
    assetId: string;
    maintenanceType: string;
    description: string;
    performedById?: string;
    performedAt?: Date;
    findings?: string;
    outcome?: string;
  }) {
    return this.prisma.maintenanceRecord.create({
      data: {
        assetId: data.assetId,
        maintenanceType: data.maintenanceType as any,
        description: data.description,
        performedById: data.performedById,
        performedAt: data.performedAt ?? new Date(),
        outcome: (data.outcome as any) ?? "SUCCESSFUL",
        findings: data.findings,
      },
      include: {
        asset: { select: { assetCode: true, name: true } },
      },
    });
  }

  async getWorkOrder(id: string) {
    const record = await this.prisma.maintenanceRecord.findUnique({
      where: { id },
      include: {
        asset: { include: { station: true } },
        performedBy: { select: { firstName: true, lastName: true, role: true } },
      },
    });
    if (!record) throw new NotFoundException(`Maintenance record ${id} not found`);
    return record;
  }

  async updateWorkOrder(id: string, data: Partial<{
    outcome: string;
    findings: string;
    nextMaintenanceDue: Date;
    partsReplaced: string[];
    durationHours: number;
  }>) {
    return this.prisma.maintenanceRecord.update({
      where: { id },
      data: data as any,
    });
  }

  // ─── Asset maintenance history ────────────────────────────────────────────
  async getAssetHistory(assetId: string) {
    return this.prisma.maintenanceRecord.findMany({
      where: { assetId },
      include: {
        performedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { performedAt: "desc" },
    });
  }

  // ─── Stats ────────────────────────────────────────────────────────────────
  async getStats() {
    const [total, byType, byOutcome, overdueCount] = await Promise.all([
      this.prisma.maintenanceRecord.count(),
      this.prisma.maintenanceRecord.groupBy({ by: ["maintenanceType"], _count: { id: true } }),
      this.prisma.maintenanceRecord.groupBy({ by: ["outcome"], _count: { id: true } }),
      this.prisma.asset.count({ where: { status: { in: ["WARNING", "CRITICAL"] } } }),
    ]);

    return {
      total,
      byType: Object.fromEntries(byType.map((t) => [t.maintenanceType, t._count.id])),
      byOutcome: Object.fromEntries(byOutcome.map((o) => [o.outcome, o._count.id])),
      assetsNeedingMaintenance: overdueCount,
    };
  }
}
