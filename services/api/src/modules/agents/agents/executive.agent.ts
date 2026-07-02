import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma.service";
import { IncidentAgent } from "./incident.agent";
import { KnowledgeAgent } from "./knowledge.agent";
import { RiskAgent } from "./risk.agent";
import { EngineerAgent } from "./engineer.agent";
import { PlannerAgent } from "./planner.agent";
import { LearningAgent } from "./learning.agent";
import { DecisionService } from "../../decision/decision.service";
import { AgentThought, AskRailMindRequest, AskRailMindResponse } from "@railmind/shared-types";
import { ConfigService } from "@nestjs/config";
import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import OpenAI from "openai";

// ─── LangGraph State Schema (RM-044) ─────────────────────────────────────────
const AgentState = Annotation.Root({
  request:         Annotation<AskRailMindRequest>({ reducer: (_, v) => v, default: () => ({} as AskRailMindRequest) }),
  asset:           Annotation<any>({ reducer: (_, v) => v, default: () => null }),
  thoughts:        Annotation<AgentThought[]>({ reducer: (a, b) => [...(a ?? []), ...(b ?? [])], default: () => [] }),
  incidentResult:  Annotation<any>({ reducer: (_, v) => v, default: () => null }),
  knowledgeResult: Annotation<any>({ reducer: (_, v) => v, default: () => null }),
  riskResult:      Annotation<any>({ reducer: (_, v) => v, default: () => null }),
  engineerResult:  Annotation<any>({ reducer: (_, v) => v, default: () => null }),
  plannerResult:   Annotation<any>({ reducer: (_, v) => v, default: () => null }),
  hasWeatherRisk:  Annotation<boolean>({ reducer: (_, v) => v, default: () => false }),
  onThought:       Annotation<((t: AgentThought) => void) | undefined>({ reducer: (_, v) => v, default: () => undefined }),
});

type State = typeof AgentState.State;

@Injectable()
export class ExecutiveAgent {
  private readonly logger = new Logger(ExecutiveAgent.name);
  private openai: OpenAI | null = null;
  private compiledGraph: any;

  constructor(
    private prisma: PrismaService,
    private incidentAgent: IncidentAgent,
    private knowledgeAgent: KnowledgeAgent,
    private riskAgent: RiskAgent,
    private engineerAgent: EngineerAgent,
    private plannerAgent: PlannerAgent,
    private learningAgent: LearningAgent,
    private decisionService: DecisionService,
    private config: ConfigService,
  ) {
    const apiKey = this.config.get<string>("ai.openaiApiKey");
    if (apiKey && !apiKey.includes("your-")) {
      this.openai = new OpenAI({ apiKey });
    }
    this.compiledGraph = this.buildGraph();
  }

  // ─── Build LangGraph StateGraph (RM-044) ─────────────────────────────────
  private buildGraph() {
    const workflow = new StateGraph(AgentState)

      .addNode("load_asset", async (state: State) => {
        if (!state.request?.assetId) return {};
        const asset = await this.prisma.asset.findUnique({
          where: { id: state.request.assetId },
          include: { station: true },
        });
        return { asset };
      })

      .addNode("incident_agent", async (state: State) => {
        state.onThought?.({ agentName: "EXECUTIVE", step: "Activating Incident Agent", detail: "Searching historical incident database...", timestamp: new Date().toISOString(), isComplete: false });
        const result = await this.incidentAgent.run(
          { query: state.request.question, assetId: state.request.assetId, assetCode: state.asset?.assetCode, assetType: state.asset?.assetType },
          (t) => state.onThought?.(t),
        );
        return { incidentResult: result, thoughts: result.thoughts ?? [] };
      })

      .addNode("knowledge_agent", async (state: State) => {
        state.onThought?.({ agentName: "EXECUTIVE", step: "Activating Knowledge Agent", detail: "Retrieving organisational memory...", timestamp: new Date().toISOString(), isComplete: false });
        const result = await this.knowledgeAgent.run(
          { query: state.request.question, assetId: state.request.assetId, incidentIds: state.incidentResult?.similarIncidents?.map((i: any) => i.id) ?? [] },
          (t) => state.onThought?.(t),
        );
        return { knowledgeResult: result, thoughts: result.thoughts ?? [] };
      })

      .addNode("risk_agent", async (state: State) => {
        const hasWeatherRisk = this.detectWeatherRisk(state.incidentResult?.similarIncidents ?? [], state.request.question);
        if (hasWeatherRisk) state.onThought?.({ agentName: "EXECUTIVE", step: "Weather risk detected", detail: "Amplifying risk score due to weather correlation...", timestamp: new Date().toISOString(), isComplete: false });
        const result = await this.riskAgent.run(
          { assetId: state.request.assetId, incidentCount: state.incidentResult?.similarIncidents?.length ?? 0, rootCauses: state.incidentResult?.rootCauses ?? [], hasWeatherRisk },
          (t) => state.onThought?.(t),
        );
        return { riskResult: result, hasWeatherRisk, thoughts: result.thoughts ?? [] };
      })

      .addNode("engineer_agent", async (state: State) => {
        state.onThought?.({ agentName: "EXECUTIVE", step: "Activating Engineer Agent", detail: "Consulting engineering knowledge base...", timestamp: new Date().toISOString(), isComplete: false });
        const result = await this.engineerAgent.run(
          { rootCauses: state.incidentResult?.rootCauses ?? [], assetType: state.asset?.assetType, riskScore: state.riskResult?.riskScore },
          (t) => state.onThought?.(t),
        );
        return { engineerResult: result, thoughts: result.thoughts ?? [] };
      })

      .addNode("planner_agent", async (state: State) => {
        state.onThought?.({ agentName: "EXECUTIVE", step: "Activating Planner Agent", detail: "Building maintenance schedule...", timestamp: new Date().toISOString(), isComplete: false });
        const result = await this.plannerAgent.run(
          { assetId: state.request.assetId, recommendations: state.engineerResult?.recommendations ?? [], riskScore: state.riskResult?.riskScore, assetType: state.asset?.assetType },
          (t) => state.onThought?.(t),
        );
        return { plannerResult: result, thoughts: result.thoughts ?? [] };
      })

      .addNode("learning_agent", async (state: State) => {
        state.onThought?.({ agentName: "EXECUTIVE", step: "Activating Learning Agent", detail: "Updating Railway Memory Network...", timestamp: new Date().toISOString(), isComplete: false });
        await this.learningAgent.run(
          { query: state.request.question, resolvedIncidents: (state.incidentResult?.similarIncidents ?? []).filter((i: any) => i.status === "RESOLVED").map((i: any) => i.id) },
          (t) => state.onThought?.(t),
        );
        return {};
      })

      // Graph edges
      .addEdge(START, "load_asset")
      .addEdge("load_asset", "incident_agent")
      .addEdge("incident_agent", "knowledge_agent")
      .addEdge("knowledge_agent", "risk_agent")
      // Conditional: always go to engineer, but skip planner if LOW risk with no incidents
      .addEdge("risk_agent", "engineer_agent")
      .addConditionalEdges("engineer_agent",
        (state: State) => (state.riskResult?.riskScore ?? 0) >= 31 ? "planner_agent" : "learning_agent",
        { planner_agent: "planner_agent", learning_agent: "learning_agent" }
      )
      .addEdge("planner_agent", "learning_agent")
      .addEdge("learning_agent", END);

    return workflow.compile();
  }

