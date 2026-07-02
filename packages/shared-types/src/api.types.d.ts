export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: ApiError;
    timestamp: string;
    requestId?: string;
}
export interface ApiError {
    code: string;
    message: string;
    details?: unknown;
}
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    hasNext: boolean;
    hasPrev: boolean;
}
export interface TwinState {
    stations: TwinStation[];
    assets: TwinAsset[];
    activeIncidents: TwinIncident[];
    activeAlerts: TwinAlert[];
    lastUpdatedAt: string;
}
export interface TwinStation {
    id: string;
    stationCode: string;
    name: string;
    latitude: number;
    longitude: number;
    status: import("./asset.types").AssetStatus;
    healthScore: number;
    activeIncidentCount: number;
    criticalAssetCount: number;
    zone: string;
}
export interface TwinAsset {
    id: string;
    stationId: string;
    assetType: import("./asset.types").AssetType;
    assetCode: string;
    name: string;
    status: import("./asset.types").AssetStatus;
    healthScore: number;
    riskScore?: number;
    latitude?: number;
    longitude?: number;
    hasActiveIncident: boolean;
}
export interface TwinIncident {
    id: string;
    assetId: string;
    assetCode: string;
    severity: import("./incident.types").IncidentSeverity;
    title: string;
    occurredAt: string;
}
export interface TwinAlert {
    id: string;
    assetId: string;
    assetCode: string;
    alertType: string;
    severity: string;
    message: string;
    createdAt: string;
}
export type WsEventType = "ASSET_UPDATED" | "INCIDENT_CREATED" | "INCIDENT_UPDATED" | "RISK_UPDATED" | "RECOMMENDATION_GENERATED" | "ALERT_RAISED" | "AGENT_EVENT" | "TWIN_STATE_UPDATE";
export interface WsEvent<T = unknown> {
    type: WsEventType;
    payload: T;
    timestamp: string;
}
export interface AnalyticsDashboard {
    networkHealth: number;
    totalAssets: number;
    healthyAssets: number;
    warningAssets: number;
    criticalAssets: number;
    totalIncidents: number;
    openIncidents: number;
    resolvedIncidents: number;
    knowledgeGrowth: KnowledgeMetric[];
    incidentTrend: TrendPoint[];
    riskTrend: TrendPoint[];
}
export interface KnowledgeMetric {
    date: string;
    incidents: number;
    lessons: number;
    relationships: number;
}
export interface TrendPoint {
    date: string;
    value: number;
    label?: string;
}
export interface Notification {
    id: string;
    userId: string;
    title: string;
    message: string;
    type: "INFO" | "WARNING" | "CRITICAL" | "SUCCESS";
    read: boolean;
    relatedEntityType?: string;
    relatedEntityId?: string;
    createdAt: string;
}
