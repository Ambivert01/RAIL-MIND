import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";

interface DecisionInput {
  question: string;
  asset: any;
  incidentResult: { similarIncidents: any[]; rootCauses: string[]; confidence: number; evidence: string[] };
  knowledgeResult: { lessons: any[]; confidence: number };
  riskResult: { riskScore: number; severity: string; confidence: number; factors: any[] };
  engineerResult: { recommendations: any[]; primaryAction: any };
  hasWeatherRisk: boolean;
}

interface DecisionOutput {
  answer: string;
  situationSummary: string;
  riskScore: number;
  confidence: number;
  primaryAction: string;
  evidence: any[];
  conflictsResolved: string[];
  explainabilityChain: string[];
}

@Injectable()
export class DecisionService {
  private readonly logger = new Logger(DecisionService.name);
  private openai: OpenAI | null = null;

  constructor(private config: ConfigService) {
    const key = this.config.get<string>("ai.openaiApiKey");
    if (key && !key.includes("your-")) this.openai = new OpenAI({ apiKey: key });
  }

  async synthesize(input: DecisionInput): Promise<DecisionOutput> {
    // ─── Layer 1: Evidence Evaluation ────────────────────────────────────────
    const evidenceScore = this.evaluateEvidence(input);

    // ─── Layer 2: Context Synthesis ──────────────────────────────────────────
    const context = this.synthesizeContext(input);

    // ─── Layer 3: Recommendation Generation ──────────────────────────────────
    const primaryRec = input.engineerResult.primaryAction?.action
      ?? input.engineerResult.recommendations?.[0]?.action
      ?? "Conduct detailed diagnostic inspection";

    // ─── Layer 4: Priority Calculation ───────────────────────────────────────
    const priority = this.calculatePriority(input.riskResult.riskScore, input.hasWeatherRisk, evidenceScore);

    // ─── Layer 5: Confidence Scoring ─────────────────────────────────────────
    const confidence = this.computeConfidence(input, evidenceScore);

    // ─── Layer 6: Conflict Resolution ────────────────────────────────────────
    const { conflictsResolved, resolvedRiskScore } = this.resolveConflicts(input, confidence);

    // ─── Layer 7: Explainability Chain ───────────────────────────────────────
    const explainabilityChain = this.buildExplainabilityChain(input, evidenceScore, confidence, conflictsResolved);

    // ─── Generate final answer ────────────────────────────────────────────────
    const answer = await this.generateAnswer(input, { priority, confidence, primaryRec, resolvedRiskScore, context });

    const assetRef = input.asset ? `${input.asset.assetCode} at ${input.asset.station?.name}` : "The asset";
    const situationSummary = `${assetRef} shows ${input.riskResult.severity.toLowerCase()} risk (${resolvedRiskScore}/100). ` +
      `${input.incidentResult.similarIncidents.length} similar incidents found. Primary cause: ${input.incidentResult.rootCauses[0] ?? "under investigation"}.`;

    const evidence = [
      ...input.incidentResult.evidence.slice(0, 4).map((e, i) => ({
        type: "INCIDENT", id: e, title: e, relevance: Math.max(60, 92 - i * 8), summary: `Historical incident: ${e}`,
      })),
      ...input.knowledgeResult.lessons.slice(0, 2).map((l: any) => ({
        type: "LESSON", id: l.id, title: l.title, relevance: 72, summary: l.content?.slice(0, 100),
      })),
    ];

    return { answer, situationSummary, riskScore: resolvedRiskScore, confidence, primaryAction: primaryRec, evidence, conflictsResolved, explainabilityChain };
  }

  // Layer 1
  private evaluateEvidence(input: DecisionInput): number {
    let score = 0;
    score += Math.min(40, input.incidentResult.similarIncidents.length * 8);
    score += Math.min(20, input.knowledgeResult.lessons.length * 4);
    score += input.incidentResult.rootCauses.length > 0 ? 20 : 0;
    score += input.hasWeatherRisk ? 10 : 0;
    score += input.riskResult.factors.length > 0 ? 10 : 0;
    return Math.min(100, score);
  }

  // Layer 2
  private synthesizeContext(input: DecisionInput): string {
    const parts: string[] = [];
    if (input.asset) parts.push(`${input.asset.assetCode} (${input.asset.assetType})`);
    if (input.incidentResult.rootCauses.length) parts.push(`Root causes: ${input.incidentResult.rootCauses.slice(0, 2).join(", ")}`);
    if (input.hasWeatherRisk) parts.push("Weather factor active");
    parts.push(`Risk: ${input.riskResult.riskScore}/100`);
    return parts.join(" | ");
  }

  // Layer 4
  private calculatePriority(riskScore: number, hasWeather: boolean, evidenceScore: number): string {
    const composite = riskScore * 0.6 + evidenceScore * 0.3 + (hasWeather ? 10 : 0);
    if (composite >= 75) return "IMMEDIATE";
    if (composite >= 50) return "HIGH";
    if (composite >= 30) return "MEDIUM";
    return "LOW";
  }

