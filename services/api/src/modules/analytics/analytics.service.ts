import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getDashboard() {
    const [assetStats, incidentStats, lessonCount, recStats, agentRuns] = await Promise.all([
      this.prisma.asset.groupBy({ by: ["status"], _count: { id: true } }),
      this.prisma.incident.groupBy({ by: ["status"], _count: { id: true } }),
      this.prisma.lessonLearned.count(),
      this.prisma.recommendation.groupBy({ by: ["status"], _count: { id: true } }),
      this.prisma.agentRun.count({ where: { status: "COMPLETED" } }),
    ]);

    const totalAssets = assetStats.reduce((s, a) => s + a._count.id, 0);
    const healthyAssets = assetStats.find((a) => a.status === "HEALTHY")?._count.id ?? 0;
    const warningAssets = assetStats.find((a) => a.status === "WARNING")?._count.id ?? 0;
    const criticalAssets = assetStats.find((a) => a.status === "CRITICAL")?._count.id ?? 0;

    const totalIncidents = incidentStats.reduce((s, i) => s + i._count.id, 0);
    const openIncidents = incidentStats.find((i) => i.status === "OPEN")?._count.id ?? 0;
    const resolvedIncidents = incidentStats.find((i) => i.status === "RESOLVED")?._count.id ?? 0;

    const networkHealth = totalAssets
      ? Math.round((healthyAssets / totalAssets) * 100)
      : 100;

    // ─── Real knowledge growth from DB (last 7 days) ──────────────────────────
    const knowledgeGrowth = await this.getRealKnowledgeGrowth();

    return {
      networkHealth,
      totalAssets,
      healthyAssets,
      warningAssets,
      criticalAssets,
      totalIncidents,
      openIncidents,
      resolvedIncidents,
      lessonsLearned: lessonCount,
      completedRecommendations: recStats.find((r) => r.status === "COMPLETED")?._count.id ?? 0,
      agentInvestigations: agentRuns,
      knowledgeGrowth,
    };
  }

  // ─── Real knowledge growth from incident/lesson/agentrun tables ─────────────
  private async getRealKnowledgeGrowth() {
    const days = 7;
    const result = [];

    for (let i = days - 1; i >= 0; i--) {
      const start = new Date();
      start.setDate(start.getDate() - i);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);

      const [incidents, lessons, agentRuns] = await Promise.all([
        this.prisma.incident.count({ where: { createdAt: { gte: start, lte: end } } }),
        this.prisma.lessonLearned.count({ where: { createdAt: { gte: start, lte: end } } }),
        this.prisma.agentRun.count({ where: { startedAt: { gte: start, lte: end }, status: "COMPLETED" } }),
      ]);

      result.push({
        date: start.toISOString().slice(0, 10),
        incidents,
        lessons,
        relationships: agentRuns * 3, // approximate: each investigation creates ~3 graph relationships
      });
    }

    return result;
  }

  // ─── Incident analytics ───────────────────────────────────────────────────
  async getIncidentAnalytics() {
    const [bySeverity, byStatus, byAssetType, recent, trend] = await Promise.all([
      this.prisma.incident.groupBy({ by: ["severity"], _count: { id: true } }),
      this.prisma.incident.groupBy({ by: ["status"], _count: { id: true } }),
      this.prisma.incident.findMany({
        select: { asset: { select: { assetType: true } } },
      }),
      this.prisma.incident.findMany({
        where: { status: { in: ["OPEN", "INVESTIGATING"] } },
        include: { asset: { select: { assetCode: true, assetType: true, station: { select: { name: true } } } } },
        orderBy: { occurredAt: "desc" },
        take: 10,
      }),
      this.getIncidentTrend(),
    ]);

    const byType: Record<string, number> = {};
    byAssetType.forEach((i) => {
      const t = (i.asset as any)?.assetType ?? "UNKNOWN";
      byType[t] = (byType[t] ?? 0) + 1;
    });

    return {
      bySeverity: Object.fromEntries(bySeverity.map((s) => [s.severity, s._count.id])),
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count.id])),
      byAssetType: byType,
      recentOpen: recent,
      trend,
      totalOpen: bySeverity.reduce((s, i) => s + i._count.id, 0),
    };
  }

  private async getIncidentTrend() {
    // API-008 fix: single query instead of 30 serial queries
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const incidents = await this.prisma.incident.findMany({
      where: { occurredAt: { gte: since } },
      select: { occurredAt: true },
    });
    // Group by date in memory
    const counts: Record<string, number> = {};
    incidents.forEach((i) => {
      const day = i.occurredAt.toISOString().slice(0, 10);
      counts[day] = (counts[day] ?? 0) + 1;
    });
    const trend = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const date = d.toISOString().slice(0, 10);
      trend.push({ date, count: counts[date] ?? 0 });
    }
    return trend;
  }

  // ─── Risk analytics ───────────────────────────────────────────────────────
  async getRiskAnalytics() {
    const [distribution, topRisks, riskTrend] = await Promise.all([
      this.prisma.riskRecord.groupBy({ by: ["severity"], where: { isActive: true }, _count: { id: true }, _avg: { riskScore: true } }),
      this.prisma.riskRecord.findMany({
        where: { isActive: true },
        include: { asset: { select: { assetCode: true, assetType: true, station: { select: { name: true } } } } },
        orderBy: { riskScore: "desc" },
        take: 10,
      }),
      this.getRiskTrend(),
    ]);

    const networkRiskScore = topRisks.length
      ? Math.round(topRisks.reduce((s, r) => s + r.riskScore, 0) / topRisks.length)
      : 0;

    return {
      distribution: Object.fromEntries(distribution.map((d) => [d.severity, { count: d._count.id, avgScore: Math.round(d._avg.riskScore ?? 0) }])),
      topRisks,
      networkRiskScore,
      riskTrend,
    };
  }

  private async getRiskTrend() {
    const since = new Date(); since.setDate(since.getDate() - 7);
    const all = await this.prisma.riskRecord.findMany({
      where: { calculatedAt: { gte: since } },
      select: { riskScore: true, severity: true, calculatedAt: true },
    });
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      const day = d.toISOString().slice(0, 10);
      const recs = all.filter((r) => r.calculatedAt.toISOString().slice(0, 10) === day);
      return { date: day, avgScore: recs.length ? Math.round(recs.reduce((s, r) => s + r.riskScore, 0) / recs.length) : 0, criticalCount: recs.filter((r) => r.severity === "CRITICAL").length };
    });
  }

  // ─── Knowledge analytics ──────────────────────────────────────────────────
  async getKnowledgeAnalytics() {
    const [lessons, procedures, agentRuns, topLessons] = await Promise.all([
      this.prisma.lessonLearned.count(),
      this.prisma.procedure.count(),
      this.prisma.agentRun.count({ where: { status: "COMPLETED" } }),
      this.prisma.lessonLearned.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    ]);

    return {
      totalLessons: lessons,
      totalProcedures: procedures,
      totalInvestigations: agentRuns,
      recentLessons: topLessons,
      knowledgeGrowth: await this.getRealKnowledgeGrowth(),
    };
  }
}
