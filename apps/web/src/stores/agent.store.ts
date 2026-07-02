import { create } from "zustand";

export interface AgentThoughtEntry {
  agentName: string;
  step: string;
  detail: string;
  timestamp: string;
  isComplete: boolean;
}

interface AgentState {
  thoughts: AgentThoughtEntry[];
  workflowStatus: "idle" | "running" | "completed" | "failed";
  currentQuestion: string | null;
  lastResponse: any | null;
  addThought: (t: AgentThoughtEntry) => void;
  setWorkflowStatus: (status: AgentState["workflowStatus"], question?: string) => void;
  setLastResponse: (r: any) => void;
  clearThoughts: () => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  thoughts: [],
  workflowStatus: "idle",
  currentQuestion: null,
  lastResponse: null,
  addThought: (t) => set((s) => ({ thoughts: [...s.thoughts.slice(-100), t] })),
  setWorkflowStatus: (status, question) => set({ workflowStatus: status, currentQuestion: question ?? null }),
  setLastResponse: (r) => set({ lastResponse: r, workflowStatus: "completed" }),
  clearThoughts: () => set({ thoughts: [], workflowStatus: "idle", currentQuestion: null }),
}));