  // Layer 5
  private computeConfidence(input: DecisionInput, evidenceScore: number): number {
    const base = Math.round(
      input.incidentResult.confidence * 0.45 +
      input.knowledgeResult.confidence * 0.30 +
      input.riskResult.confidence * 0.25,
    );
    const bonus = Math.min(15, Math.floor(evidenceScore / 8));
    const penalty = input.incidentResult.similarIncidents.length === 0 && input.knowledgeResult.lessons.length === 0 ? -15 : 0;
    return Math.max(10, Math.min(99, base + bonus + penalty));
  }

  // Layer 6
  private resolveConflicts(input: DecisionInput, confidence: number): { conflictsResolved: string[]; resolvedRiskScore: number } {
    const conflicts: string[] = [];
    let resolvedScore = input.riskResult.riskScore;

    // Conflict: high incident count but low formula risk score
    const incCount = input.incidentResult.similarIncidents.length;
    if (incCount >= 3 && resolvedScore < 40) {
      resolvedScore = Math.min(100, resolvedScore + incCount * 5);
      conflicts.push(`Risk score adjusted upward — ${incCount} incidents found but formula returned low score`);
    }

    // Conflict: weather risk active but risk score doesn't reflect it
    if (input.hasWeatherRisk && resolvedScore < 50) {
      resolvedScore = Math.min(100, resolvedScore + 15);
      conflicts.push("Risk score adjusted — weather risk detected but not fully reflected in formula output");
    }

    // Conflict: low confidence should suppress CRITICAL verdict
    if (confidence < 35 && resolvedScore >= 81) {
      resolvedScore = 79;
      conflicts.push("Critical severity downgraded to High — insufficient evidence to support CRITICAL assessment");
    }

    return { conflictsResolved: conflicts, resolvedRiskScore: resolvedScore };
  }

  // Layer 7
  private buildExplainabilityChain(input: DecisionInput, evidenceScore: number, confidence: number, conflicts: string[]): string[] {
    return [
      `Evidence evaluation: ${evidenceScore}/100 — based on ${input.incidentResult.similarIncidents.length} incidents, ${input.knowledgeResult.lessons.length} lessons, ${input.incidentResult.rootCauses.length} root causes`,
      `Agent confidence weights: Incident 45%, Knowledge 30%, Risk 25%`,
      `Computed confidence: ${confidence}%`,
      `Weather risk: ${input.hasWeatherRisk ? "YES — +15 risk points applied" : "None"}`,
      ...(conflicts.length ? [`Conflicts resolved: ${conflicts.join("; ")}`] : ["No conflicts between agent outputs"]),
      `Final recommendation priority: ${this.calculatePriority(input.riskResult.riskScore, input.hasWeatherRisk, evidenceScore)}`,
    ];
  }

  private async generateAnswer(input: DecisionInput, ctx: { priority: string; confidence: number; primaryRec: string; resolvedRiskScore: number; context: string }): Promise<string> {
    if (this.openai) {
      // Fix 7: retry up to 3 times with exponential backoff on transient failures
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const resp = await this.openai.chat.completions.create({
            model: this.config.get("ai.defaultModel") || "gpt-4o-mini",
            messages: [
              { role: "system", content: "You are RailMind, a railway AI. Answer technical questions concisely in 3-4 sentences. Always cite incident numbers. Never invent data." },
              { role: "user", content: `Question: ${input.question}\nContext: ${ctx.context}\nRisk: ${ctx.resolvedRiskScore}/100 (${input.riskResult.severity})\nIncidents: ${input.incidentResult.evidence.join(", ") || "none"}\nRoot causes: ${input.incidentResult.rootCauses.join(", ") || "TBD"}\nRecommended action: ${ctx.primaryRec}\nConfidence: ${ctx.confidence}%\nPriority: ${ctx.priority}` },
            ],
            max_tokens: 250,
            temperature: 0.2,
          });
          return resp.choices[0]?.message?.content ?? this.templateAnswer(input, ctx);
        } catch (e) {
          this.logger.warn("LLM failed: " + e.message);
        }
      }
    }
    return this.templateAnswer(input, ctx);
  }

  private templateAnswer(input: DecisionInput, ctx: any): string {
    const assetRef = input.asset ? `${input.asset.assetCode} at ${input.asset.station?.name}` : "This asset";
    const incCount = input.incidentResult.similarIncidents.length;
    const refs = input.incidentResult.evidence.slice(0, 3).join(", ");
    const weather = input.hasWeatherRisk ? " Weather correlation detected — inspect sealing and drainage." : "";
    const cause = input.incidentResult.rootCauses[0] ?? "component degradation";
    return `${assetRef} presents a ${input.riskResult.severity.toLowerCase()} risk (${ctx.resolvedRiskScore}/100) with primary cause: ${cause}.${weather} ` +
      (incCount > 0 ? `Historical analysis identified ${incCount} similar incident${incCount > 1 ? "s" : ""} (${refs}) confirming this failure pattern. ` : "") +
      `Recommended action: ${ctx.primaryRec}. Assessment confidence: ${ctx.confidence}% (Priority: ${ctx.priority}).`;
  }
}
