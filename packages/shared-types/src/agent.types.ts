// ─── Agent Types ──────────────────────────────────────────────────────────────

export type AgentName =
  | "EXECUTIVE"
  | "INCIDENT"
  | "KNOWLEDGE"
  | "RISK"
  | "ENGINEER"
  | "PLANNER"
  | "LEARNING";

export type AgentStatus =
  | "IDLE"
  | "THINKING"
  | "RETRIEVING"
  | "ANALYZING"
  | "COMPLETED"
  | "FAILED";

export interface Agent {
  name: AgentName;
  displayName: string;
  description: string;
  status: AgentStatus;
  lastActivity?: string;
  currentTask?: string;
}

export interface AgentThought {
  agentName: AgentName;
  step: string;
  detail: string;
  timestamp: string;
  isComplete: boolean;
}

export interface AgentActivity {
  id: string;
  agentName: AgentName;
  taskType: string;
  input: Record<string, unknown>;
  output?: AgentOutput;
  thoughts: AgentThought[];
  status: AgentStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
}

export interface AgentOutput {
  result: string;
  evidence: string[];
  confidence: number;
  reasoning: string;
  recommendations?: string[];
  metadata?: Record<string, unknown>;
}

export interface AskRailMindRequest {
  question: string;
  assetId?: string;
  incidentId?: string;
  context?: Record<string, unknown>;
}

export interface AskRailMindResponse {
  answer: string;
  situationSummary: string;
  rootCause?: string;
  riskScore?: number;
  confidence: number;
  evidence: EvidenceRef[];
  recommendations: string[];
  agentTrail: AgentThought[];
  processingTimeMs: number;
}

export interface EvidenceRef {
  type: string;
  id: string;
  title: string;
  relevance: number;
  summary: string;
}

export interface AgentRun {
  id: string;
  agentName: string;
  status: AgentStatus;
  input: Record<string, unknown>;
  output?: AgentOutput;
  thoughts: AgentThought[];
  startedAt: string;
  completedAt?: string;
}

// WebSocket events
export type AgentWsEventType =
  | "AGENT_STARTED"
  | "AGENT_THOUGHT"
  | "AGENT_COMPLETED"
  | "AGENT_FAILED"
  | "WORKFLOW_STARTED"
  | "WORKFLOW_COMPLETED";

export interface AgentWsEvent {
  type: AgentWsEventType;
  agentName: AgentName;
  payload: unknown;
  timestamp: string;
}
