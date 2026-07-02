import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma.service";
import { AgentThought } from "@railmind/shared-types";

@Injectable()
export class PlannerAgent {
  constructor(private prisma: PrismaService) {}

  async run(
    input: {
      assetId?: string;
      recommendations?: any[];
      riskScore?: number;
      assetType?: string;
    },
    onThought?: (t: AgentThought) => void,
  ) {
    const thoughts: AgentThought[] = [];
    const emit = (step: string, detail: string) => {
      const t: AgentThought = {
        agentName: "PLANNER",
        step,
        detail,
        timestamp: new Date().toISOString(),
        isComplete: false,
      };
      thoughts.push(t);
      onThought?.(t);
    };

    emit("Initializing", "Loading maintenance planning context...");

    // Load asset maintenance history
    let maintenanceHistory: any[] = [];
    if (input.assetId) {
      emit("Loading history", "Checking maintenance backlog and overdue items...");
      maintenanceHistory = await this.prisma.maintenanceRecord.findMany({
        where: { assetId: input.assetId },
        orderBy: { performedAt: "desc" },
        take: 5,
      });
    }

    // Check for overdue assets in the network
    emit("Scanning network", "Identifying overdue maintenance across the network...");
    const overdueAssets = await this.prisma.asset.findMany({
      where: { status: { in: ["WARNING", "CRITICAL"] } },
      select: { id: true, assetCode: true, status: true, healthScore: true },
      take: 10,
    });

    emit("Prioritizing", "Applying risk-based maintenance prioritization...");

    // Build maintenance plan
    const plan: any[] = [];

    if (input.riskScore && input.riskScore >= 81) {
      plan.push({
        priority: "CRITICAL",
        action: "Emergency maintenance required within 24 hours",
        timeline: "Immediate",
        estimatedDuration: "4-8 hours",
        resources: ["Senior Engineer", "Maintenance Team"],
      });
    }

    if (input.recommendations?.length) {
      for (const rec of input.recommendations.slice(0, 3)) {
        plan.push({
          priority: rec.priority ?? "HIGH",
          action: rec.action,
          timeline: rec.estimatedResolutionTime ?? "Within 72 hours",
          estimatedDuration: "2-4 hours",
          resources: ["Maintenance Engineer"],
        });
      }
    }

    // Add overdue network items
    if (overdueAssets.length > 0) {
      emit("Queue built", `${overdueAssets.length} assets flagged for maintenance scheduling`);
    }

    const done: AgentThought = {
      agentName: "PLANNER",
      step: "Plan ready",
      detail: `Maintenance plan: ${plan.length} actions scheduled across ${overdueAssets.length} queued assets`,
      timestamp: new Date().toISOString(),
      isComplete: true,
    };
    thoughts.push(done);
    onThought?.(done);

    return {
      maintenancePlan: plan,
      overdueCount: overdueAssets.length,
      overdueAssets: overdueAssets.slice(0, 5),
      lastMaintenance: maintenanceHistory[0] ?? null,
      schedulingSummary:
        plan.length > 0
          ? `${plan.length} maintenance actions planned. ${overdueAssets.length} assets in queue.`
          : "No immediate maintenance actions required.",
      thoughts,
    };
  }
}
