import { api } from "./api.js";

export const transactionsService = {
  list: () => api.get("/transactions"),
  create: (payload) => api.post("/transactions", payload),
  update: (id, payload) => api.put(`/transactions/${id}`, payload),
  remove: (id) => api.delete(`/transactions/${id}`),
};
