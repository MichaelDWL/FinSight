const {
  ALLOCATION_KEYS,
  monthStart,
  moneyFromPercent,
  normalizeAllocation,
} = require("../constants");

const CATEGORY_TO_BUCKET = [
  { match: /moradia|aluguel|condom|água|agua|luz|internet|conta/i, key: "contas" },
  { match: /invest|aplicaç|aplicac|tesouro|cdb/i, key: "investimentos" },
  { match: /meta|reserva|emerg/i, key: "metas" },
  { match: /lazer|streaming|viagem|restaurante|bar|cinema/i, key: "lazer" },
  { match: /educ|curso|livro|desenvolv|escola/i, key: "desenvolvimento" },
  { match: /saúde|saude|academia|plano/i, key: "desenvolvimento" },
  { match: /aliment|mercado|supermerc/i, key: "contas" },
  { match: /assinatura|telefone/i, key: "contas" },
];

function mapCategoryToBucket(categoryName) {
  const name = String(categoryName || "");
  for (const rule of CATEGORY_TO_BUCKET) {
    if (rule.match.test(name)) return rule.key;
  }
  return "contas";
}

function buildBudgetRules({ monthlyIncome, allocation }) {
  const normalized = normalizeAllocation(allocation);
  return ALLOCATION_KEYS.map((item) => ({
    key: item.key,
    label: item.label,
    percent: normalized[item.key],
    limit: moneyFromPercent(monthlyIncome, normalized[item.key]),
    used: 0,
    color: item.color,
  }));
}

function computeUsageByBucket(spendingByCategory = []) {
  const usage = {
    contas: 0,
    investimentos: 0,
    metas: 0,
    lazer: 0,
    desenvolvimento: 0,
  };

  for (const item of spendingByCategory) {
    const key = mapCategoryToBucket(item.category);
    usage[key] += Number(item.total) || 0;
  }

  return usage;
}

function withProgress(rules = []) {
  return rules.map((rule) => {
    const limit = Number(rule.limit) || 0;
    const used = Number(rule.used) || 0;
    const remaining = Math.max(limit - used, 0);
    const usagePercent = limit > 0 ? Math.round((used / limit) * 100) : 0;
    return {
      ...rule,
      remaining,
      usagePercent,
      status:
        usagePercent >= 100 ? "exceeded" : usagePercent >= 85 ? "warning" : "ok",
    };
  });
}

module.exports = {
  mapCategoryToBucket,
  buildBudgetRules,
  computeUsageByBucket,
  withProgress,
  monthStart,
};
