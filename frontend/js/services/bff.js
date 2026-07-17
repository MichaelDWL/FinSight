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

/**
 * Camada BFF do frontend — uma chamada HTTP por tela.
 */
export const bffService = {
  getHome: () => api.get("/home"),
  getDashboard: (params = {}) => api.get(`/dashboard${buildQuery(params)}`),
  getInvestments: (params = {}) => api.get(`/investments${buildQuery(params)}`),
  getAccounts: () => api.get("/accounts"),
  getCards: (params = {}) => api.get(`/cards${buildQuery(params)}`),
  getTransactions: () => api.get("/transactions"),
  getReports: (params = {}) => api.get(`/reports${buildQuery(params)}`),
  getInsights: () => api.get("/insights"),
};
