import { api } from "./api.js";

export const investmentsService = {
  list: () => api.get("/investments"),
  create: (payload) => api.post("/investments", payload),
  update: (id, payload) => api.put(`/investments/${id}`, payload),
  remove: (id) => api.delete(`/investments/${id}`),
};
