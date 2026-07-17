const ALLOCATION_KEYS = [
  { key: "contas", label: "Contas Fixas", color: "#0d6efd" },
  { key: "investimentos", label: "Investimentos", color: "#14b8a6" },
  { key: "metas", label: "Metas", color: "#8b5cf6" },
  { key: "lazer", label: "Lazer", color: "#f59e0b" },
  { key: "desenvolvimento", label: "Desenvolvimento", color: "#ef5d86" },
];

const PROFILE_TYPES = {
  EQUILIBRADO: "equilibrado",
  CONQUISTADOR: "conquistador",
  APROVEITADOR: "aproveitador",
  CUSTOM: "custom",
};

const DEFAULT_ALLOCATIONS = {
  equilibrado: {
    contas: 50,
    investimentos: 20,
    metas: 10,
    lazer: 10,
    desenvolvimento: 10,
  },
  conquistador: {
    contas: 45,
    investimentos: 35,
    metas: 10,
    lazer: 5,
    desenvolvimento: 5,
  },
  aproveitador: {
    contas: 50,
    investimentos: 10,
    metas: 10,
    lazer: 25,
    desenvolvimento: 5,
  },
};

const EVENTS = {
  TRANSACTION_CREATED: "TransactionCreated",
  TRANSACTION_UPDATED: "TransactionUpdated",
  INVESTMENT_ADDED: "InvestmentAdded",
  BILL_PAID: "BillPaid",
  SALARY_UPDATED: "SalaryUpdated",
  PROFILE_UPDATED: "ProfileUpdated",
  GOAL_COMPLETED: "GoalCompleted",
  BUDGET_EXCEEDED: "BudgetExceeded",
  ONBOARDING_COMPLETED: "OnboardingCompleted",
  CACHE_BUST: "CacheBust",
};

const CACHE_TTL_SECONDS = 300;

function monthStart(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

function moneyFromPercent(income, percent) {
  return Math.round(((Number(income) || 0) * (Number(percent) || 0)) / 100);
}

function normalizeAllocation(allocation = {}) {
  const next = {};
  for (const item of ALLOCATION_KEYS) {
    next[item.key] = Math.max(0, Number(allocation[item.key]) || 0);
  }
  const total = Object.values(next).reduce((sum, value) => sum + value, 0);
  if (total === 100) return next;
  if (total <= 0) return { ...DEFAULT_ALLOCATIONS.equilibrado };

  let distributed = 0;
  const keys = ALLOCATION_KEYS.map((item) => item.key);
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      next[key] = Math.max(0, 100 - distributed);
      return;
    }
    next[key] = Math.round((next[key] / total) * 100);
    distributed += next[key];
  });
  return next;
}

module.exports = {
  ALLOCATION_KEYS,
  PROFILE_TYPES,
  DEFAULT_ALLOCATIONS,
  EVENTS,
  CACHE_TTL_SECONDS,
  monthStart,
  moneyFromPercent,
  normalizeAllocation,
};
