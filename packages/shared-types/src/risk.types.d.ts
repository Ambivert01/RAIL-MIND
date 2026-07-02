export type RiskSeverity = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
export type RiskCategory = "INFRASTRUCTURE" | "OPERATIONAL" | "MAINTENANCE" | "ENVIRONMENTAL" | "KNOWLEDGE";
export interface Risk {
    id: string;
    assetId: string;
    assetCode?: string;
    assetName?: string;
    stationName?: string;
    riskType: RiskCategory;
    riskScore: number;
    severity: RiskSeverity;
    confidence: number;
    possibleFailure?: string;
    rootCauseSummary?: string;
    recommendation?: string;
    factors: RiskFactor[];
    createdAt: string;
    updatedAt: string;
}
export interface RiskFactor {
    name: string;
    weight: number;
    value: number;
    description: string;
}
export interface RiskAssessment {
    riskScore: number;
    severity: RiskSeverity;
    confidence: number;
    factors: RiskFactor[];
    propagationPath?: PropagationNode[];
    historicalContext?: string;
}
export interface PropagationNode {
    entityType: string;
    entityId: string;
    entityName: string;
    impactScore: number;
    relationship: string;
}
export interface RiskDashboard {
    networkRiskScore: number;
    criticalAssets: Risk[];
    highRiskAssets: Risk[];
    riskDistribution: Record<RiskSeverity, number>;
    riskTrends: RiskTrend[];
    heatmapData: HeatmapPoint[];
}
export interface RiskTrend {
    date: string;
    avgScore: number;
    criticalCount: number;
}
export interface HeatmapPoint {
    assetId: string;
    assetCode: string;
    latitude: number;
    longitude: number;
    riskScore: number;
    severity: RiskSeverity;
}
