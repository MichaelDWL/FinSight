/**
 * Normalizers de payloads BFF/API → shape usado pelas views.
 */
import { formatDateLabel, toIsoDate } from "./dates.js";
import {
  resolveIcon,
  getExpenseIcon,
  getInvestmentIcon,
  getBillIcon,
} from "./icons.js";

export function normalizeTransaction(transaction) {
  const category = transaction.category || transaction.type || "Outros";
  const isIncome = String(transaction.type || "")
    .toLowerCase()
    .includes("receita");

  return {
    ...transaction,
    category,
    icon: resolveIcon(
      transaction.icon,
      getExpenseIcon(category) || (isIncome ? "fa-arrow-trend-up" : "fa-wallet"),
    ),
  };
}

export function normalizeInvestment(investment) {
  const category = investment.category || investment.type || "Investimento";

  return {
    ...investment,
    icon: getInvestmentIcon(category),
    category,
    investmentType: investment.investmentType || null,
    assetCode: investment.assetCode || null,
    quantity: investment.quantity != null ? Number(investment.quantity) : null,
    cdiPercent: investment.cdiPercent != null ? Number(investment.cdiPercent) : null,
    prefixedRate: investment.prefixedRate != null ? Number(investment.prefixedRate) : null,
    ipcaSpread: investment.ipcaSpread != null ? Number(investment.ipcaSpread) : null,
    current: Number(investment.current ?? investment.value ?? 0),
    invested: Number(investment.invested ?? 0),
    returnRate: Number(investment.returnRate ?? 0),
  };
}

export function normalizeGoal(goal) {
  return {
    ...goal,
    desired: Number(goal.desired ?? goal.target ?? 0),
    current: Number(goal.current ?? 0),
    date:
      goal.date ||
      (goal.deadline
        ? formatDateLabel(String(goal.deadline).slice(0, 10))
        : "Sem prazo"),
  };
}

export function normalizeBill(bill) {
  return {
    ...bill,
    icon: resolveIcon(bill.icon, getBillIcon(bill.category)),
    account: bill.account || "Conta principal",
    payment: bill.payment || bill.paymentMethod || "Pix",
    recurring: Boolean(bill.recurring ?? bill.recurrence),
    paid: Boolean(bill.paid ?? bill.status === "paid"),
    dueDate: String(bill.dueDate || toIsoDate(new Date())).slice(0, 10),
  };
}

export function normalizeCardLastDigits(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(-3);
  return digits.padStart(3, "0");
}
