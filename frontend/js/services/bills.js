import { api } from "./api.js";

export const billsService = {
  list: () => api.get("/bills"),
  create: (payload) => api.post("/bills", payload),
  update: (id, payload) => api.put(`/bills/${id}`, payload),
  markPaid: (id, paid) => api.patch(`/bills/${id}/paid`, { paid }),
  remove: (id) => api.delete(`/bills/${id}`),
};
