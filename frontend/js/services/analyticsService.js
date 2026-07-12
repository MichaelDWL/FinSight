import { api } from "./api.js";

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, value);
    }
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

export const analyticsService = {
  getGeneral: (params = {}) => api.get(`/dashboard/general${buildQuery(params)}`),
  getExpenses: (params = {}) => api.get(`/dashboard/expenses${buildQuery(params)}`),
  getCashflow: (params = {}) => api.get(`/dashboard/cashflow${buildQuery(params)}`),
  getCards: (params = {}) => api.get(`/dashboard/cards${buildQuery(params)}`),
  getInvestments: (params = {}) => api.get(`/dashboard/investments${buildQuery(params)}`),
};
