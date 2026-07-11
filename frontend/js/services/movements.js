import { api } from "./api.js";

// Service unificado de movimentacoes. O modal dinamico monta o payload no
// contrato final de /movements (tipo: receita | despesa | conta | cartao |
// transferencia) e envia diretamente, sem camadas de traducao.
export const movementsService = {
  list: () => api.get("/movements"),
  create: (payload) => api.post("/movements", payload),
  update: (id, payload) => api.put(`/movements/${id}`, payload),
  markPaid: (id, paid) => api.patch(`/movements/${id}/paid`, { paid }),
  remove: (id) => api.delete(`/movements/${id}`),
};
