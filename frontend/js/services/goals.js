import { api } from "./api.js";

export const goalsService = {
  list: () => api.get("/goals"),
  create: (payload) => api.post("/goals", payload),
  update: (id, payload) => api.put(`/goals/${id}`, payload),
  remove: (id) => api.delete(`/goals/${id}`),
};
