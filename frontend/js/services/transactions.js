import { api } from "./api.js";

// A partir da refatoracao, despesas e receitas sao movimentacoes unificadas.
// Este service traduz o payload da tela atual para o contrato de /movements.
function toCreatePayload(payload) {
  const isIncome = String(payload.type || "despesa")
    .toLowerCase()
    .includes("receita");

  return {
    tipo: isIncome ? "receita" : "despesa",
    description: payload.description,
    value: payload.value,
    date: payload.date,
    category: payload.category,
    categoryId: payload.categoryId,
    accountId: payload.accountId,
    payment: payload.payment,
    notes: payload.notes,
  };
}

export const transactionsService = {
  list: () => api.get("/movements"),
  create: (payload) => api.post("/movements", toCreatePayload(payload)),
  update: (id, payload) => api.put(`/movements/${id}`, payload),
  remove: (id) => api.delete(`/movements/${id}`),
};
