import { api } from "./api.js";

export const accountsService = {
  list: () => api.get("/accounts"),
  create: (payload) => api.post("/accounts", payload),
  update: (id, payload) => api.put(`/accounts/${id}`, payload),
  remove: (id) => api.delete(`/accounts/${id}`),
};
