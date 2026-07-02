import axios from "axios";
import { useAuthStore } from "@/stores/auth.store";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

// Attach token from localStorage
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = useAuthStore.getState().token;
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — redirect to login
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("railmind_token");
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post("/auth/change-password", { currentPassword, newPassword }),
  login: (email: string, password: string) => api.post("/auth/login", { email, password }),
  me: () => api.get("/auth/me"),
  logout: () => api.post("/auth/logout"),
  refresh: (refreshToken: string) => api.post("/auth/refresh", { refreshToken }),
};

// ─── Digital Twin ─────────────────────────────────────────────────────────────
export const twinApi = {
  getState: () => api.get("/twin/state"),
  getLayers: () => api.get("/twin/layers"),
};

// ─── Assets ───────────────────────────────────────────────────────────────────
export const assetsApi = {
  getAll: (params?: any) => api.get("/assets", { params }),
  getOne: (id: string) => api.get(`/assets/${id}`),
  getProfile: (id: string) => api.get(`/assets/${id}/profile`),
  getTwin: () => api.get("/assets/twin"),
  getByCode: (code: string) => api.get(`/assets/code/${code}`),
};

// ─── Stations ─────────────────────────────────────────────────────────────────
export const stationsApi = {
  getAll: () => api.get("/stations"),
  getOne: (id: string) => api.get(`/stations/${id}`),
  getDashboard: (id: string) => api.get(`/stations/${id}/dashboard`),
};

// ─── Incidents ────────────────────────────────────────────────────────────────
export const incidentsApi = {
  getAll: (params?: any) => api.get("/incidents", { params }),
  getOne: (id: string) => api.get(`/incidents/${id}`),
  getTimeline: (id: string) => api.get(`/incidents/${id}/timeline`),
  getSimilar: (id: string, assetId: string) => api.get(`/incidents/${id}/similar`, { params: { assetId } }),
  getInvestigation: (id: string) => api.get(`/incidents/${id}/investigation`),
  getStats: () => api.get("/incidents/stats"),
  create: (data: any) => api.post("/incidents", data),
  update: (id: string, data: any) => api.patch(`/incidents/${id}`, data),
  close: (id: string, data: any) => api.post(`/incidents/${id}/close`, data),
  addEvent: (id: string, data: any) => api.post(`/incidents/${id}/events`, data),
};

// ─── Risk ─────────────────────────────────────────────────────────────────────
export const riskApi = {
  getDashboard: () => api.get("/risk/dashboard"),
  getHeatmap: () => api.get("/risk/heatmap"),
  getTrends: () => api.get("/risk/trends"),
  getForecast: () => api.get("/risk/forecast"),
  getAssetRisk: (assetId: string) => api.get(`/risk/assets/${assetId}`),
  recalculate: () => api.post("/risk/recalculate"),
  calculateAsset: (assetId: string) => api.post(`/risk/assets/${assetId}/calculate`),
};

// ─── Memory ───────────────────────────────────────────────────────────────────
export const memoryApi = {
  search: (query: string, options?: any) => api.post("/memory/search", { query, ...options }),
  getLessons: (limit?: number) => api.get("/memory/lessons", { params: { limit } }),
  getProcedures: (limit?: number) => api.get("/memory/procedures", { params: { limit } }),
  buildPackage: (query: string, assetId?: string) => api.post("/memory/knowledge-package", { query, assetId }),
  ingestIncident: (id: string) => api.post(`/memory/ingest/incident/${id}`),
  ingestLesson: (id: string) => api.post(`/memory/ingest/lesson/${id}`),
  ingestProcedure: (id: string) => api.post(`/memory/ingest/procedure/${id}`),
  getStats: () => api.get("/memory/stats"),
};

