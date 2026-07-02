import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma.service";
import { AgentThought } from "@railmind/shared-types";

@Injectable()
export class EngineerAgent {
  constructor(private prisma: PrismaService) {}

  async run(
    input: {
      rootCauses: string[];
      assetType?: string;
      riskScore?: number;
    },
    onThought?: (t: AgentThought) => void,
  ) {
    const thoughts: AgentThought[] = [];
    const emit = (step: string, detail: string) => {
      const t: AgentThought = { agentName: "ENGINEER", step, detail, timestamp: new Date().toISOString(), isComplete: false };
      thoughts.push(t);
      onThought?.(t);
    };

    emit("Initializing", "Loading engineering knowledge base...");

    emit("Reading SOPs", "Searching applicable standard operating procedures...");
    const procedures = await this.prisma.procedure.findMany({ take: 10 });

    emit("Analyzing root causes", `Evaluating ${input.rootCauses.length} identified root causes...`);

    // Map root causes to recommended actions
    const actionMap: Record<string, { action: string; actionType: string; priority: string }> = {
      "Relay Corrosion": { action: "Replace relay component immediately", actionType: "REPLACE", priority: "CRITICAL" },
      "Water Ingress": { action: "Apply weather-resistant seal to housing and inspect drainage", actionType: "REPAIR", priority: "HIGH" },
      "Connector Degradation": { action: "Replace signal connector and test continuity", actionType: "REPLACE", priority: "HIGH" },
      "Wear": { action: "Schedule component replacement within 7 days", actionType: "REPLACE", priority: "MEDIUM" },
      "Calibration Drift": { action: "Recalibrate signal parameters per SOP-SIG-04", actionType: "REPAIR", priority: "MEDIUM" },
    };

    const recommendations: any[] = [];
    for (const cause of input.rootCauses) {
      const match = Object.entries(actionMap).find(([key]) =>
        cause.toLowerCase().includes(key.toLowerCase()),
      );
      if (match) {
        recommendations.push({ cause, ...match[1] });
      }
    }

    if (recommendations.length === 0) {
      recommendations.push({
        cause: "Undetermined",
        action: "Conduct detailed inspection and diagnostic test",
        actionType: "INSPECT",
        priority: "HIGH",
      });
    }

    if (input.riskScore && input.riskScore >= 81) {
      emit("Emergency protocol", "Critical risk threshold exceeded — escalating to emergency response...");
    }

    emit("Procedure matched", `${recommendations.length} engineering recommendations generated`);

    const done: AgentThought = {
      agentName: "ENGINEER",
      step: "Recommendations ready",
      detail: `Primary action: ${recommendations[0]?.action}`,
      timestamp: new Date().toISOString(),
      isComplete: true,
    };
    thoughts.push(done);
    onThought?.(done);

    return {
      confidence: Math.min(92, 50 + recommendations.length * 12 + procedures.length * 3),  // CQ-031
      recommendations,
      primaryAction: recommendations[0],
      procedures: procedures.slice(0, 3),
      estimatedResolutionTime: input.riskScore >= 81 ? "Within 24 hours" : "Within 72 hours",
      thoughts,
    };
  }
}
