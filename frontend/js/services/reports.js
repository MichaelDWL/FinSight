import { api } from "./api.js";

export const reportsService = {
  list: () => api.get("/reports"),
};