// ─── Knowledge Graph ──────────────────────────────────────────────────────────
export const graphApi = {
  getNeighbours: (id: string, type: string, depth?: number) => api.get(`/graph/node/${id}/neighbours`, { params: { type, depth } }),
  getAssetGraph: (id: string) => api.get(`/graph/asset/${id}`),
  getIncidentGraph: (id: string) => api.get(`/graph/incident/${id}`),
  search: (q: string) => api.get("/graph/search", { params: { q } }),
  getStats: () => api.get("/graph/stats"),
  findPath: (from: string, to: string) => api.get("/graph/path", { params: { from, to } }),
  queryGraph: (cypher: string, params?: any) => api.post("/graph/query", { cypher, params }),
};

// ─── Agents ───────────────────────────────────────────────────────────────────
export const agentsApi = {
  ask: (question: string, assetId?: string) => api.post("/agents/ask", { question, assetId }),
  getStatus: () => api.get("/agents"),
  getHistory: (limit?: number) => api.get("/agents/history", { params: { limit } }),
  getRun: (id: string) => api.get(`/agents/runs/${id}`),
};

// ─── Recommendations ──────────────────────────────────────────────────────────
export const recommendationsApi = {
  getAll: (params?: any) => api.get("/recommendations", { params }),
  getOne: (id: string) => api.get(`/recommendations/${id}`),
  create: (data: any) => api.post("/recommendations", data),
  approve: (id: string) => api.post(`/recommendations/${id}/approve`),
  reject: (id: string, note?: string) => api.post(`/recommendations/${id}/reject`, { note }),
  complete: (id: string, note?: string) => api.post(`/recommendations/${id}/complete`, { outcomeNote: note }),
  getStats: () => api.get("/recommendations/stats"),
};

// ─── Analytics ────────────────────────────────────────────────────────────────
export const analyticsApi = {
  getDashboard: () => api.get("/analytics/dashboard"),
  getIncidentAnalytics: () => api.get("/analytics/incidents"),
  getRiskAnalytics: () => api.get("/analytics/risk"),
  getKnowledgeAnalytics: () => api.get("/analytics/knowledge"),
};

// ─── Search ───────────────────────────────────────────────────────────────────
export const searchApi = {
  search: (q: string) => api.get("/search", { params: { q } }),
};

// ─── Notifications ────────────────────────────────────────────────────────────
export const notificationsApi = {
  getAll: () => api.get("/notifications"),
  getUnreadCount: () => api.get("/notifications/unread-count"),
  markRead: (id: string) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post("/notifications/read-all"),
};

// ─── Maintenance ──────────────────────────────────────────────────────────────
export const maintenanceApi = {
  getQueue: () => api.get("/maintenance/queue"),
  getStats: () => api.get("/maintenance/stats"),
  getWorkOrders: (params?: any) => api.get("/maintenance/work-orders", { params }),
  getWorkOrder: (id: string) => api.get(`/maintenance/work-orders/${id}`),
  createWorkOrder: (data: any) => api.post("/maintenance/work-orders", data),
  updateWorkOrder: (id: string, data: any) => api.patch(`/maintenance/work-orders/${id}`, data),
  getAssetHistory: (assetId: string) => api.get(`/maintenance/assets/${assetId}/history`),
};

// ─── Users ────────────────────────────────────────────────────────────────────
export const usersApi = {
  updateProfile: (data: { firstName: string; lastName: string }) =>
    api.patch("/users/profile", data),
  getAll: (params?: any) => api.get("/users", { params }),
  getOne: (id: string) => api.get(`/users/${id}`),
  create: (data: any) => api.post("/users", data),
  update: (id: string, data: any) => api.patch(`/users/${id}`, data),
  deactivate: (id: string) => api.delete(`/users/${id}`),
  getStats: () => api.get("/users/stats"),
};

// ─── Audit ────────────────────────────────────────────────────────────────────
export const auditApi = {
  getLogs: (params?: any) => api.get("/audit/logs", { params }),
  getStats: () => api.get("/audit/stats"),
  getDecisionTrace: (id: string) => api.get(`/audit/decision/${id}`),
  getAgentRunTrace: (id: string) => api.get(`/audit/agent-run/${id}`),
};