  async run(request: AskRailMindRequest, onThought?: (t: AgentThought) => void): Promise<AskRailMindResponse> {
    const startTime = Date.now();
    onThought?.({ agentName: "EXECUTIVE", step: "Workflow started", detail: `Processing: "${request.question}"`, timestamp: new Date().toISOString(), isComplete: false });

    // Fix 6: 60-second timeout on the full agent pipeline
    const TIMEOUT_MS = 60_000;
    const finalState = await Promise.race([
      this.compiledGraph.invoke({ request, onThought }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Agent pipeline timed out after 60 seconds")), TIMEOUT_MS)
      ),
    ]) as typeof AgentState.State;
    const { incidentResult, knowledgeResult, riskResult, engineerResult, asset, hasWeatherRisk } = finalState;

    const decision = await this.decisionService.synthesize({
      question: request.question,
      asset,
      incidentResult: incidentResult ?? { similarIncidents: [], rootCauses: [], confidence: 40, evidence: [] },
      knowledgeResult: knowledgeResult ?? { lessons: [], confidence: 40 },
      riskResult: riskResult ?? { riskScore: 30, severity: "LOW", confidence: 40, factors: [] },
      engineerResult: engineerResult ?? { recommendations: [], primaryAction: null },
      hasWeatherRisk: hasWeatherRisk ?? false,
    });

    onThought?.({ agentName: "EXECUTIVE", step: "Investigation complete", detail: `Risk: ${decision.riskScore}/100 | Confidence: ${decision.confidence}% | Action: ${decision.primaryAction}`, timestamp: new Date().toISOString(), isComplete: true });

    try {
      await this.prisma.agentRun.create({
        data: {
          agentName: "EXECUTIVE", taskType: "INVESTIGATION", status: "COMPLETED",
          input: request as any,
          output: { answer: decision.answer, riskScore: decision.riskScore, confidence: decision.confidence } as any,
          thoughts: (finalState.thoughts ?? []) as any,
          startedAt: new Date(startTime), completedAt: new Date(), durationMs: Date.now() - startTime,
        },
      });
    } catch (e) { this.logger.warn("AgentRun save failed: " + e.message); }

    return {
      answer: decision.answer,
      situationSummary: decision.situationSummary,
      rootCause: (incidentResult?.rootCauses ?? [])[0] ?? "Under investigation",
      riskScore: decision.riskScore,
      confidence: decision.confidence,
      evidence: decision.evidence,
      recommendations: (engineerResult?.recommendations ?? []).map((r: any) => r.action),
      agentTrail: finalState.thoughts ?? [],
      processingTimeMs: Date.now() - startTime,
    };
  }

  private detectWeatherRisk(incidents: any[], question: string): boolean {
    const kw = ["rain", "rainfall", "water", "flood", "storm", "wet", "moisture", "humidity", "snow", "ice", "fog", "lightning", "monsoon"];
    return incidents.some((i: any) => i.weatherCondition || kw.some((k) => `${i.title ?? ""} ${i.description ?? ""} ${i.rootCause ?? ""}`.toLowerCase().includes(k)))
      || kw.some((k) => question.toLowerCase().includes(k));
  }
}
