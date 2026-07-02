import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma.service";
import { MemoryService } from "../../memory/memory.service";
import { AgentThought } from "@railmind/shared-types";

export interface IncidentAgentInput {
  query: string;
  assetId?: string;
  assetCode?: string;
  assetType?: string;
}

export interface IncidentAgentOutput {
  similarIncidents: any[];
  rootCauses: string[];
  patterns: string[];
  confidence: number;
  thoughts: AgentThought[];
  evidence: string[];
}

@Injectable()
export class IncidentAgent {
  private readonly logger = new Logger(IncidentAgent.name);

  constructor(
    private prisma: PrismaService,
    private memoryService: MemoryService,
  ) {}

  async run(input: IncidentAgentInput, onThought?: (t: AgentThought) => void): Promise<IncidentAgentOutput> {
    const thoughts: AgentThought[] = [];
    const emit = (step: string, detail: string) => {
      const t: AgentThought = {
        agentName: "INCIDENT",
        step,
        detail,
        timestamp: new Date().toISOString(),
        isComplete: false,
      };
      thoughts.push(t);
      onThought?.(t);
    };

    emit("Initializing", `Investigating: "${input.query}"`);

    // Step 1: Search semantic memory
    emit("Searching memory", "Scanning historical incident database...");
    const memResults = await this.memoryService.search(input.query, { limit: 8 });
    const incidentResults = memResults.items.filter((i) => i.type === "INCIDENT");

    emit("Memory scanned", `Found ${incidentResults.length} semantically similar incidents`);

    // Step 2: Direct asset incidents if assetId provided
    let directIncidents: any[] = [];
    if (input.assetId) {
      emit("Checking asset history", `Loading incident history for asset ${input.assetCode ?? input.assetId}...`);
      directIncidents = await this.prisma.incident.findMany({
        where: { assetId: input.assetId }, // CQ-030 fix: include OPEN/INVESTIGATING not just RESOLVED
        orderBy: { occurredAt: "desc" },
        take: 10,
        include: { asset: { select: { assetCode: true, name: true } } },
      });
      emit("Asset history loaded", `${directIncidents.length} resolved incidents for this asset`);
    }

    // Step 3: Extract root causes
    emit("Analyzing patterns", "Identifying recurring root causes...");
    const allIncidents: any[] = [
      ...directIncidents,
      ...incidentResults.map((i) => ({ ...i, rootCause: (i.metadata as any)?.rootCause })),
    ];

    const causeCounts: Record<string, number> = {};
    for (const inc of allIncidents) {
      const cause = (inc as any).rootCause;
      if (cause) {
        causeCounts[cause] = (causeCounts[cause] ?? 0) + 1;
      }
    }

    const rootCauses = Object.entries(causeCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([cause]) => cause)
      .slice(0, 5);

    // Step 4: Pattern analysis
    const patterns: string[] = [];
    if (directIncidents.length >= 2) {
      patterns.push(`Recurring failures detected on this asset (${directIncidents.length} incidents)`);
    }

    const weatherRelated = directIncidents.filter(
      (i) => i.weatherCondition || i.description?.toLowerCase().includes("rain"),
    );
    if (weatherRelated.length > 0) {
      patterns.push(`Weather correlation identified (${weatherRelated.length} incidents during adverse weather)`);
    }

    const confidence = Math.min(95, 50 + incidentResults.length * 8 + directIncidents.length * 5);

    emit("Analysis complete", `Identified ${rootCauses.length} root causes, ${patterns.length} patterns`);

    const done: AgentThought = {
      agentName: "INCIDENT",
      step: "Done",
      detail: `Investigation complete with ${confidence}% confidence`,
      timestamp: new Date().toISOString(),
      isComplete: true,
    };
    thoughts.push(done);
    onThought?.(done);

    return {
      similarIncidents: directIncidents.slice(0, 5),
      rootCauses,
      patterns,
      confidence,
      thoughts,
      evidence: directIncidents.map((i) => i.incidentNumber ?? i.id),
    };
  }
}
