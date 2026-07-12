import { api } from "./api.js";

// Contas mensais tambem sao movimentacoes (tipo "conta"). Este service traduz
// o payload da tela atual de Contas para o contrato unificado de /movements.
function toCreatePayload(payload) {
  return {
    tipo: "conta",
    description: payload.name,
    value: payload.value,
    dueDate: payload.dueDate,
    date: payload.dueDate,
    category: payload.category,
    accountId: payload.accountId,
    payment: payload.paymentMethod,
    recurring: Boolean(payload.recurrence),
    notes: payload.notes,
  };
}

function toUpdatePayload(payload) {
  return {
    description: payload.name,
    value: payload.value,
    dueDate: payload.dueDate,
    date: payload.dueDate,
    category: payload.category,
    accountId: payload.accountId,
    payment: payload.paymentMethod,
    status: payload.status,
    notes: payload.notes,
  };
}

export const billsService = {
  list: () => api.get("/movements"),
  create: (payload) => api.post("/movements", toCreatePayload(payload)),
  update: (id, payload) => api.put(`/movements/${id}`, toUpdatePayload(payload)),
  markPaid: (id, paid) => api.patch(`/movements/${id}/paid`, { paid }),
  remove: (id) => api.delete(`/movements/${id}`),
};
