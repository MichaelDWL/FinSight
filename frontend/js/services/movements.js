import { api, newIdempotencyKey } from "./api.js";

// Service unificado de movimentacoes. O modal dinamico monta o payload no
// contrato final de /movements (tipo: receita | despesa | conta | cartao |
// transferencia) e envia diretamente, sem camadas de traducao.
export const movementsService = {
  list: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.pageSize) qs.set("pageSize", String(params.pageSize));
    const query = qs.toString();
    return api.get(`/movements${query ? `?${query}` : ""}`);
  },
  create: (payload) =>
    api.post("/movements", payload, { idempotencyKey: newIdempotencyKey() }),
  update: (id, payload) => api.put(`/movements/${id}`, payload),
  markPaid: (id, paid) =>
    api.patch(`/movements/${id}/paid`, { paid }, { idempotencyKey: newIdempotencyKey() }),
  remove: (id) => api.delete(`/movements/${id}`),
};
