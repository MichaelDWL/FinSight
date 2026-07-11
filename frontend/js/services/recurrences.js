import { api } from "./api.js";

export const recurrencesService = {
  list: () => api.get("/recurrences"),
  remove: (id) => api.delete(`/recurrences/${id}`),
};
