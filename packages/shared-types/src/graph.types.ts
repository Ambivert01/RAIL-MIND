// ─── Knowledge Graph Types ────────────────────────────────────────────────────

export type GraphNodeType =
  | "Station"
  | "Signal"
  | "Track"
  | "Switch"
  | "Asset"
  | "Incident"
  | "RootCause"
  | "Resolution"
  | "Engineer"
  | "Procedure"
  | "LessonLearned"
  | "Recommendation"
  | "WeatherEvent"
  | "MaintenanceRecord";

export type GraphRelationshipType =
  | "CONNECTED_TO"
  | "FAILED_IN"
  | "HAS_CAUSE"
  | "RESOLVED_BY"
  | "SIMILAR_TO"
  | "PART_OF"
  | "AFFECTED_BY"
  | "OCCURRED_DURING"
  | "PERFORMED_ON"
  | "RECOMMENDS"
  | "DESCRIBES"
  | "RESOLVED"
  | "INVESTIGATED"
  | "CONTRIBUTED_TO";

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  properties: Record<string, unknown>;
  // For visualization
  x?: number;
  y?: number;
  color?: string;
}

export interface GraphRelationship {
  id: string;
  source: string;
  target: string;
  type: GraphRelationshipType;
  label: string;
  properties?: Record<string, unknown>;
}

export interface GraphData {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
}

export interface GraphQueryResult {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
  paths?: GraphPath[];
  metadata?: {
    queryTime: number;
    nodesScanned: number;
  };
}

export interface GraphPath {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
  length: number;
}

export interface GraphNeighboursRequest {
  nodeId: string;
  nodeType: GraphNodeType;
  depth?: number;
  relationshipTypes?: GraphRelationshipType[];
}

export interface GraphSearchRequest {
  query: string;
  nodeTypes?: GraphNodeType[];
  limit?: number;
}
