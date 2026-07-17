import { api } from "./api.js";

/** @deprecated Prefira bffService.getHome() / bffService.getDashboard() */
export const dashboardService = {
  getDashboard: () => api.get("/home"),
};
