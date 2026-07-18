const SETTLED_STATUSES = ["confirmada", "paga"];
const EXPENSE_TYPES = ["despesa", "recorrencia", "compra_parcelada"];
const EXPENSE_STATUSES = ["confirmada", "paga", "pendente"];
const BILL_TYPES = ["despesa", "recorrencia"];

const SETTLED = `('${SETTLED_STATUSES.join("', '")}')`;
const EXPENSE_TYPES_SQL = `('${EXPENSE_TYPES.join("', '")}')`;
const EXPENSE_STATUS_SQL = `('${EXPENSE_STATUSES.join("', '")}')`;
const BILL_TYPES_SQL = `('${BILL_TYPES.join("', '")}')`;

const PERIOD_OPTIONS = ["7d", "30d", "3m", "6m", "1y", "custom"];
const DEFAULT_PERIOD = "30d";
const MONTHLY_FLOW_MONTHS = 12;

const CACHE_TTL = {
  general: 300,
  expenses: 600,
  cards: 900,
  investments: 1800,
  cashflow: 600,
};

module.exports = {
  SETTLED_STATUSES,
  EXPENSE_TYPES,
  EXPENSE_STATUSES,
  BILL_TYPES,
  SETTLED,
  EXPENSE_TYPES_SQL,
  EXPENSE_STATUS_SQL,
  BILL_TYPES_SQL,
  PERIOD_OPTIONS,
  DEFAULT_PERIOD,
  MONTHLY_FLOW_MONTHS,
  CACHE_TTL,
};
