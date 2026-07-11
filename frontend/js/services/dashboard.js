import { api } from "./api.js";

export const dashboardService = {
  getDashboard: () => api.get("/dashboard"),
};
