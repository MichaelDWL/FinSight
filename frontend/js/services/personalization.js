import { api } from "./api.js";

export const personalizationService = {
  getContext: () => api.get("/personalization/context"),
  getProfile: () => api.get("/personalization/profile"),
  updateProfile: (payload) => api.put("/personalization/profile", payload),
  completeOnboarding: (payload) => api.post("/personalization/onboarding", payload),
  refresh: () => api.post("/personalization/refresh"),
};
