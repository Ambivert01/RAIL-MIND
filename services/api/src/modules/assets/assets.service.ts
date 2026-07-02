import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class AssetsService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: {
    type?: string;
    status?: string;
    stationId?: string;
  }) {
    return this.prisma.asset.findMany({
      where: {
        ...(filters?.type && { assetType: filters.type as any }),
        ...(filters?.status && { status: filters.status as any }),
        ...(filters?.stationId && { stationId: filters.stationId }),
      },
      include: {
        station: { select: { id: true, name: true, stationCode: true } },
        risks: {
          where: { isActive: true },
          orderBy: { riskScore: "desc" },
          take: 1,
        },
        _count: {
          select: {
            incidents: { where: { status: { in: ["OPEN", "INVESTIGATING"] } } },
            alerts: { where: { status: "UNREAD" } },
          },
        },
      },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    });
  }

  async findOne(id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: {
        station: true,
        risks: { where: { isActive: true }, take: 1, orderBy: { riskScore: "desc" } },
      },
    });
    if (!asset) throw new NotFoundException(`Asset ${id} not found`);
    return asset;
  }

  async findByCode(assetCode: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { assetCode },
      include: { station: true },
    });
    if (!asset) throw new NotFoundException(`Asset code ${assetCode} not found`);
    return asset;
  }

  async getProfile(id: string) {
    const asset = await this.findOne(id);

    const [
      incidentHistory,
      maintenanceHistory,
      activeRecommendations,
      riskHistory,
      activeAlerts,
    ] = await Promise.all([
      this.prisma.incident.findMany({
        where: { assetId: id },
        orderBy: { occurredAt: "desc" },
        take: 20,
        select: {
          id: true,
          incidentNumber: true,
          title: true,
          severity: true,
          status: true,
          rootCause: true,
          resolution: true,
          occurredAt: true,
          resolvedAt: true,
        },
      }),
      this.prisma.maintenanceRecord.findMany({
        where: { assetId: id },
        orderBy: { performedAt: "desc" },
        take: 10,
      }),
      this.prisma.recommendation.findMany({
        where: { assetId: id, status: { in: ["PENDING", "APPROVED", "IN_PROGRESS"] } },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        take: 5,
      }),
      this.prisma.riskRecord.findMany({
        where: { assetId: id },
        orderBy: { calculatedAt: "desc" },
        take: 10,
      }),
      this.prisma.alert.findMany({
        where: { assetId: id, status: { in: ["UNREAD", "ACKNOWLEDGED"] } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    const activeRisk = riskHistory.find((r) => r.isActive);

    return {
      asset,
      riskSummary: activeRisk
        ? {
            riskScore: activeRisk.riskScore,
            severity: activeRisk.severity,
            confidence: activeRisk.confidence,
            possibleFailure: activeRisk.possibleFailure,
            topRiskFactors: activeRisk.factors
              ? (activeRisk.factors as any[]).map((f) => f.name)
              : [],
          }
        : null,
      incidentHistory,
      maintenanceHistory,
      activeRecommendations,
      activeAlerts,
      riskHistory: riskHistory.slice(0, 5),
      stats: {
        totalIncidents: incidentHistory.length,
        resolvedIncidents: incidentHistory.filter((i) => i.status === "RESOLVED").length,
        totalMaintenanceActions: maintenanceHistory.length,
        lastMaintenanceAt: maintenanceHistory[0]?.performedAt ?? null,
        daysSinceLastMaintenance: maintenanceHistory[0]
          ? Math.floor(
              (Date.now() - new Date(maintenanceHistory[0].performedAt).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : null,
      },
    };
  }

  async updateStatus(id: string, status: string, healthScore?: number) {
    return this.prisma.asset.update({
      where: { id },
      data: {
        status: status as any,
        ...(healthScore !== undefined && { healthScore }),
        updatedAt: new Date(),
      },
    });
  }

  async getTwinAssets() {
    return this.prisma.asset.findMany({
      select: {
        id: true,
        stationId: true,
        assetType: true,
        assetCode: true,
        name: true,
        status: true,
        healthScore: true,
        latitude: true,
        longitude: true,
        risks: {
          where: { isActive: true },
          select: { riskScore: true, severity: true },
          take: 1,
        },
        _count: {
          select: {
            incidents: { where: { status: { in: ["OPEN", "INVESTIGATING"] } } },
          },
        },
      },
    });
  }
}
