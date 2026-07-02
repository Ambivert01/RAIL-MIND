import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class TwinService {
  constructor(private prisma: PrismaService) {}

  async getState() {
    const [stations, assets, activeIncidents, recentAlerts] = await Promise.all([
      this.prisma.station.findMany({
        include: {
          assets: {
            select: { id: true, status: true, healthScore: true },
          },
        },
      }),
      this.prisma.asset.findMany({
        select: {
          id: true, stationId: true, assetType: true, assetCode: true,
          name: true, status: true, healthScore: true, latitude: true, longitude: true,
          risks: { where: { isActive: true }, select: { riskScore: true, severity: true }, take: 1 },
          _count: { select: { incidents: { where: { status: { in: ["OPEN", "INVESTIGATING"] } } } } },
        },
      }),
      this.prisma.incident.findMany({
        where: { status: { in: ["OPEN", "INVESTIGATING"] } },
        select: { id: true, assetId: true, severity: true, title: true, occurredAt: true,
          asset: { select: { assetCode: true } } },
        orderBy: { occurredAt: "desc" },
        take: 20,
      }),
      this.prisma.alert.findMany({
        where: { status: { in: ["UNREAD", "ACKNOWLEDGED"] } },
        include: { asset: { select: { assetCode: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    const twinStations = stations.map((s) => {
      const assetStatuses = s.assets.map((a) => a.status);
      const healthScores = s.assets.map((a) => a.healthScore);
      const avgHealth = healthScores.length
        ? Math.round(healthScores.reduce((a, b) => a + b, 0) / healthScores.length)
        : 100;
      const status =
        assetStatuses.includes("CRITICAL") ? "CRITICAL" :
        assetStatuses.includes("WARNING") ? "WARNING" : "HEALTHY";

      return {
        id: s.id, stationCode: s.stationCode, name: s.name, zone: s.zone,
        latitude: Number(s.latitude), longitude: Number(s.longitude),
        status, healthScore: avgHealth,
        activeIncidentCount: activeIncidents.filter((i) => {
          const a = assets.find((a) => a.id === i.assetId);
          return a?.stationId === s.id;
        }).length,
        criticalAssetCount: s.assets.filter((a) => a.status === "CRITICAL").length,
      };
    });

    const twinAssets = assets.map((a) => ({
      id: a.id, stationId: a.stationId, assetType: a.assetType,
      assetCode: a.assetCode, name: a.name, status: a.status, healthScore: a.healthScore,
      latitude: a.latitude ? Number(a.latitude) : null,
      longitude: a.longitude ? Number(a.longitude) : null,
      riskScore: a.risks[0]?.riskScore ?? null,
      hasActiveIncident: a._count.incidents > 0,
    }));

    return {
      stations: twinStations,
      assets: twinAssets,
      activeIncidents: activeIncidents.map((i) => ({
        id: i.id, assetId: i.assetId, assetCode: i.asset.assetCode,
        severity: i.severity, title: i.title, occurredAt: i.occurredAt,
      })),
      activeAlerts: recentAlerts.map((a) => ({
        id: a.id, assetId: a.assetId, assetCode: a.asset.assetCode,
        alertType: a.alertType, severity: a.severity, message: a.message, createdAt: a.createdAt,
      })),
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  async getLayers() {
    return {
      layers: [
        { id: "infrastructure", name: "Infrastructure", enabled: true },
        { id: "risk", name: "Risk Intelligence", enabled: true },
        { id: "incidents", name: "Active Incidents", enabled: true },
        { id: "agents", name: "Agent Activity", enabled: false },
        { id: "knowledge", name: "Knowledge Links", enabled: false },
        { id: "maintenance", name: "Maintenance", enabled: false },
        { id: "weather", name: "Weather", enabled: false },
      ],
    };
  }
}
