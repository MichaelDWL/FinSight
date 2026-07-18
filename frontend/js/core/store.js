/**
 * Estado global da SPA FinSight.
 * Mutações: atribuir em store.campo (objeto compartilhado).
 */

export const store = {
  bootstrapReady: false,
  loadedRouteKey: null,
  dashboardData: null,
  currentInvoices: [],
  analyticsDashboardData: null,
  analyticsDashboardPayload: null,
  currentDashboardPeriod: "30d",
  currentAnalyticsRoute: "dashboards/geral",
  isLoadingAnalyticsDashboard: false,
  transactions: [],
  investments: [],
  portfolioSummary: null,
  investmentSimulationTimer: null,
  accounts: [],
  creditCards: [],
  bills: [],
  goals: [],
  currentUser: null,
  personalizationContext: null,
  isLoadingData: false,
  editingTransactionId: null,
  editingInvestmentId: null,
  editingBillId: null,
  editingCardId: null,
  selectedCardId: null,
  cardDetailData: null,
  editingAccountId: null,
  selectedAccountId: null,
  accountDetailData: null,
};

export function patchStore(partial = {}) {
  Object.assign(store, partial);
  return store;
}
