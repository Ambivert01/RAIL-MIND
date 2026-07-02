export type RecommendationPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type RecommendationStatus = "PENDING" | "APPROVED" | "REJECTED" | "IN_PROGRESS" | "COMPLETED";
export type RecommendationActionType = "MONITOR" | "INSPECT" | "REPAIR" | "REPLACE" | "ESCALATE" | "INVESTIGATE" | "SCHEDULE_MAINTENANCE" | "EMERGENCY_ACTION";
export interface Recommendation {
    id: string;
    incidentId?: string;
    assetId?: string;
    assetCode?: string;
    priority: RecommendationPriority;
    confidence: number;
    action: string;
    actionType: RecommendationActionType;
    reason: string;
    evidence: EvidenceItem[];
    expectedOutcome?: string;
    estimatedResolutionTime?: string;
    status: RecommendationStatus;
    approvedBy?: string;
    completedAt?: string;
    outcomeNote?: string;
    createdAt: string;
    updatedAt: string;
}
export interface EvidenceItem {
    type: "INCIDENT" | "MAINTENANCE" | "SENSOR" | "MANUAL" | "LESSON";
    referenceId: string;
    title: string;
    date: string;
    relevanceScore: number;
    summary: string;
}
export interface DecisionOutput {
    decisionId: string;
    situationSummary: string;
    rootCause: string;
    riskScore: number;
    confidence: number;
    priority: RecommendationPriority;
    recommendedAction: string;
    evidence: EvidenceItem[];
    expectedOutcome: string;
    agentConsensus: AgentConsensusItem[];
    createdAt: string;
}
export interface AgentConsensusItem {
    agentName: string;
    verdict: string;
    confidence: number;
    keyFinding: string;
}
