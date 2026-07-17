import { api } from "./api.js";

export const investmentsService = {
  list: () => api.get("/investments"),
  listDetailed: () => api.get("/investments/detailed"),
  detail: (id) => api.get(`/investments/${id}`),
  create: (payload) => api.post("/investments", payload),
  update: (id, payload) => api.put(`/investments/${id}`, payload),
  remove: (id) => api.delete(`/investments/${id}`),
  portfolioSummary: () => api.get("/investments/portfolio/summary"),
  simulate: (payload) => api.post("/investments/simulate", payload),
};
