import { api } from "./api.js";

export const invoicesService = {
  listCurrent: () => api.get("/invoices/current"),
  listByCard: (cardId) => api.get(`/invoices/card/${cardId}`),
  items: (id) => api.get(`/invoices/${id}/items`),
  pay: (id) => api.post(`/invoices/${id}/pay`),
};
