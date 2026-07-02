export type AssetType = "SIGNAL" | "TRACK" | "SWITCH" | "BRIDGE" | "TUNNEL" | "CONTROL_CENTER" | "COMMUNICATION_UNIT";
export type AssetStatus = "HEALTHY" | "WARNING" | "CRITICAL" | "OFFLINE" | "MAINTENANCE";
export interface Station {
    id: string;
    stationCode: string;
    name: string;
    latitude: number;
    longitude: number;
    status: AssetStatus;
    zone: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
}
export interface Asset {
    id: string;
    stationId: string;
    station?: Station;
    assetType: AssetType;
    assetCode: string;
    name: string;
    status: AssetStatus;
    healthScore: number;
    latitude?: number;
    longitude?: number;
    description?: string;
    installationDate?: string;
    lastMaintenanceAt?: string;
    createdAt: string;
    updatedAt: string;
}
export interface AssetIntelligenceProfile {
    asset: Asset;
    riskSummary: {
        riskScore: number;
        severity: RiskSeverity;
        topRiskFactors: string[];
    };
    maintenanceHistory: MaintenanceRecord[];
    incidentHistory: IncidentSummary[];
    activeRecommendations: Recommendation[];
    relatedAssets: Asset[];
    graphRelationships: GraphNode[];
}
import type { RiskSeverity } from "./risk.types";
import type { MaintenanceRecord } from "./maintenance.types";
import type { IncidentSummary } from "./incident.types";
import type { Recommendation } from "./recommendation.types";
import type { GraphNode } from "./graph.types";
