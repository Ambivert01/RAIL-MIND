import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class StationsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.station.findMany({
      include: {
        assets: {
          select: {
            id: true,
            assetCode: true,
            assetType: true,
            status: true,
            healthScore: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  async findOne(id: string) {
    const station = await this.prisma.station.findUnique({
      where: { id },
      include: { assets: true },
    });
    if (!station) throw new NotFoundException(`Station ${id} not found`);
    return station;
  }

  async getDashboard(id: string) {
    const station = await this.findOne(id);

    const [incidentCount, openIncidents, recentMaintenance, riskRecords] =
      await Promise.all([
        this.prisma.incident.count({
          where: { asset: { stationId: id } },
        }),
        this.prisma.incident.findMany({
          where: { asset: { stationId: id }, status: { in: ["OPEN", "INVESTIGATING"] } },
          include: { asset: { select: { assetCode: true, name: true } } },
          orderBy: { occurredAt: "desc" },
          take: 5,
        }),
        this.prisma.maintenanceRecord.findMany({
          where: { asset: { stationId: id } },
          orderBy: { performedAt: "desc" },
          take: 5,
        }),
        this.prisma.riskRecord.findMany({
          where: { asset: { stationId: id }, isActive: true },
          orderBy: { riskScore: "desc" },
          take: 5,
        }),
      ]);

    const healthScores = station.assets.map((a) => a.healthScore);
    const avgHealth =
      healthScores.length > 0
        ? Math.round(healthScores.reduce((a, b) => a + b, 0) / healthScores.length)
        : 100;

    return {
      station,
      metrics: {
        totalAssets: station.assets.length,
        healthyAssets: station.assets.filter((a) => a.status === "HEALTHY").length,
        warningAssets: station.assets.filter((a) => a.status === "WARNING").length,
        criticalAssets: station.assets.filter((a) => a.status === "CRITICAL").length,
        avgHealthScore: avgHealth,
        totalIncidents: incidentCount,
        openIncidents: openIncidents.length,
      },
      openIncidents,
      recentMaintenance,
      topRisks: riskRecords,
    };
  }
}
