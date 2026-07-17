import { api } from "./api.js";

export const adminService = {
  listUsers: (query = {}) => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.set(key, value);
      }
    });
    const qs = params.toString();
    return api.get(`/admin/users${qs ? `?${qs}` : ""}`);
  },
  getUser: (userId) => api.get(`/admin/users/${userId}`),
  updateUser: (userId, body) => api.patch(`/admin/users/${userId}`, body),
  changeRole: (userId, role) => api.patch(`/admin/users/${userId}/role`, { role }),
  suspend: (userId, reason) => api.post(`/admin/users/${userId}/suspend`, { reason }),
  reactivate: (userId) => api.post(`/admin/users/${userId}/reactivate`),
  forceLogout: (userId) => api.post(`/admin/users/${userId}/force-logout`),
  resetPassword: (userId) => api.post(`/admin/users/${userId}/reset-password`),
  deleteUser: (userId) => api.delete(`/admin/users/${userId}`),
  userAuditLogs: (userId, query = {}) => {
    const params = new URLSearchParams(query);
    const qs = params.toString();
    return api.get(`/admin/users/${userId}/audit-logs${qs ? `?${qs}` : ""}`);
  },
  auditLogs: (query = {}) => {
    const params = new URLSearchParams(query);
    const qs = params.toString();
    return api.get(`/admin/audit-logs${qs ? `?${qs}` : ""}`);
  },
};
