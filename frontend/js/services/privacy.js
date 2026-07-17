import { api } from "./api.js";

export const privacyService = {
  getPolicy: () => api.get("/privacy/policy"),
  listConsents: () => api.get("/privacy/consents"),
  consent: (body) => api.post("/privacy/consent", body),
  exportData: () => api.get("/privacy/export"),
  deleteAccount: () => api.post("/privacy/delete-account", {}),
};
