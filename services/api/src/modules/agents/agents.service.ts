import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { ExecutiveAgent } from "./agents/executive.agent";
import { AgentsGateway } from "./agents.gateway";
import { RedisService } from "../../database/redis.service";
import { AskRailMindRequest } from "@railmind/shared-types";

// TD-007 FIX: Redis caching for agent results (60s TTL)
// Prevents identical questions from burning LLM tokens on repeated calls
const CACHE_TTL_SECONDS = 60;

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    private prisma: PrismaService,
    private executiveAgent: ExecutiveAgent,
    private gateway: AgentsGateway,
    private redis: RedisService,
  ) {}

  // ─── Ask RailMind (RM-045) ────────────────────────────────────────────────
  async ask(request: AskRailMindRequest) {
    this.logger.log(`Ask RailMind: "${request.question}"`);

    // Cache key: hash of question + assetId
    const cacheKey = `railmind:ask:${this.cacheKey(request)}`;

    // Try cache first — skip for streaming (WebSocket clients get fresh thoughts)
    try {
      const cached = await this.redis.get<any>(cacheKey);
      if (cached && typeof cached === "object") {
        this.logger.log(`Cache hit for: "${request.question}"`);
        // redis.get() already returns JSON.parse(val) — use directly
        this.gateway.emitWorkflowStarted(request.question);
        this.gateway.emitWorkflowCompleted(cached);
        return cached;
      }
    } catch {
      // Redis miss or unavailable — proceed normally
    }

    // Broadcast workflow start to all connected clients
    this.gateway.emitWorkflowStarted(request.question);

    try {
      const response = await this.executiveAgent.run(request, (thought) => {
        this.gateway.emitAgentThought(thought);
      });

      this.gateway.emitWorkflowCompleted(response);

      // Cache the result
      try {
        await this.redis.set(cacheKey, JSON.stringify(response), CACHE_TTL_SECONDS);
      } catch {
        // Non-critical — cache write failure doesn't break anything
      }

      return response;
    } catch (error) {
      this.logger.error("Agent workflow failed:", error);
      this.gateway.emitAgentCompleted("EXECUTIVE", { error: error.message });
      throw error;
    }
  }

  async getAgentStatus() {
    const agents = [
      { name: "EXECUTIVE", displayName: "Executive Agent", description: "Chief orchestrator — coordinates all specialist agents", status: "IDLE" },
      { name: "INCIDENT", displayName: "Incident Investigator", description: "Searches historical incidents and identifies patterns", status: "IDLE" },
      { name: "KNOWLEDGE", displayName: "Knowledge Agent", description: "Retrieves organizational memory and lessons learned", status: "IDLE" },
      { name: "RISK", displayName: "Risk Analyst", description: "Calculates operational risk scores and propagation", status: "IDLE" },
      { name: "ENGINEER", displayName: "Railway Engineer", description: "Reads SOPs and generates technical recommendations", status: "IDLE" },
      { name: "PLANNER", displayName: "Maintenance Planner", description: "Converts recommendations into maintenance schedules", status: "IDLE" },
      { name: "LEARNING", displayName: "Learning Agent", description: "Captures resolved incidents into organisational memory", status: "IDLE" },
    ];

    const recentRuns = await this.prisma.agentRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 10,
      select: {
        id: true,
        agentName: true,
        taskType: true,
        status: true,
        startedAt: true,
        completedAt: true,
        durationMs: true,
      },
    });

    return { agents, recentRuns };
  }

  async getAgentHistory(limit = 20) {
    return this.prisma.agentRun.findMany({
      orderBy: { startedAt: "desc" },
      take: limit,
    });
  }

  async getAgentRun(id: string) {
    return this.prisma.agentRun.findUnique({ where: { id } });
  }

  private cacheKey(req: AskRailMindRequest): string {
    return Buffer.from(
      `${req.question.toLowerCase().trim()}|${req.assetId ?? ""}`,
    )
      .toString("base64")
      .slice(0, 64);
  }
}
