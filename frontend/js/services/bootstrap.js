import { api } from "./api.js";

export const bootstrapService = {
  getBootstrap: () => api.get("/app/bootstrap"),
};
