import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

interface RiskFactorInput {
  assetHealthScore: number;
  daysSinceLastMaintenance: number;
  openIncidentCount: number;
  criticalIncidentHistory: number;
  hasWeatherRisk: boolean;
}

@Injectable()
export class RiskService {
  private readonly logger = new Logger(RiskService.name);

  constructor(private prisma: PrismaService) {}

  // ─── Core Risk Formula (RM-051) ────────────────────────────────────────────
  // Weights: Asset Health 30%, Maintenance 20%, Incident History 20%,
  //          Env Risk 15%, Operational Factors 15%
  calculateRiskScore(input: RiskFactorInput): {
    score: number;
    severity: string;
    factors: any[];
  } {
    const healthScore = Math.max(0, 100 - input.assetHealthScore);  // invert: low health = high risk
    const maintenanceScore = Math.min(100, (input.daysSinceLastMaintenance / 180) * 100);
    const incidentScore = Math.min(100, input.openIncidentCount * 20 + input.criticalIncidentHistory * 15);
    const envScore = input.hasWeatherRisk ? 75 : 10;
    const operationalScore = Math.min(100, input.openIncidentCount * 25);

    const weighted =
      healthScore * 0.30 +
      maintenanceScore * 0.20 +
      incidentScore * 0.20 +
      envScore * 0.15 +
      operationalScore * 0.15;

    const score = Math.round(Math.min(100, Math.max(0, weighted)));

    const severity =
      score >= 81 ? "CRITICAL" :
      score >= 61 ? "HIGH" :
      score >= 31 ? "MODERATE" : "LOW";

    return {
      score,
      severity,
      factors: [
        { name: "Asset Health", weight: 30, value: Math.round(healthScore), description: `Health score: ${input.assetHealthScore}%` },
        { name: "Maintenance Status", weight: 20, value: Math.round(maintenanceScore), description: `${input.daysSinceLastMaintenance} days since last maintenance` },
        { name: "Incident History", weight: 20, value: Math.round(incidentScore), description: `${input.openIncidentCount} open, ${input.criticalIncidentHistory} critical incidents` },
        { name: "Environmental Risk", weight: 15, value: Math.round(envScore), description: input.hasWeatherRisk ? "Active weather risk" : "Normal conditions" },
        { name: "Operational Factors", weight: 15, value: Math.round(operationalScore), description: `${input.openIncidentCount} active issues` },
      ],
    };
  }

