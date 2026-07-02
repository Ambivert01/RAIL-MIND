// ─── Maintenance Types ────────────────────────────────────────────────────────

export type MaintenanceType =
  | "INSPECTION"
  | "REPAIR"
  | "REPLACEMENT"
  | "CALIBRATION"
  | "UPGRADE"
  | "EMERGENCY_REPAIR"
  | "SCHEDULED_MAINTENANCE";

export type MaintenanceOutcome = "SUCCESSFUL" | "PARTIAL" | "FAILED" | "DEFERRED";

export interface MaintenanceRecord {
  id: string;
  assetId: string;
  assetCode?: string;
  maintenanceType: MaintenanceType;
  description: string;
  performedBy?: string;
  performedAt: string;
  outcome: MaintenanceOutcome;
  durationHours?: number;
  findings?: string;
  partsReplaced?: string[];
  nextMaintenanceDue?: string;
  cost?: number;
  createdAt: string;
}

export interface MaintenanceQueue {
  assetId: string;
  assetCode: string;
  assetName: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  recommendedAction: string;
  dueDate?: string;
  riskScore: number;
  lastMaintenanceAt?: string;
  daysSinceLastMaintenance?: number;
}

export interface WorkOrder {
  id: string;
  assetId: string;
  maintenanceType: MaintenanceType;
  description: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  scheduledAt?: string;
  assignedTo?: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  estimatedHours?: number;
  createdAt: string;
  updatedAt: string;
}
