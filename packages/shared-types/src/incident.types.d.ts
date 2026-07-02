export type IncidentSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type IncidentStatus = "OPEN" | "INVESTIGATING" | "RESOLVED" | "ARCHIVED";
export interface Incident {
    id: string;
    incidentNumber: string;
    title: string;
    description: string;
    severity: IncidentSeverity;
    status: IncidentStatus;
    assetId: string;
    assetCode?: string;
    stationId?: string;
    stationName?: string;
    rootCause?: string;
    resolution?: string;
    lessonsLearned?: string;
    occurredAt: string;
    resolvedAt?: string;
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
}
export interface IncidentSummary {
    id: string;
    incidentNumber: string;
    title: string;
    severity: IncidentSeverity;
    status: IncidentStatus;
    rootCause?: string;
    occurredAt: string;
    resolvedAt?: string;
}
export interface IncidentEvent {
    id: string;
    incidentId: string;
    eventType: string;
    description: string;
    agentName?: string;
    metadata?: Record<string, unknown>;
    timestamp: string;
}
export interface IncidentInvestigation {
    incident: Incident;
    similarIncidents: SimilarIncident[];
    rootCauses: string[];
    recommendations: import("./recommendation.types").Recommendation[];
    graphRelationships: import("./graph.types").GraphRelationship[];
    riskAssessment: import("./risk.types").RiskAssessment;
    agentFindings: AgentFinding[];
}
export interface SimilarIncident {
    incident: IncidentSummary;
    similarityScore: number;
    sharedFactors: string[];
}
export interface AgentFinding {
    agentName: string;
    finding: string;
    evidence: string[];
    confidence: number;
    timestamp: string;
}
export interface CreateIncidentDto {
    title: string;
    description: string;
    severity: IncidentSeverity;
    assetId: string;
    occurredAt?: string;
}