  async calculateAndSaveRisk(assetId: string, hasWeatherRisk = false): Promise<any> {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      include: {
        maintenanceRecords: { orderBy: { performedAt: "desc" }, take: 1 },
        incidents: {
          where: { status: { in: ["OPEN", "INVESTIGATING"] } },
          select: { id: true, severity: true },
        },
      },
    });
    if (!asset) return null;

    const lastMaint = asset.maintenanceRecords[0];
    const daysSinceMaint = lastMaint
      ? Math.floor((Date.now() - new Date(lastMaint.performedAt).getTime()) / (1000 * 60 * 60 * 24))
      : 365;

    const criticalCount = asset.incidents.filter((i) => i.severity === "CRITICAL").length;

    const { score, severity, factors } = this.calculateRiskScore({
      assetHealthScore: asset.healthScore,
      daysSinceLastMaintenance: daysSinceMaint,
      openIncidentCount: asset.incidents.length,
      criticalIncidentHistory: criticalCount,
      hasWeatherRisk,  // passed from caller — was hardcoded false (TD-004)
    });

    // Deactivate old risk records
    await this.prisma.riskRecord.updateMany({
      where: { assetId, isActive: true },
      data: { isActive: false },
    });

    // Create new record
    const risk = await this.prisma.riskRecord.create({
      data: {
        assetId,
        riskScore: score,
        severity: severity as any,
        confidence: Math.min(95, 60 + asset.incidents.length * 5 + (lastMaint ? 10 : 0)),
        possibleFailure: score >= 61 ? "Component degradation likely" : "Minor wear expected",
        recommendation: score >= 81 ? "Schedule emergency inspection within 24 hours" :
          score >= 61 ? "Schedule preventive maintenance within 7 days" :
          score >= 31 ? "Monitor and inspect at next scheduled interval" :
          "Continue normal monitoring",
        rootCauseSummary: `Based on ${asset.incidents.length} incidents and ${daysSinceMaint} days since maintenance`,
        factors: factors as any,
        isActive: true,
      },
    });

    // Update asset status based on risk
    const newStatus =
      score >= 81 ? "CRITICAL" :
      score >= 61 ? "WARNING" : "HEALTHY";

    await this.prisma.asset.update({
      where: { id: assetId },
      data: { status: newStatus as any, healthScore: Math.max(0, 100 - score) },
    });

    return risk;
  }

  async getDashboard() {
    const [allRisks, networkStats] = await Promise.all([
      this.prisma.riskRecord.findMany({
        where: { isActive: true },
        include: {
          asset: {
            include: { station: { select: { name: true } } },
          },
        },
        orderBy: { riskScore: "desc" },
        take: 50,
      }),
      this.prisma.asset.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
    ]);

    const critical = allRisks.filter((r) => r.severity === "CRITICAL");
    const high = allRisks.filter((r) => r.severity === "HIGH");
    const avgScore = allRisks.length
      ? Math.round(allRisks.reduce((s, r) => s + r.riskScore, 0) / allRisks.length)
      : 0;

    return {
      networkRiskScore: avgScore,
      criticalAssets: critical.slice(0, 10),
      highRiskAssets: high.slice(0, 10),
      riskDistribution: {
        CRITICAL: allRisks.filter((r) => r.severity === "CRITICAL").length,
        HIGH: allRisks.filter((r) => r.severity === "HIGH").length,
        MODERATE: allRisks.filter((r) => r.severity === "MODERATE").length,
        LOW: allRisks.filter((r) => r.severity === "LOW").length,
      },
      networkStats,
      topRisks: allRisks.slice(0, 10),
    };
  }

    async getHeatmap() {
    // WF4-03 fix: return ALL assets with their latest risk score
    // Assets without risk records default to score 0 (green)
    const [allAssets, riskRecords] = await Promise.all([
      this.prisma.asset.findMany({
        select: {
          id: true, assetCode: true, latitude: true, longitude: true,
          station: { select: { name: true } },
        },
        orderBy: { assetCode: "asc" },
      }),
      this.prisma.riskRecord.findMany({
        where: { isActive: true },
        select: { assetId: true, riskScore: true, severity: true },
      }),
    ]);

    const riskMap = new Map(riskRecords.map((r) => [r.assetId, r]));

    return allAssets.map((a) => {
      const risk = riskMap.get(a.id);
      const score = risk?.riskScore ?? 0;
      return {
        assetId: a.id,
        assetCode: a.assetCode,
        stationName: a.station?.name,
        riskScore: score,
        severity: risk?.severity ?? (score >= 81 ? "CRITICAL" : score >= 61 ? "HIGH" : score >= 31 ? "MODERATE" : "LOW"),
        latitude: a.latitude,
        longitude: a.longitude,
      };
    });
  }

  
  async getAssetRisk(assetId: string) {
    const risk = await this.prisma.riskRecord.findFirst({
      where: { assetId, isActive: true },
      orderBy: { calculatedAt: "desc" },
    });
    if (!risk) return this.calculateAndSaveRisk(assetId);
    return risk;
  }

  async recalculateAll() {
    const assets = await this.prisma.asset.findMany({ select: { id: true } });
    let updated = 0;
    // CQ-035 fix: batch parallel execution (10 at a time) instead of serial
    const BATCH = 10;
    for (let i = 0; i < assets.length; i += BATCH) {
      const results = await Promise.allSettled(
        assets.slice(i, i + BATCH).map((a) => this.calculateAndSaveRisk(a.id))
      );
      updated += results.filter((r) => r.status === "fulfilled").length;
      results.filter((r) => r.status === "rejected").forEach((r: any, j) => {
        this.logger.warn(`Risk calc failed for ${assets[i + j]?.id}: ${r.reason?.message}`);
      });
    }
    this.logger.log(`Risk recalculated for ${updated}/${assets.length} assets`);
    return { updated };
  }

  // ─── 7-day risk trend ──────────────────────────────────────────────────────
  async getTrends() {
    // Fix 15: single query + in-memory grouping instead of 7 serial queries
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const allRecords = await this.prisma.riskRecord.findMany({
      where: { calculatedAt: { gte: since } },
      select: { riskScore: true, severity: true, calculatedAt: true },
    });

    const trend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().slice(0, 10);
      const records = allRecords.filter((r) => r.calculatedAt.toISOString().slice(0, 10) === dayStr);
      const avgScore = records.length ? Math.round(records.reduce((s, r) => s + r.riskScore, 0) / records.length) : 0;
      trend.push({
        date: dayStr,
        avgScore,
        criticalCount: records.filter((r) => r.severity === "CRITICAL").length,
        highCount: records.filter((r) => r.severity === "HIGH").length,
        totalAssessed: records.length,
      });
    }
    return { trend, period: "7d" };
  }

  // ─── 30-day forecast for critical/high assets ─────────────────────────────
  async getForecast() {
    const criticalAssets = await this.prisma.riskRecord.findMany({
      where: { isActive: true, severity: { in: ["CRITICAL", "HIGH"] } },
      include: { asset: { select: { assetCode: true, name: true, healthScore: true } } },
      orderBy: { riskScore: "desc" },
      take: 10,
    });

    const forecasts = criticalAssets.map((r) => {
      // Simple linear extrapolation: assets not maintained trend worse
      const deteriorationRate = r.riskScore >= 81 ? 2 : 1; // points per week
      return {
        assetId: r.assetId,
        assetCode: r.asset.assetCode,
        assetName: r.asset.name,
        currentScore: r.riskScore,
        currentSeverity: r.severity,
        forecast7d: Math.min(100, r.riskScore + deteriorationRate),
        forecast14d: Math.min(100, r.riskScore + deteriorationRate * 2),
        forecast30d: Math.min(100, r.riskScore + deteriorationRate * 4),
        estimatedFailureWindow:
          r.riskScore >= 81 ? "24-48 hours" :
          r.riskScore >= 71 ? "7 days" :
          r.riskScore >= 61 ? "14-30 days" : "30+ days",
        recommendation: r.recommendation ?? "Schedule inspection",
      };
    });

    return { forecasts, generatedAt: new Date().toISOString() };
  }
}
