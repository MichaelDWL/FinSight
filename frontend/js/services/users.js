import { api } from "./api.js";

export const usersService = {
  profile: () => api.get("/users/me"),
  updateProfile: (payload) => api.put("/users/me", payload),
};
