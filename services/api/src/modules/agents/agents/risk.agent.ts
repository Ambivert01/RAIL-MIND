import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma.service";
import { RiskService } from "../../risk/risk.service";
import { Neo4jService } from "../../../database/neo4j.service";
import { AgentThought } from "@railmind/shared-types";

@Injectable()
export class RiskAgent {
  constructor(
    private prisma: PrismaService,
    private riskService: RiskService,
    private neo4j: Neo4jService,
  ) {}

  async run(
    input: { assetId?: string; incidentCount?: number; rootCauses?: string[]; hasWeatherRisk?: boolean },
    onThought?: (t: AgentThought) => void,
  ) {
    const thoughts: AgentThought[] = [];
    const emit = (step: string, detail: string) => {
      const t: AgentThought = { agentName: "RISK", step, detail, timestamp: new Date().toISOString(), isComplete: false };
      thoughts.push(t); onThought?.(t);
    };

    emit("Initializing", "Loading risk assessment model...");

    let riskResult: any = null;
    let asset: any = null;

    if (input.assetId) {
      emit("Loading asset data", "Retrieving asset health metrics...");
      asset = await this.prisma.asset.findUnique({
        where: { id: input.assetId },
        include: { maintenanceRecords: { orderBy: { performedAt: "desc" }, take: 1 } },
      });

      emit("Calculating risk score", "Applying weighted risk formula...");
      riskResult = await this.riskService.calculateAndSaveRisk(input.assetId, input.hasWeatherRisk ?? false);
    }

    let riskScore = riskResult?.riskScore ?? this.estimateRiskScore(input);
    // Apply weather boost if formula didn't account for it
    if (input.hasWeatherRisk && riskScore < 50) riskScore = Math.min(100, riskScore + 15);

    const severity = riskScore >= 81 ? "CRITICAL" : riskScore >= 61 ? "HIGH" : riskScore >= 31 ? "MODERATE" : "LOW";

    emit("Scoring factors", `Health: ${asset?.healthScore ?? 50}%, Incidents: ${input.incidentCount ?? 0}, Weather: ${input.hasWeatherRisk ? "Yes" : "No"}`);

    // ─── Risk Propagation (RM-051: propagate through graph) ─────────────────
    let propagatedAssets: any[] = [];
    if (input.assetId) {
      emit("Risk propagation", "Traversing graph — checking downstream assets in same station...");
      try {
        // Find assets in same station and on same track (1-2 hops in graph)
        const rows = await this.neo4j.query(
          `MATCH (failed {id: $id})-[:PART_OF]->(station)
           MATCH (neighbour)-[:PART_OF]->(station)
           WHERE neighbour.id <> $id
           RETURN neighbour.id as neighbourId, neighbour.code as code,
                  neighbour.type as type, neighbour.status as status
           LIMIT 10`,
          { id: input.assetId },
        );

        if (rows.length > 0) {
          // Downstream assets get a propagated risk bump proportional to source severity
          const bump = riskScore >= 81 ? 20 : riskScore >= 61 ? 12 : 6;
          propagatedAssets = rows.map((r: any) => ({
            assetId: r.neighbourId,
            assetCode: r.code,
            assetType: r.type,
            propagatedRiskBump: bump,
            reason: `Co-located with ${asset?.assetCode ?? input.assetId} (${severity} risk)`,
          }));

          emit(
            "Propagation complete",
            `${propagatedAssets.length} connected assets affected — risk bump of +${bump} applied to each`,
          );

          // Persist propagated risk bumps asynchronously
          for (const pa of propagatedAssets) {
            this.riskService.calculateAndSaveRisk(pa.assetId).catch(() => {});
          }
        } else {
          emit("Propagation complete", "No connected assets found in graph — isolated risk");
        }
      } catch {
        emit("Propagation skipped", "Graph unavailable — local risk only");
      }
    }

    const confidence = riskResult?.confidence ?? Math.min(95, 55 + (input.incidentCount ?? 0) * 8);

    onThought?.({ agentName: "RISK", step: "Assessment complete", detail: `Score: ${riskScore}/100 — ${severity} — ${propagatedAssets.length} downstream assets notified`, timestamp: new Date().toISOString(), isComplete: true });

    return {
      riskScore,
      severity,
      confidence,
      factors: riskResult?.factors ?? [],
      propagatedAssets,
      possibleFailure: riskScore >= 61 ? "Component failure likely within 48 hours" : "Monitor recommended",
      thoughts,
    };
  }

  private estimateRiskScore(input: any): number {
    let s = 30;
    if (input.incidentCount) s += input.incidentCount * 10;
    if (input.hasWeatherRisk) s += 15;
    if (input.rootCauses?.length) s += 10;
    return Math.min(97, s);
  }
}
