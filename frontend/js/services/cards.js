import { api } from "./api.js";

export const cardsService = {
  list: () => api.get("/cards"),
  detail: (id) => api.get(`/cards/${id}`),
  create: (payload) => api.post("/cards", payload),
  update: (id, payload) => api.put(`/cards/${id}`, payload),
  remove: (id) => api.delete(`/cards/${id}`),
};
