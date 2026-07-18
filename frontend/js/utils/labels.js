/** Labels de domínio (contas, movimentações, status). */

export const ACCOUNT_TYPE_LABELS = {
  corrente: "Conta Corrente",
  poupanca: "Conta Poupança",
  investimento: "Conta Investimento",
  carteira: "Carteira",
  dinheiro: "Dinheiro",
  outros: "Outro",
};

export function accountTypeLabel(type) {
  return ACCOUNT_TYPE_LABELS[type] || "Conta";
}

export const MOVEMENT_TYPE_LABELS = {
  receita: "Receita",
  despesa: "Despesa",
  transferencia: "Transferência",
  pagamento_fatura: "Pagamento de fatura",
  compra_parcelada: "Compra no cartão",
  recorrencia: "Recorrência",
};

export function movementTypeLabel(type) {
  return MOVEMENT_TYPE_LABELS[type] || "Movimentação";
}

export function invoiceStatusMeta(status) {
  const map = {
    aberta: { label: "Aberta", className: "status-pending" },
    fechada: { label: "Fechada", className: "status-today" },
    atrasada: { label: "Atrasada", className: "status-late" },
    paga: { label: "Paga", className: "status-paid" },
  };
  return map[status] || { label: status || "-", className: "status-pending" };
}
