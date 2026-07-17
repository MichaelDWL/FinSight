import { api } from "./api.js";

export const marketService = {
  getOverview: () => api.get("/market/overview"),
  getRates: () => api.get("/market/rates"),
  getRatesHistory: (params = {}) => {
    const query = new URLSearchParams();
    if (params.indicator) query.set("indicator", params.indicator);
    if (params.limit) query.set("limit", String(params.limit));
    const suffix = query.toString() ? `?${query}` : "";
    return api.get(`/market/rates/history${suffix}`);
  },
  listAssets: (params = {}) => {
    const query = new URLSearchParams();
    if (params.type) query.set("type", params.type);
    const suffix = query.toString() ? `?${query}` : "";
    return api.get(`/market/assets${suffix}`);
  },
  getAsset: (code) => api.get(`/market/assets/${encodeURIComponent(code)}`),
  getHistory: (params = {}) => {
    const query = new URLSearchParams();
    if (params.code) query.set("code", params.code);
    if (params.limit) query.set("limit", String(params.limit));
    const suffix = query.toString() ? `?${query}` : "";
    return api.get(`/market/history${suffix}`);
  },
};

export const investmentsIntelligenceService = {
  portfolioSummary: () => api.get("/investments/portfolio/summary"),
  simulate: (payload) => api.post("/investments/simulate", payload),
  detail: (id) => api.get(`/investments/${id}`),
};
