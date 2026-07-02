// ─── Memory & Search Types ───────────────────────────────────────────────────

export type MemorySearchMode = "KEYWORD" | "SEMANTIC" | "GRAPH" | "HYBRID";

export interface MemorySearchRequest {
  query: string;
  mode?: MemorySearchMode;
  filters?: {
    assetType?: string;
    stationId?: string;
    dateFrom?: string;
    dateTo?: string;
    types?: MemoryItemType[];
  };
  limit?: number;
}

export type MemoryItemType =
  | "INCIDENT"
  | "MAINTENANCE"
  | "LESSON_LEARNED"
  | "SOP"
  | "MANUAL"
  | "RECOMMENDATION";

export interface MemorySearchResult {
  items: MemoryItem[];
  totalCount: number;
  queryTime: number;
  searchMode: MemorySearchMode;
  suggestedQueries?: string[];
}

export interface MemoryItem {
  id: string;
  type: MemoryItemType;
  title: string;
  content: string;
  summary: string;
  relevanceScore: number;
  assetCode?: string;
  stationName?: string;
  date: string;
  tags: string[];
  graphConnections?: number;
  metadata?: Record<string, unknown>;
}

export interface KnowledgePackage {
  query: string;
  similarIncidents: import("./incident.types").IncidentSummary[];
  relatedLessons: LessonLearned[];
  applicableProcedures: Procedure[];
  maintenancePatterns: string[];
  confidence: number;
  totalEvidenceCount: number;
}

export interface LessonLearned {
  id: string;
  title: string;
  content: string;
  assetType?: string;
  incidentId?: string;
  tags: string[];
  createdAt: string;
}

export interface Procedure {
  id: string;
  title: string;
  content: string;
  category: string;
  version: string;
  createdAt: string;
}
