const { round2 } = require("../engines/financialHealth.engine");

function normalizeArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [];
}

function getNextOccurrence(dayOfMonth, fromDate = new Date()) {
  if (!dayOfMonth) return null;

  const today = new Date(fromDate);
  today.setHours(0, 0, 0, 0);
  const safeDay = Math.min(Math.max(Number(dayOfMonth), 1), 28);

  let next = new Date(today.getFullYear(), today.getMonth(), safeDay);
  if (next < today) {
    next = new Date(today.getFullYear(), today.getMonth() + 1, safeDay);
  }

  return next.toISOString().slice(0, 10);
}

function daysUntil(isoDate) {
  if (!isoDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${String(isoDate).slice(0, 10)}T00:00:00`);
  return Math.round((due - today) / 86400000);
}

function enrichCards(cards) {
  return cards.map((card) => {
    const totalLimit = Number(card.totalLimit) || 0;
    const usedLimit = Number(card.usedLimit) || 0;
    const availableLimit = Number(card.availableLimit) || 0;
    const usagePercent = totalLimit > 0 ? round2((usedLimit / totalLimit) * 100) : 0;

    const nextClosing = getNextOccurrence(card.closingDay);
    const nextDue = getNextOccurrence(card.dueDay);

    return {
      ...card,
      totalLimit: round2(totalLimit),
      usedLimit: round2(usedLimit),
      availableLimit: round2(availableLimit),
      usagePercent,
      nextClosing,
      nextClosingDays: daysUntil(nextClosing),
      nextDue,
      nextDueDays: daysUntil(nextDue),
      currentInvoice: card.currentInvoice
        ? {
            id: card.currentInvoice.id,
            total: round2(Number(card.currentInvoice.total) || 0),
            dueDate: card.currentInvoice.dueDate,
            status: card.currentInvoice.status,
          }
        : null,
    };
  });
}

function buildInvoiceEvolutionSeries(invoiceEvolution) {
  const monthsMap = new Map();

  invoiceEvolution.forEach((item) => {
    const key = item.monthStart;
    if (!monthsMap.has(key)) {
      monthsMap.set(key, {
        month: item.month,
        monthStart: item.monthStart,
        total: 0,
        byCard: [],
      });
    }

    const entry = monthsMap.get(key);
    const value = Number(item.value) || 0;
    entry.total += value;
    entry.byCard.push({
      cardId: item.cardId,
      cardName: item.cardName,
      cardColor: item.cardColor,
      value,
    });
  });

  return [...monthsMap.values()].map((entry) => ({
    ...entry,
    total: round2(entry.total),
  }));
}

function buildCardsDashboard(raw, period) {
  const cards = enrichCards(normalizeArray(raw.cards));
  const limitTotals = raw.limitTotals || {};
  const installmentsSummary = raw.installmentsSummary || {};

  const totalLimit = Number(limitTotals.total_limit) || 0;
  const availableLimit = Number(limitTotals.available_limit) || 0;
  const usedLimit = Number(limitTotals.used_limit) || 0;
  const usagePercent = totalLimit > 0 ? round2((usedLimit / totalLimit) * 100) : 0;

  const purchasesByCategory = normalizeArray(raw.purchasesByCategory).map((item) => ({
    category: item.category,
    color: item.color,
    value: Number(item.value) || 0,
  }));

  const totalCategoryValue = purchasesByCategory.reduce((sum, item) => sum + item.value, 0);
  const purchasesByCategoryWithPercent = purchasesByCategory.map((item) => ({
    ...item,
    percent: totalCategoryValue > 0 ? round2((item.value / totalCategoryValue) * 100) : 0,
  }));

  const invoiceEvolutionRaw = normalizeArray(raw.invoiceEvolution).map((item) => ({
    month: item.month,
    monthStart: item.monthStart,
    cardId: item.cardId,
    cardName: item.cardName,
    cardColor: item.cardColor,
    value: Number(item.value) || 0,
  }));

  const invoiceEvolution = buildInvoiceEvolutionSeries(invoiceEvolutionRaw);

  const futureInstallments = normalizeArray(raw.futureInstallments).map((item) => ({
    id: item.id,
    installment: Number(item.installment) || 0,
    total: Number(item.total) || 0,
    value: Number(item.value) || 0,
    dueDate: item.dueDate,
    status: item.status,
    description: item.description,
    cardId: item.cardId,
    cardName: item.cardName,
    cardColor: item.cardColor,
  }));

  const upcomingInvoices = normalizeArray(raw.upcomingInvoices).map((item) => ({
    cardId: item.cardId,
    cardName: item.cardName,
    cardColor: item.cardColor,
    invoiceId: item.invoiceId,
    referenceMonth: item.referenceMonth,
    closingDate: item.closingDate,
    dueDate: item.dueDate,
    total: Number(item.total) || 0,
    paid: Number(item.paid) || 0,
    status: item.status,
    daysUntilDue: daysUntil(item.dueDate),
  }));

  const nextClosings = [...cards]
    .filter((card) => card.nextClosing)
    .sort((a, b) => String(a.nextClosing).localeCompare(String(b.nextClosing)))
    .slice(0, 5);

  const nextDueDates = [...cards]
    .filter((card) => card.nextDue)
    .sort((a, b) => String(a.nextDue).localeCompare(String(b.nextDue)))
    .slice(0, 5);

  return {
    meta: {
      period: period.period,
      startDate: period.startDate,
      endDate: period.endDate,
      compareStartDate: period.compareStartDate,
      compareEndDate: period.compareEndDate,
      granularity: period.granularity,
      generatedAt: new Date().toISOString(),
    },
    kpis: {
      totalLimit: round2(totalLimit),
      availableLimit: round2(availableLimit),
      usedLimit: round2(usedLimit),
      usagePercent,
      periodSpending: round2(Number(raw.periodSpending) || 0),
      pendingInstallments: round2(Number(installmentsSummary.pending_total) || 0),
      pendingInstallmentsCount: Number(installmentsSummary.pending_count) || 0,
      cardsCount: cards.length,
    },
    charts: {
      limitUsage: cards.map((card) => ({
        cardId: card.id,
        cardName: card.name,
        color: card.color,
        totalLimit: card.totalLimit,
        usedLimit: card.usedLimit,
        availableLimit: card.availableLimit,
        usagePercent: card.usagePercent,
      })),
      invoiceEvolution,
      invoiceEvolutionByCard: invoiceEvolutionRaw,
      purchasesByCategory: purchasesByCategoryWithPercent,
      cardComparison: cards.map((card) => ({
        id: card.id,
        name: card.name,
        color: card.color,
        totalLimit: card.totalLimit,
        usedLimit: card.usedLimit,
        availableLimit: card.availableLimit,
        usagePercent: card.usagePercent,
        currentInvoiceTotal: card.currentInvoice?.total || 0,
      })),
    },
    lists: {
      futureInstallments,
      upcomingInvoices,
      nextClosings,
      nextDueDates,
    },
    installments: {
      pendingCount: Number(installmentsSummary.pending_count) || 0,
      pendingTotal: round2(Number(installmentsSummary.pending_total) || 0),
      purchaseCount: Number(installmentsSummary.purchase_count) || 0,
      totalValue: round2(Number(installmentsSummary.total_value) || 0),
    },
    cards,
  };
}

module.exports = { buildCardsDashboard };
