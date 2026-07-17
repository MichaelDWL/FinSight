import { accountsService } from "./services/accounts.js";
import { billsService } from "./services/bills.js";
import { cardsService } from "./services/cards.js";
import { bootstrapService } from "./services/bootstrap.js";
import { investmentsService } from "./services/investments.js";
import { usersService } from "./services/users.js";
import { transactionsService } from "./services/transactions.js";
import { invoicesService } from "./services/invoices.js";
import { bffService } from "./services/bff.js";
import { destroyAllCharts, mountChart } from "./charts/ChartWrapper.js";
import { chartService } from "./services/chartService.js";
import { renderDashboardSkeleton } from "./modules/dashboard/shared/DashboardSkeleton.js";
import {
  mountGeneralDashboardCharts,
  renderGeneralDashboard,
} from "./modules/dashboard/general/generalView.js";
import {
  mountExpensesDashboardCharts,
  renderExpensesDashboard,
} from "./modules/dashboard/expenses/expensesView.js";
import {
  mountCashflowDashboardCharts,
  renderCashflowDashboard,
} from "./modules/dashboard/cashflow/cashflowView.js";
import {
  mountCardsDashboardCharts,
  renderCardsDashboard,
} from "./modules/dashboard/cards/cardsView.js";
import {
  mountInvestmentsDashboardCharts,
  renderInvestmentsDashboard,
} from "./modules/dashboard/investments/investmentsView.js";
import {
  buildInvestmentPayload,
  buildSimulationPayload,
  isFixedIncomeType,
  renderEconomicRatesStrip,
  renderFixedSimulationBlock,
  renderPortfolioHighlights,
  renderPortfolioProjectionBlock,
  renderProjectionPanel,
  renderVariableMarketBlock,
  syncInvestmentFormFields,
} from "./modules/investments/investmentFormUi.js";
import { normalizeDashboardRoute } from "./modules/dashboard/shared/periodLabels.js";
import { initDashboardScrollHints } from "./modules/dashboard/shared/DashboardNav.js";
import { renderHomeDashboard } from "./modules/home/homeView.js";
import { createMovementModal } from "./ui/movementModal.js";
import { createOnboardingWizard } from "./modules/onboarding/onboardingWizard.js";
import {
  renderProfilePage,
  bindProfilePage,
} from "./modules/profile/profileView.js";
import {
  renderAdminPage,
  bindAdminPage,
} from "./modules/admin/adminView.js";
import { personalizationService } from "./services/personalization.js";
import { confirmDialog } from "./ui/confirmModal.js";
import { ensureAuthenticated } from "./modules/auth/authGate.js";
import { authApi } from "./services/api.js";
import {
  initCustomSelects,
  refreshCustomSelectValue,
  setupCustomSelects,
} from "./ui/customSelect.js";
import {
  closeAllCustomCalendars,
  initCustomCalendars,
  refreshCustomCalendarValue,
  setCustomCalendarValue,
  setupCustomCalendars,
} from "./ui/customCalendar.js";
import { hideModal, showModal } from "./ui/modalFocus.js";

const app = document.querySelector("#app");
const pageTitle = document.querySelector("#pageTitle");
const toast = document.querySelector("#toast");
const quickAction = document.querySelector("#quickAction");
const quickActionMenu = document.querySelector("#quickActionMenu");
const expenseModal = document.querySelector("#expenseModal");
const expenseForm = document.querySelector("#expenseForm");
const closeExpenseModal = document.querySelector("#closeExpenseModal");
const cancelExpenseForm = document.querySelector("#cancelExpenseForm");
const investmentModal = document.querySelector("#investmentModal");
const investmentForm = document.querySelector("#investmentForm");
const closeInvestmentModal = document.querySelector("#closeInvestmentModal");
const cancelInvestmentForm = document.querySelector("#cancelInvestmentForm");
const billModal = document.querySelector("#billModal");
const billForm = document.querySelector("#billForm");
const cardModal = document.querySelector("#cardModal");
const cardForm = document.querySelector("#cardForm");
const accountModal = document.querySelector("#accountModal");
const accountForm = document.querySelector("#accountForm");

const formatCurrency = (value) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const formatDateLabel = (isoDate) => {
  if (!isoDate) return "";

  const [year, month, day] = String(isoDate).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "";

  return new Intl.DateTimeFormat("pt-BR").format(
    new Date(year, month - 1, day),
  );
};

const toIsoDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

let bootstrapReady = false;
let loadedRouteKey = null;
let dashboardData = null;
let currentInvoices = [];
let analyticsDashboardData = null;
let currentDashboardPeriod = "30d";
let currentAnalyticsRoute = "dashboards/geral";
let isLoadingAnalyticsDashboard = false;
let transactions = [];
let investments = [];
let portfolioSummary = null;
let investmentSimulationTimer = null;
let accounts = [];
let creditCards = [];
let bills = [];
let goals = [];
let currentUser = null;
let personalizationContext = null;
let isLoadingData = false;
let editingTransactionId = null;
let editingInvestmentId = null;
let editingBillId = null;
let editingCardId = null;
let selectedCardId = null;
let cardDetailData = null;
let editingAccountId = null;
let selectedAccountId = null;
let accountDetailData = null;

const routeTitles = {
  dashboard: "Home",
  "dashboards/geral": "Dashboard Geral",
  "dashboards/gastos": "Dashboard de Gastos",
  "dashboards/fluxo-caixa": "Fluxo de Caixa",
  "dashboards/cartoes": "Dashboard de Cartões",
  "dashboards/investimentos": "Dashboard de Investimentos",
  transacoes: "Transações",
  patrimonio: "Patrimônio",
  "investimento-novo": "Adicionar investimento",
  "investimento-detalhe": "Detalhes do investimento",
  "contas-resumo": "Contas",
  "contas-bancos": "Minhas Contas",
  "contas-despesas": "Despesas",
  "contas-cartoes": "Cartões",
  "cartao-detalhe": "Detalhes do cartão",
  "conta-detalhe": "Detalhes da conta",
  metas: "Metas financeiras",
  perfil: "Perfil",
  admin: "Administracao",
};

const ACCOUNT_TYPE_LABELS = {
  corrente: "Conta Corrente",
  poupanca: "Conta Poupança",
  investimento: "Conta Investimento",
  carteira: "Carteira",
  dinheiro: "Dinheiro",
  outros: "Outro",
};

function accountTypeLabel(type) {
  return ACCOUNT_TYPE_LABELS[type] || "Conta";
}

function relativeDayLabel(isoDate) {
  if (!isoDate) return "Sem movimentações";
  const iso = String(isoDate).slice(0, 10);
  const today = toIsoDate(new Date());
  if (iso === today) return "Hoje";

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (iso === toIsoDate(yesterday)) return "Ontem";

  return formatDateLabel(iso);
}

function showToast(message = "Tudo certo. Sua ação foi registrada.") {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2600);
}

function setModalCopy(
  modal,
  { tag, title, description, buttonIcon, buttonText },
) {
  modal
    ?.querySelector(".new-expense-tag")
    ?.replaceChildren(document.createTextNode(tag));
  modal
    ?.querySelector(".new-expense-header h2")
    ?.replaceChildren(document.createTextNode(title));
  modal
    ?.querySelector(".new-expense-header p")
    ?.replaceChildren(document.createTextNode(description));

  const primaryButton = modal?.querySelector(".expense-primary-btn");
  if (primaryButton) {
    primaryButton.innerHTML = `<i class="fa-solid ${buttonIcon}"></i>${buttonText}`;
  }
}

function setFieldValue(form, selector, value) {
  const field = form?.querySelector(selector);
  if (!field) return;
  field.value = value ?? "";
  if (field.matches("select")) refreshCustomSelectValue(field);
  if (field.matches("input.custom-date-native")) refreshCustomCalendarValue(field);
}

function getIsoDateValue(value) {
  return value ? String(value).slice(0, 10) : toIsoDate(new Date());
}

function updateCardColorPreview(color = "#0d6efd") {
  const picker = cardForm?.querySelector(".card-color-picker");
  const valueLabel = cardForm?.querySelector(".card-color-value");
  if (!picker) return;

  picker.style.setProperty("--selected-card-color", color);
  if (valueLabel) valueLabel.textContent = color.toUpperCase();
}

function normalizeCardLastDigits(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(-3);
  return digits.padStart(3, "0");
}

function updateAccountColorPreview(color = "#0d6efd") {
  const picker = accountForm?.querySelector(".card-color-picker");
  const valueLabel = accountForm?.querySelector(".card-color-value");
  if (!picker) return;

  picker.style.setProperty("--selected-card-color", color);
  if (valueLabel) valueLabel.textContent = color.toUpperCase();
}

function setAccountIcon(icon = "fa-building-columns") {
  const resolved = resolveIcon(icon, "fa-building-columns");
  const hiddenInput = accountForm?.querySelector("#accountIcon");
  if (hiddenInput) hiddenInput.value = resolved;

  accountForm?.querySelectorAll(".account-icon-option").forEach((option) => {
    option.classList.toggle(
      "is-selected",
      option.dataset.accountIcon === resolved,
    );
  });
}

const ICON_ALIASES = {
  "shopping-cart": "fa-cart-shopping",
  "shopping-bag": "fa-bag-shopping",
  cart: "fa-cart-shopping",
  home: "fa-house",
  house: "fa-house",
  car: "fa-car",
  heart: "fa-heart",
  gamepad: "fa-gamepad",
  "book-open": "fa-book-open",
  book: "fa-book",
  repeat: "fa-repeat",
  briefcase: "fa-briefcase",
  laptop: "fa-laptop",
  "trending-up": "fa-arrow-trend-up",
  "trending-down": "fa-arrow-trend-down",
  bank: "fa-building-columns",
  "piggy-bank": "fa-piggy-bank",
  landmark: "fa-landmark",
  "credit-card": "fa-credit-card",
  wallet: "fa-wallet",
  bitcoin: "fa-bitcoin",
  layers: "fa-layer-group",
  umbrella: "fa-umbrella",
  "shield-check": "fa-shield-halved",
  "building-2": "fa-building",
  "circle-dollar-sign": "fa-circle-dollar",
  receipt: "fa-receipt",
  plane: "fa-plane",
  utensils: "fa-utensils",
  "heart-pulse": "fa-heart-pulse",
};

function resolveIcon(rawIcon, fallback = "fa-wallet") {
  if (!rawIcon) return fallback;

  const value = String(rawIcon).trim();
  if (value.startsWith("fa-") || value.includes("fa-")) return value;

  return ICON_ALIASES[value] || fallback;
}

function normalizeTransaction(transaction) {
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

function normalizeInvestment(investment) {
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

function normalizeGoal(goal) {
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

function normalizeBill(bill) {
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

function applyBootstrapData(data = {}) {
  accounts = (data.accounts || []).map((account) => ({
    ...account,
    icon: resolveIcon(account.icon, "fa-building-columns"),
  }));
  creditCards = data.cards || [];
}

function applyDashboardData(data = {}) {
  dashboardData = data;
  transactions = (data.transactions || data.latestTransactions || data.recentTransactions || []).map(
    normalizeTransaction,
  );
  investments = (data.investments || data.portfolio || []).map(normalizeInvestment);
  accounts = (data.accounts || []).map((account) => ({
    ...account,
    icon: resolveIcon(account.icon, "fa-building-columns"),
  }));
  const cardsList = Array.isArray(data.cards) ? data.cards : data.cards?.list;
  if (cardsList) creditCards = cardsList;
  bills = (data.bills || data.pendingBills || data.nextBills || []).map(normalizeBill);
  goals = (data.goals || []).map(normalizeGoal);
}

/** Aplica user/contas/cartoes vindos de qualquer endpoint BFF (1 call por tela). */
function applyBffShell(data = {}) {
  if (data.user) {
    currentUser = data.user;
    updateUserHeader();
  }

  if (Array.isArray(data.accounts)) {
    accounts = data.accounts.map((account) => ({
      ...account,
      icon: resolveIcon(account.icon, "fa-building-columns"),
    }));
  }

  const cardsList = Array.isArray(data.cards) ? data.cards : data.cards?.list;
  if (cardsList) creditCards = cardsList;

  bootstrapReady = true;
}

const BFF_ROUTE_LOADERS = new Set([
  "dashboard",
  "transacoes",
  "contas-resumo",
  "contas-despesas",
  "contas-bancos",
  "contas-cartoes",
  "patrimonio",
  "investimento-detalhe",
  "metas",
  "perfil",
]);

const ROUTE_DATA_LOADERS = {
  dashboard: async () => {
    const data = await bffService.getHome();
    applyBffShell(data);
    applyDashboardData(data);
  },
  transacoes: async () => {
    const data = await bffService.getTransactions();
    applyBffShell(data);
    transactions = (data.list || []).map(normalizeTransaction);
  },
  "contas-resumo": async () => {
    const data = await bffService.getAccounts();
    applyBffShell(data);
    bills = (data.bills || []).map(normalizeBill);
    currentInvoices = data.invoices || [];
  },
  "contas-despesas": async () => {
    const data = await bffService.getAccounts();
    applyBffShell(data);
    bills = (data.bills || []).map(normalizeBill);
  },
  "contas-bancos": async () => {
    const data = await bffService.getAccounts();
    applyBffShell(data);
  },
  "contas-cartoes": async () => {
    const data = await bffService.getCards();
    applyBffShell(data);
  },
  patrimonio: async () => {
    const data = await bffService.getInvestments();
    applyBffShell(data);
    investments = (data.portfolio || []).map(normalizeInvestment);
    portfolioSummary = data.summary || null;
  },
  "investimento-detalhe": async () => {
    const data = await bffService.getInvestments();
    applyBffShell(data);
    investments = (data.portfolio || []).map(normalizeInvestment);
    portfolioSummary = data.summary || null;
  },
  metas: async () => {
    const data = await bffService.getInsights();
    applyBffShell(data);
    goals = (data.goals || []).map(normalizeGoal);
  },
  perfil: async () => {
    const data = await bffService.getInsights();
    applyBffShell(data);
    personalizationContext = data.personalization || null;
    goals = (data.goals || []).map(normalizeGoal);
  },
};

async function loadBootstrap({ force = false } = {}) {
  if (bootstrapReady && !force) return;
  if (isLoadingData) return;

  isLoadingData = true;
  try {
    const [bootstrap, user] = await Promise.all([
      bootstrapService.getBootstrap(),
      usersService.profile(),
    ]);
    applyBootstrapData(bootstrap);
    currentUser = user;
    bootstrapReady = true;
    updateUserHeader();
  } catch (error) {
    console.error(error);
    showToast(error.message || "Não foi possível carregar os dados da API.");
  } finally {
    isLoadingData = false;
  }
}

async function loadRouteData(route, { force = false } = {}) {
  const viewRoute = route === "investimento-novo" ? "patrimonio" : route;
  const loader = ROUTE_DATA_LOADERS[viewRoute];

  // Telas BFF: uma unica chamada HTTP (sem bootstrap separado)
  if (loader && BFF_ROUTE_LOADERS.has(viewRoute)) {
    if (loadedRouteKey === viewRoute && !force && bootstrapReady) return;
    await loader();
    loadedRouteKey = viewRoute;
    return;
  }

  await loadBootstrap({ force });
  if (!loader) return;
  if (loadedRouteKey === viewRoute && !force) return;
  await loader();
  loadedRouteKey = viewRoute;
}

function updateUserHeader() {
  if (!currentUser) return;

  const profile = document.querySelector(".profile");
  const name = currentUser.name || "Usuario";
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const greeting = profile?.querySelector("span:first-child");
  const picture = profile?.querySelector(".profile-picture");

  if (greeting) greeting.textContent = `Olá, ${name.split(" ")[0]}!`;
  if (picture) picture.textContent = initials;
}

const ANALYTICS_DASHBOARD_ROUTES = new Set([
  "dashboards",
  "dashboards/geral",
  "dashboards/gastos",
  "dashboards/fluxo-caixa",
  "dashboards/cartoes",
  "dashboards/investimentos",
]);

let analyticsDashboardPayload = null;

const DASHBOARD_RENDERERS = {
  "dashboards/geral": {
    render: renderGeneralDashboard,
    mount: mountGeneralDashboardCharts,
    section: "general",
    getProps: () => ({ firstName: getUserFirstName() }),
  },
  "dashboards/gastos": {
    render: renderExpensesDashboard,
    mount: mountExpensesDashboardCharts,
    section: "expenses",
    getProps: () => ({}),
  },
  "dashboards/fluxo-caixa": {
    render: renderCashflowDashboard,
    mount: mountCashflowDashboardCharts,
    section: "cashflow",
    getProps: () => ({}),
  },
  "dashboards/cartoes": {
    render: renderCardsDashboard,
    mount: mountCardsDashboardCharts,
    section: "cards",
    getProps: () => ({}),
  },
  "dashboards/investimentos": {
    render: renderInvestmentsDashboard,
    mount: mountInvestmentsDashboardCharts,
    section: "investments",
    getProps: () => ({}),
  },
};

function isAnalyticsDashboardRoute(route) {
  return ANALYTICS_DASHBOARD_ROUTES.has(route);
}

function pickAnalyticsSection(payload, section) {
  if (!payload) return null;
  return payload.sections?.[section] || null;
}

async function loadAnalyticsDashboard(route = currentAnalyticsRoute, period = currentDashboardPeriod) {
  const normalizedRoute = normalizeDashboardRoute(route);
  const renderer = DASHBOARD_RENDERERS[normalizedRoute];
  if (!renderer) return null;

  if (isLoadingAnalyticsDashboard) return analyticsDashboardData;

  isLoadingAnalyticsDashboard = true;
  try {
    // Uma unica chamada BFF para todos os paineis do dashboard
    if (
      !analyticsDashboardPayload ||
      currentDashboardPeriod !== period
    ) {
      analyticsDashboardPayload = await bffService.getDashboard({ period });
      applyBffShell(analyticsDashboardPayload);
    }

    analyticsDashboardData = pickAnalyticsSection(
      analyticsDashboardPayload,
      renderer.section,
    );
    currentDashboardPeriod = period;
    currentAnalyticsRoute = normalizedRoute;
    return analyticsDashboardData;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    isLoadingAnalyticsDashboard = false;
  }
}

function renderAnalyticsDashboardView(route, data) {
  const normalizedRoute = normalizeDashboardRoute(route);
  const renderer = DASHBOARD_RENDERERS[normalizedRoute];
  if (!renderer) return "";

  return renderer.render(data, {
    period: currentDashboardPeriod,
    ...renderer.getProps(),
  });
}

function mountAnalyticsDashboardCharts(route, data) {
  const normalizedRoute = normalizeDashboardRoute(route);
  const renderer = DASHBOARD_RENDERERS[normalizedRoute];
  renderer?.mount(data);
}

async function renderAnalyticsDashboardPage(route = getRoute()) {
  const normalizedRoute = normalizeDashboardRoute(route);
  destroyAllCharts();
  app.innerHTML = renderDashboardSkeleton();

  try {
    await loadAnalyticsDashboard(normalizedRoute, currentDashboardPeriod);

    app.innerHTML = renderAnalyticsDashboardView(normalizedRoute, analyticsDashboardData);
    mountAnalyticsDashboardCharts(normalizedRoute, analyticsDashboardData);
    initDashboardScrollHints(app);
  } catch (error) {
    app.innerHTML = `
      <section class="app-page">
        <div class="empty-state">
          <div>
            <i class="fa-solid fa-triangle-exclamation"></i>
            <p>${error.message || "Não foi possível carregar o dashboard."}</p>
            <button class="btn-primary" type="button" data-action="retry-dashboard">Tentar novamente</button>
          </div>
        </div>
      </section>
    `;
  }
}

async function reloadDashboardWithPeriod(period) {
  if (period === currentDashboardPeriod && analyticsDashboardData) return;

  currentDashboardPeriod = period;
  analyticsDashboardData = null;
  analyticsDashboardPayload = null;
  destroyAllCharts();
  app.innerHTML = renderDashboardSkeleton();

  try {
    await loadAnalyticsDashboard(currentAnalyticsRoute, period);
    app.innerHTML = renderAnalyticsDashboardView(currentAnalyticsRoute, analyticsDashboardData);
    mountAnalyticsDashboardCharts(currentAnalyticsRoute, analyticsDashboardData);
    initDashboardScrollHints(app);
  } catch (error) {
    showToast(error.message || "Não foi possível atualizar o período.");
    await renderAnalyticsDashboardPage(currentAnalyticsRoute);
  }
}

async function loadGeneralDashboard(period = currentDashboardPeriod) {
  return loadAnalyticsDashboard("dashboards/geral", period);
}

async function renderDashboardPage() {
  return renderAnalyticsDashboardPage("dashboards/geral");
}

async function reloadAndRender() {
  bootstrapReady = false;
  loadedRouteKey = null;
  dashboardData = null;
  analyticsDashboardData = null;
  analyticsDashboardPayload = null;
  await renderRoute();
}

function openExpenseModal(transaction = null) {
  if (!expenseModal || !expenseForm) return;

  closeQuickActionMenu();
  expenseForm.reset();
  editingTransactionId = transaction?.id || null;

  if (transaction) {
    const isIncome = String(transaction.type || "")
      .toLowerCase()
      .includes("receita");
    setModalCopy(expenseModal, {
      tag: isIncome ? "Editar entrada" : "Editar saída",
      title: isIncome ? "Editar Receita" : "Editar Despesa",
      description:
        "Atualize os dados salvos e mantenha seu histórico financeiro correto.",
      buttonIcon: "fa-check",
      buttonText: "Salvar alterações",
    });
    setFieldValue(expenseForm, "#desc-expense", transaction.description);
    setFieldValue(
      expenseForm,
      "#value-expense",
      Math.abs(Number(transaction.value) || 0),
    );
    setCustomCalendarValue(
      expenseForm.querySelector("#date-expense"),
      getIsoDateValue(transaction.date),
    );
    setFieldValue(expenseForm, "#obs-expense", transaction.notes || "");
  } else {
    setModalCopy(expenseModal, {
      tag: "Nova saída",
      title: "Adicionar Despesa",
      description:
        "Registre uma despesa e mantenha seus gastos sempre organizados.",
      buttonIcon: "fa-plus",
      buttonText: "Adicionar despesa",
    });
    setCustomCalendarValue(
      expenseForm.querySelector("#date-expense"),
      toIsoDate(new Date()),
    );
  }

  const dateInput = expenseForm.querySelector("#date-expense");
  if (dateInput && !dateInput.value) {
    setCustomCalendarValue(dateInput, toIsoDate(new Date()));
  }

  showModal(expenseModal);
  initCustomSelects(expenseForm);
  initCustomCalendars(expenseForm);
  expenseForm.querySelector("#desc-expense")?.focus();
}

function closeExpenseDialog({ reset = false } = {}) {
  if (!expenseModal) return;

  closeAllCustomCalendars();
  hideModal(expenseModal);

  if (reset) {
    expenseForm?.reset();
    editingTransactionId = null;
  }
}

function openInvestmentModal(investment = null) {
  if (!investmentModal || !investmentForm) return;

  closeQuickActionMenu();
  setInvestmentsMenuExpanded(true);
  investmentForm.reset();
  editingInvestmentId = investment?.id || null;

  if (investment) {
    setModalCopy(investmentModal, {
      tag: "Editar ativo",
      title: "Editar Investimento",
      description:
        "Atualize as informações principais do investimento cadastrado.",
      buttonIcon: "fa-check",
      buttonText: "Salvar alterações",
    });
    setFieldValue(investmentForm, "#investmentName", investment.name);
    setFieldValue(
      investmentForm,
      "#investmentType",
      investment.investmentType || "outro",
    );
    setFieldValue(
      investmentForm,
      "#investmentInstitution",
      investment.institution,
    );
    setFieldValue(investmentForm, "#investmentInvested", investment.invested);
    setFieldValue(
      investmentForm,
      "#investmentCurrent",
      investment.current ?? investment.value ?? investment.invested,
    );
    setFieldValue(
      investmentForm,
      "#investmentCdiPercent",
      investment.cdiPercent ?? 100,
    );
    setFieldValue(
      investmentForm,
      "#investmentPrefixedRate",
      investment.prefixedRate ?? "",
    );
    setFieldValue(
      investmentForm,
      "#investmentIpcaSpread",
      investment.ipcaSpread ?? "",
    );
    setFieldValue(
      investmentForm,
      "#investmentAssetCode",
      investment.assetCode || "",
    );
    setFieldValue(
      investmentForm,
      "#investmentQuantity",
      investment.quantity ?? "",
    );
    setFieldValue(investmentForm, "#investmentNotes", investment.notes || "");
    setCustomCalendarValue(
      investmentForm.querySelector("#investmentDate"),
      getIsoDateValue(investment.date),
    );
  } else {
    setInvestmentSubroute("investimento-novo");
    setModalCopy(investmentModal, {
      tag: "Novo ativo",
      title: "Adicionar Investimento",
      description:
        "Cadastre um investimento e veja a projeção automática para renda fixa.",
      buttonIcon: "fa-check",
      buttonText: "Salvar investimento",
    });
    setFieldValue(investmentForm, "#investmentType", "tesouro_selic");
    setFieldValue(investmentForm, "#investmentCdiPercent", 100);
    setCustomCalendarValue(
      investmentForm.querySelector("#investmentDate"),
      toIsoDate(new Date()),
    );
  }

  showModal(investmentModal);
  initCustomSelects(investmentForm);
  initCustomCalendars(investmentForm);
  syncInvestmentFormFields(investmentForm);
  scheduleInvestmentSimulation();
  // Garante sync apos o custom-select montar o DOM
  requestAnimationFrame(() => syncInvestmentFormFields(investmentForm));
  investmentForm.querySelector("#investmentName")?.focus();
}

async function refreshInvestmentSimulation() {
  const content = investmentForm?.querySelector("#investmentProjectionContent");
  const panel = investmentForm?.querySelector("#investmentProjectionPanel");
  if (!investmentForm || !content || !panel) return;

  syncInvestmentFormFields(investmentForm);
  const type = investmentForm.querySelector("#investmentType")?.value;
  if (!isFixedIncomeType(type)) {
    content.innerHTML = renderProjectionPanel({ kind: "variable_income" });
    return;
  }

  const payload = buildSimulationPayload(investmentForm);
  if (!payload.invested || payload.invested <= 0) {
    content.innerHTML = `
      <div class="investment-projection-empty">
        <p class="font-small">Informe o valor investido para calcular a projeção.</p>
      </div>
    `;
    return;
  }

  content.innerHTML = `
    <div class="investment-projection-empty">
      <p class="font-small">Calculando projeção...</p>
    </div>
  `;

  try {
    const simulation = await investmentsService.simulate(payload);
    content.innerHTML = renderProjectionPanel(simulation);
  } catch (_error) {
    content.innerHTML = `
      <div class="investment-projection-empty">
        <p class="font-small">Não foi possível calcular a projeção agora.</p>
      </div>
    `;
  }
}

function scheduleInvestmentSimulation() {
  clearTimeout(investmentSimulationTimer);
  investmentSimulationTimer = setTimeout(() => {
    refreshInvestmentSimulation();
  }, 350);
}

function closeInvestmentDialog({ reset = false } = {}) {
  if (!investmentModal) return;

  closeAllCustomCalendars();
  hideModal(investmentModal);

  if (reset) {
    investmentForm?.reset();
    editingInvestmentId = null;
  }
  setActiveRoute(
    getRoute() === "investimento-novo" ? "patrimonio" : getRoute(),
  );
}

function openBillModal(bill = null) {
  if (!billModal || !billForm) return;

  closeQuickActionMenu();
  setAccountsMenuExpanded(true);
  billForm.reset();
  editingBillId = bill?.id || null;

  if (bill) {
    setModalCopy(billModal, {
      tag: "Editar conta",
      title: "Editar Conta",
      description: "Atualize vencimento, valor e pagamento da conta salva.",
      buttonIcon: "fa-check",
      buttonText: "Salvar alterações",
    });
    setFieldValue(billForm, "#billName", bill.name);
    setFieldValue(billForm, "#billCategory", bill.category || "Moradia");
    setFieldValue(billForm, "#billValue", bill.value);
    setFieldValue(billForm, "#billDueDate", getIsoDateValue(bill.dueDate));
    setFieldValue(billForm, "#billAccount", bill.account || "Nubank");
    setFieldValue(
      billForm,
      "#billPayment",
      mapPaymentLabel(bill.payment || bill.paymentMethod),
    );
    setFieldValue(billForm, "#billRecurring", bill.recurring ? "Sim" : "Não");
    setFieldValue(billForm, "#billNotes", bill.notes || "");
  } else {
    setModalCopy(billModal, {
      tag: "Nova conta",
      title: "Adicionar Conta",
      description:
        "Cadastre uma conta para acompanhar vencimento, pagamento e valor do mês.",
      buttonIcon: "fa-check",
      buttonText: "Salvar conta",
    });
  }

  showModal(billModal);
  initCustomSelects(billForm);
  initCustomCalendars(billForm);
  billForm.querySelector("#billName")?.focus();
}

function closeBillDialog({ reset = false } = {}) {
  if (!billModal) return;

  closeAllCustomCalendars();
  hideModal(billModal);
  if (reset) {
    billForm?.reset();
    editingBillId = null;
  }
}

function openCardModal(card = null) {
  if (!cardModal || !cardForm) return;

  closeQuickActionMenu();
  setAccountsMenuExpanded(true);
  cardForm.reset();
  editingCardId = card?.id || null;

  if (card) {
    setModalCopy(cardModal, {
      tag: "Editar cartão",
      title: "Editar Cartão",
      description:
        "Atualize identificação, limite e vencimentos do cartão salvo.",
      buttonIcon: "fa-check",
      buttonText: "Salvar alterações",
    });
    setFieldValue(cardForm, "#cardName", card.name);
    setFieldValue(cardForm, "#cardBank", card.bank);
    setFieldValue(cardForm, "#cardBrand", card.brand || "Mastercard");
    setFieldValue(cardForm, "#cardLastDigits", normalizeCardLastDigits(card.lastDigits));
    setFieldValue(cardForm, "#cardColor", card.color || "#0d6efd");
    updateCardColorPreview(card.color || "#0d6efd");
    setFieldValue(cardForm, "#cardLimit", card.totalLimit);
    setFieldValue(cardForm, "#cardClosingDay", card.closingDay);
    setFieldValue(cardForm, "#cardDueDay", card.dueDay);
    setFieldValue(cardForm, "#cardNotes", card.notes || "");
  } else {
    updateCardColorPreview("#0d6efd");
    setModalCopy(cardModal, {
      tag: "Novo cartão",
      title: "Adicionar Cartão",
      description:
        "Informe apenas dados de identificação. Nunca pedimos o número completo do cartão.",
      buttonIcon: "fa-check",
      buttonText: "Salvar cartão",
    });
  }

  showModal(cardModal);
  initCustomSelects(cardForm);
  cardForm.querySelector("#cardName")?.focus();
}

function closeCardDialog({ reset = false } = {}) {
  if (!cardModal) return;

  hideModal(cardModal);
  if (reset) {
    cardForm?.reset();
    editingCardId = null;
  }
}

function openAccountModal(account = null) {
  if (!accountModal || !accountForm) return;

  closeQuickActionMenu();
  setAccountsMenuExpanded(true);
  accountForm.reset();
  editingAccountId = account?.id || null;

  if (account) {
    setModalCopy(accountModal, {
      tag: "Editar conta",
      title: "Editar Conta",
      description:
        "Atualize nome, tipo, instituição, cor e saldo desta conta.",
      buttonIcon: "fa-check",
      buttonText: "Salvar alterações",
    });
    setFieldValue(accountForm, "#accountName", account.name);
    setFieldValue(accountForm, "#accountType", account.type || "corrente");
    setFieldValue(accountForm, "#accountInstitution", account.institution || "");
    setFieldValue(accountForm, "#accountColor", account.color || "#0d6efd");
    updateAccountColorPreview(account.color || "#0d6efd");
    setAccountIcon(account.icon || "fa-building-columns");
    setFieldValue(accountForm, "#accountBalance", account.balance);
    setFieldValue(accountForm, "#accountNotes", account.notes || "");
  } else {
    updateAccountColorPreview("#0d6efd");
    setAccountIcon("fa-building-columns");
    setModalCopy(accountModal, {
      tag: "Nova conta",
      title: "Adicionar Conta",
      description:
        "Cadastre apenas onde você guarda seu dinheiro. Nunca pedimos agência, número da conta, CPF ou PIX.",
      buttonIcon: "fa-check",
      buttonText: "Salvar conta",
    });
  }

  showModal(accountModal);
  initCustomSelects(accountForm);
  accountForm.querySelector("#accountName")?.focus();
}

function closeAccountDialog({ reset = false } = {}) {
  if (!accountModal) return;

  hideModal(accountModal);
  if (reset) {
    accountForm?.reset();
    editingAccountId = null;
  }
}

function closeQuickActionMenu() {
  quickActionMenu?.classList.add("is-hidden");
  quickAction?.setAttribute("aria-expanded", "false");
}

function toggleQuickActionMenu() {
  if (!quickActionMenu) return;

  const isHidden = quickActionMenu.classList.toggle("is-hidden");
  quickAction?.setAttribute("aria-expanded", String(!isHidden));
}

function setInvestmentsMenuExpanded(expanded) {
  const group = document.querySelector("[data-nav-group='investments']");
  const toggle = group?.querySelector(
    "[data-action='toggle-investments-menu']",
  );
  if (!group || !toggle) return;

  group.classList.toggle("nav-group-open", expanded);
  toggle.setAttribute("aria-expanded", String(expanded));
}

function toggleInvestmentsMenu() {
  const group = document.querySelector("[data-nav-group='investments']");
  setInvestmentsMenuExpanded(!group?.classList.contains("nav-group-open"));
}

function setAccountsMenuExpanded(expanded) {
  const group = document.querySelector("[data-nav-group='accounts']");
  const toggle = group?.querySelector("[data-action='toggle-accounts-menu']");
  if (!group || !toggle) return;

  group.classList.toggle("nav-group-open", expanded);
  toggle.setAttribute("aria-expanded", String(expanded));
}

function toggleAccountsMenu() {
  const group = document.querySelector("[data-nav-group='accounts']");
  setAccountsMenuExpanded(!group?.classList.contains("nav-group-open"));
}

function setDashboardsMenuExpanded(expanded) {
  const group = document.querySelector("[data-nav-group='dashboards']");
  const toggle = group?.querySelector("[data-action='toggle-dashboards-menu']");
  if (!group || !toggle) return;

  group.classList.toggle("nav-group-open", expanded);
  toggle.setAttribute("aria-expanded", String(expanded));
}

function toggleDashboardsMenu() {
  const group = document.querySelector("[data-nav-group='dashboards']");
  setDashboardsMenuExpanded(!group?.classList.contains("nav-group-open"));
}

function setDashboardSubroute(activeRoute) {
  document
    .querySelectorAll("[data-nav-group='dashboards'] .nav-submenu [data-route]")
    .forEach((item) => {
      item.classList.toggle(
        "nav-subitem-active",
        item.dataset.route === activeRoute,
      );
    });
}

function setInvestmentSubroute(activeRoute) {
  document
    .querySelectorAll(".nav-submenu [data-route], .nav-submenu [data-subroute]")
    .forEach((item) => {
      const route = item.dataset.route || item.dataset.subroute;
      item.classList.toggle("nav-subitem-active", route === activeRoute);
    });
}

function setAccountSubroute(activeRoute) {
  document
    .querySelectorAll("[data-nav-group='accounts'] .nav-submenu [data-route]")
    .forEach((item) => {
      item.classList.toggle(
        "nav-subitem-active",
        item.dataset.route === activeRoute,
      );
    });
}

function getExpenseIcon(category) {
  const icons = {
    Moradia: "fa-house",
    Alimentação: "fa-cart-shopping",
    Transporte: "fa-car",
    Saúde: "fa-heart",
    Lazer: "fa-gamepad",
    Educação: "fa-book-open",
    Assinaturas: "fa-repeat",
  };

  return icons[category] || "fa-wallet";
}

function mapPaymentMethod(payment) {
  const paymentMap = {
    Pix: "pix",
    "Cartão de Débito": "debito",
    "Cartão de Crédito": "cartao_credito",
    Dinheiro: "dinheiro",
    Boleto: "boleto",
  };

  return paymentMap[payment] || "pix";
}

function mapPaymentLabel(payment) {
  const paymentMap = {
    pix: "Pix",
    debito: "Cartão de Débito",
    credito: "Cartão de Crédito",
    cartao_credito: "Cartão de Crédito",
    dinheiro: "Dinheiro",
    boleto: "Boleto",
    transferencia: "Pix",
    outros: "Pix",
  };

  return paymentMap[payment] || payment || "Pix";
}

async function addExpenseFromForm() {
  if (!expenseForm) return;

  const formData = new FormData(expenseForm);
  const value = Number(formData.get("value")) || 0;
  const currentTransaction = transactions.find(
    (transaction) => String(transaction.id) === String(editingTransactionId),
  );
  const transactionType = String(currentTransaction?.type || "despesa")
    .toLowerCase()
    .includes("receita")
    ? "receita"
    : "despesa";
  const payload = {
    description: formData.get("description") || "Nova despesa",
    value: Math.abs(value),
    date: formData.get("date") || new Date().toISOString().slice(0, 10),
    type: editingTransactionId ? transactionType : "despesa",
    category: formData.get("category") || null,
    payment: mapPaymentMethod(formData.get("payment")),
    status: currentTransaction?.status || "confirmada",
    notes: formData.get("notes") || "",
  };

  if (editingTransactionId) {
    await transactionsService.update(editingTransactionId, payload);
  } else {
    await transactionsService.create(payload);
  }

  const wasEditing = Boolean(editingTransactionId);
  closeExpenseDialog({ reset: true });
  showToast(
    wasEditing
      ? "Despesa atualizada com sucesso."
      : "Despesa adicionada com sucesso.",
  );
  await reloadAndRender();
}

function getInvestmentIcon(category) {
  const icons = {
    Cripto: "₿",
    Ações: "📈",
    Fundo: "📊",
    "Renda fixa": "🏦",
    Poupança: "🏦",
  };

  return icons[category] || "💼";
}

async function addInvestmentFromForm() {
  if (!investmentForm) return;

  const payload = buildInvestmentPayload(investmentForm);

  if (editingInvestmentId) {
    await investmentsService.update(editingInvestmentId, payload);
  } else {
    await investmentsService.create(payload);
  }

  const wasEditing = Boolean(editingInvestmentId);
  closeInvestmentDialog({ reset: true });
  showToast(
    wasEditing
      ? "Investimento atualizado com sucesso."
      : "Investimento salvo com sucesso.",
  );
  await reloadAndRender();
}

function getBillStatus(bill) {
  if (bill.paid) {
    return { label: "Pago", className: "status-paid", icon: "fa-circle-check" };
  }

  const today = toIsoDate(new Date());
  if (bill.dueDate === today) {
    return { label: "Hoje", className: "status-today", icon: "fa-clock" };
  }

  if (bill.dueDate < today) {
    return {
      label: "Atrasado",
      className: "status-late",
      icon: "fa-circle-exclamation",
    };
  }

  return {
    label: "Pendente",
    className: "status-pending",
    icon: "fa-hourglass-half",
  };
}

function getBillIcon(category) {
  const icons = {
    Moradia: "fa-house",
    Casa: "fa-wifi",
    Alimentação: "fa-cart-shopping",
    Transporte: "fa-car",
    Saúde: "fa-heart-pulse",
    Lazer: "fa-ticket",
    Assinaturas: "fa-receipt",
  };

  return icons[category] || "fa-file-invoice-dollar";
}

function billCard(bill, compact = false) {
  const status = getBillStatus(bill);

  return `
    <article class="bill-card">
      <label class="bill-check" title="Marcar como pago">
        <input type="checkbox" data-action="toggle-bill-paid" data-bill-id="${bill.id}" ${bill.paid ? "checked" : ""}>
        <span></span>
      </label>
      <div class="item-left">
        <span class="item-icon"><i class="fa-solid ${bill.icon}"></i></span>
        <div>
          <h3 class="item-title">${bill.name}</h3>
          <p class="item-meta">${bill.category} • vence em ${formatDateLabel(bill.dueDate)}</p>
          ${compact ? "" : `<p class="item-meta">${bill.account} • ${bill.payment}</p>`}
        </div>
      </div>
      <div class="bill-card-side">
        <strong class="amount-negative">${formatCurrency(bill.value)}</strong>
        <span class="status-pill ${status.className}"><i class="fa-solid ${status.icon}"></i>${status.label}</span>
      </div>
      ${
        compact
          ? ""
          : `<div class="bill-actions">
              <button class="btn-secondary" type="button" data-action="edit-bill" data-bill-id="${bill.id}">Editar</button>
              <button class="btn-danger" type="button" data-action="delete-bill" data-bill-id="${bill.id}">Excluir</button>
            </div>`
      }
    </article>
  `;
}

function cardSummary(card) {
  const available = card.totalLimit - card.usedLimit;
  const usedPercent = Math.round((card.usedLimit / card.totalLimit) * 100);

  return `
    <article class="credit-card-panel" style="--card-accent: ${card.color || "#0d6efd"}">
      <div class="credit-card-top">
        <div>
          <span class="page-eyebrow">${card.brand}</span>
          <h3>${card.name}</h3>
          <p>••• ${card.lastDigits}</p>
        </div>
        <i class="fa-solid fa-credit-card"></i>
      </div>
      <div class="credit-card-info">
        <div><span>Limite</span><strong>${formatCurrency(card.totalLimit)}</strong></div>
        <div><span>Fechamento</span><strong>Dia ${card.closingDay}</strong></div>
        <div><span>Vencimento</span><strong>Dia ${card.dueDay}</strong></div>
        <div><span>Fatura Atual</span><strong>${formatCurrency(card.invoiceCurrent)}</strong></div>
      </div>
      <div class="progress-bar">
        <div class="progress credit-progress" style="--progress-width: ${usedPercent}%"></div>
      </div>
      <p class="item-meta">${formatCurrency(available)} disponível</p>
      <div class="card-actions">
        <button class="btn-secondary" type="button" data-action="view-card" data-card-id="${card.id}">Ver detalhes</button>
        <button class="btn-secondary" type="button" data-action="edit-card" data-card-id="${card.id}">Editar</button>
        <button class="btn-danger" type="button" data-action="delete-card" data-card-id="${card.id}">Excluir</button>
      </div>
    </article>
  `;
}

function accountSummary(account) {
  const icon = resolveIcon(account.icon, "fa-building-columns");

  return `
    <article class="credit-card-panel account-panel" style="--card-accent: ${account.color || "#0d6efd"}">
      <div class="credit-card-top">
        <div>
          <span class="page-eyebrow">${accountTypeLabel(account.type)}</span>
          <h3>${account.name}</h3>
          <p>${account.institution || accountTypeLabel(account.type)}</p>
        </div>
        <i class="fa-solid ${icon}"></i>
      </div>
      <div class="account-balance">
        <span>Saldo Atual</span>
        <strong>${formatCurrency(account.balance)}</strong>
      </div>
      <div class="credit-card-info">
        <div><span>Receitas</span><strong>${formatCurrency(account.monthIncome || 0)}</strong></div>
        <div><span>Despesas</span><strong>${formatCurrency(account.monthExpenses || 0)}</strong></div>
      </div>
      <p class="item-meta">Última movimentação • ${relativeDayLabel(account.lastMovement)}</p>
      <div class="card-actions">
        <button class="btn-secondary" type="button" data-action="view-account" data-account-id="${account.id}">Ver detalhes</button>
        <button class="btn-secondary" type="button" data-action="edit-account" data-account-id="${account.id}">Editar</button>
        <button class="btn-danger" type="button" data-action="remove-account" data-account-id="${account.id}">Excluir</button>
      </div>
    </article>
  `;
}

async function addBillFromForm() {
  if (!billForm) return;

  const formData = new FormData(billForm);
  const currentBill = bills.find(
    (bill) => String(bill.id) === String(editingBillId),
  );
  const payload = {
    name: formData.get("name") || "Nova conta",
    category: formData.get("category") || "Moradia",
    value: Number(formData.get("value")) || 0,
    dueDate: formData.get("dueDate") || toIsoDate(new Date()),
    paymentMethod: mapPaymentMethod(formData.get("payment")),
    recurrence: formData.get("recurring") === "Sim",
    status: currentBill?.paid ? "paga" : "pendente",
    notes: formData.get("notes") || "",
  };

  if (editingBillId) {
    await billsService.update(editingBillId, payload);
  } else {
    await billsService.create(payload);
  }

  const wasEditing = Boolean(editingBillId);
  closeBillDialog({ reset: true });
  showToast(
    wasEditing
      ? "Conta atualizada com sucesso."
      : "Conta cadastrada com sucesso.",
  );
  await reloadAndRender();
}

async function addCardFromForm() {
  if (!cardForm) return;

  try {
    const formData = new FormData(cardForm);
    const totalLimit = Number(formData.get("totalLimit")) || 0;
    const currentCard = creditCards.find(
      (card) => String(card.id) === String(editingCardId),
    );
    const usedLimit = currentCard ? Number(currentCard.usedLimit || 0) : 0;
    const availableLimit = Math.min(
      Math.max(totalLimit - usedLimit, 0),
      totalLimit,
    );
    const payload = {
      name: formData.get("name") || "Novo cartão",
      bank: formData.get("bank") || "Banco",
      brand: formData.get("brand") || "Cartão",
      lastDigits: normalizeCardLastDigits(formData.get("lastDigits")),
      color: formData.get("color") || "#0d6efd",
      closingDay: Number(formData.get("closingDay")) || 1,
      dueDay: Number(formData.get("dueDay")) || 10,
      totalLimit,
      availableLimit: editingCardId ? availableLimit : undefined,
      notes: formData.get("notes") || "",
    };

    if (editingCardId) {
      await cardsService.update(editingCardId, payload);
    } else {
      await cardsService.create(payload);
    }

    const wasEditing = Boolean(editingCardId);
    closeCardDialog({ reset: true });
    showToast(
      wasEditing
        ? "Cartão atualizado com sucesso."
        : "Cartão cadastrado com segurança.",
    );
    await reloadAndRender();
  } catch (error) {
    console.error(error);
    showToast(error.message || "Não foi possível salvar o cartão.");
  }
}

async function addAccountFromForm() {
  if (!accountForm) return;

  try {
    const formData = new FormData(accountForm);
    const balanceRaw = formData.get("balance");
    const payload = {
      name: formData.get("name") || "Nova conta",
      type: formData.get("type") || "corrente",
      institution: (formData.get("institution") || "").trim(),
      color: formData.get("color") || "#0d6efd",
      icon: formData.get("icon") || "fa-building-columns",
      notes: (formData.get("notes") || "").trim(),
    };

    if (!editingAccountId) {
      payload.balance = Number(balanceRaw) || 0;
    } else if (balanceRaw !== null && balanceRaw !== "") {
      payload.balance = Number(balanceRaw) || 0;
    }

    if (editingAccountId) {
      await accountsService.update(editingAccountId, payload);
    } else {
      await accountsService.create(payload);
    }

    const wasEditing = Boolean(editingAccountId);
    closeAccountDialog({ reset: true });
    showToast(
      wasEditing
        ? "Conta atualizada com sucesso."
        : "Conta cadastrada com sucesso.",
    );
    await reloadAndRender();
  } catch (error) {
    console.error(error);
    showToast(error.message || "Não foi possível salvar a conta.");
  }
}

function getRoute() {
  const route = window.location.hash.replace("#", "") || "dashboard";

  if (route.startsWith("dashboard/")) {
    return route.replace("dashboard/", "dashboards/");
  }

  if (routeTitles[route]) return route;
  return "dashboard";
}

function setActiveRoute(route) {
  const accountRoutes = [
    "contas-resumo",
    "contas-bancos",
    "contas-despesas",
    "contas-cartoes",
    "cartao-detalhe",
    "conta-detalhe",
  ];
  const activeRoute = ["investimento-novo", "investimento-detalhe"].includes(
    route,
  )
    ? "patrimonio"
    : isAnalyticsDashboardRoute(route)
      ? "dashboards"
      : accountRoutes.includes(route)
        ? "contas-resumo"
        : route;

  document.querySelectorAll("[data-route]").forEach((link) => {
    if (link.closest(".mobile-bottom-nav")) return;

    const targetRoute = link.closest(".nav-submenu") ? route : activeRoute;
    const isActive = link.dataset.route === targetRoute;
    link.classList.toggle("nav-link-active", isActive);
    link.closest(".nav-item")?.classList.toggle("nav-active", isActive);
  });

  const investmentRoutes = [
    "patrimonio",
    "investimento-novo",
    "investimento-detalhe",
  ];
  const canExpandNavGroups =
    !document.body.classList.contains("sidebar-closed") ||
    window.matchMedia("(max-width: 767px)").matches;

  const isInvestmentRoute = investmentRoutes.includes(route);
  document
    .querySelector("[data-nav-group='investments']")
    ?.classList.toggle("nav-active", isInvestmentRoute);
  if (isInvestmentRoute && canExpandNavGroups) setInvestmentsMenuExpanded(true);
  setInvestmentSubroute(route);

  const isAccountRoute = accountRoutes.includes(route);
  document
    .querySelector("[data-nav-group='accounts']")
    ?.classList.toggle("nav-active", isAccountRoute);
  if (isAccountRoute && canExpandNavGroups) setAccountsMenuExpanded(true);
  const accountSubroute =
    route === "cartao-detalhe"
      ? "contas-cartoes"
      : route === "conta-detalhe"
        ? "contas-bancos"
        : route;
  setAccountSubroute(accountSubroute);

  const dashboardRoutes = [
    "dashboards",
    "dashboards/geral",
    "dashboards/gastos",
    "dashboards/fluxo-caixa",
    "dashboards/cartoes",
    "dashboards/investimentos",
  ];
  const isDashboardRoute = dashboardRoutes.includes(route);
  document
    .querySelector("[data-nav-group='dashboards']")
    ?.classList.toggle("nav-active", isDashboardRoute);
  if (isDashboardRoute && canExpandNavGroups) {
    setDashboardsMenuExpanded(true);
  }
  setDashboardSubroute(normalizeDashboardRoute(route));

  document.querySelectorAll(".mobile-bottom-nav-link").forEach((link) => {
    const key = link.dataset.mobileNav;
    const isActive =
      (key === "home" && route === "dashboard") ||
      (key === "dashboard" && isDashboardRoute) ||
      (key === "movements" && route === "transacoes") ||
      (key === "wealth" && isInvestmentRoute) ||
      (key === "profile" && route === "perfil");

    link.classList.toggle("is-active", isActive);
    if (isActive) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  pageTitle.textContent =
    routeTitles[route] ||
    routeTitles[normalizeDashboardRoute(route)] ||
    "Home";
  quickAction.querySelector(".fab-add-label").textContent = "Nova Movimentação";
}

function metricCard(label, value, icon, caption, tone = "brand", trend = null) {
  const toneClass =
    tone === "income"
      ? "text-income"
      : tone === "expense"
        ? "text-expense"
        : "text-brand";

  const trendHtml = trend ? trendBadge(trend, tone) : "";

  return `
    <article class="metric-card">
      <div class="metric-top">
        <span>${label}</span>
        <span class="metric-icon ${toneClass}"><i class="fa-solid ${icon}"></i></span>
      </div>
      <strong class="metric-value">${value}</strong>
      <small class="metric-caption">${caption}</small>
      ${trendHtml}
    </article>
  `;
}

function trendBadge(trend, tone = "brand") {
  if (!trend) return "";

  const invertTone = tone === "expense";
  let direction = trend.direction || "neutral";

  if (invertTone) {
    if (direction === "up") direction = "down";
    else if (direction === "down") direction = "up";
  }

  const icon =
    direction === "up"
      ? "fa-arrow-trend-up"
      : direction === "down"
        ? "fa-arrow-trend-down"
        : "fa-minus";

  const className =
    direction === "up"
      ? "metric-trend-up"
      : direction === "down"
        ? "metric-trend-down"
        : "metric-trend-neutral";

  return `
    <span class="metric-trend ${className}">
      <i class="fa-solid ${icon}"></i>
      ${trend.label || "Sem variação"}
    </span>
  `;
}

function getUserFirstName() {
  const name = currentUser?.name || "Usuário";
  return name.split(" ")[0];
}

function getTransactionStatus(transaction) {
  const status = String(transaction.status || "confirmada").toLowerCase();

  if (status === "paga" || status === "confirmada") {
    return {
      label: "Confirmada",
      className: "status-paid",
      icon: "fa-circle-check",
    };
  }

  if (status === "pendente") {
    return {
      label: "Pendente",
      className: "status-pending",
      icon: "fa-hourglass-half",
    };
  }

  return {
    label: status,
    className: "status-pending",
    icon: "fa-circle",
  };
}

function transactionItem(transaction) {
  const amountClass =
    transaction.value >= 0 ? "amount-positive" : "amount-negative";

  return `
    <div class="list-item">
      <div class="item-left">
        <span class="item-icon"><i class="fa-solid ${transaction.icon}"></i></span>
        <div>
          <p class="item-title">${transaction.description}</p>
          <p class="item-meta">${transaction.category} • ${transaction.account}</p>
        </div>
      </div>
      <strong class="${amountClass}">${formatCurrency(transaction.value)}</strong>
    </div>
  `;
}

function progressPercent(goal) {
  return Math.min(Math.round((goal.current / goal.desired) * 100), 100);
}

function goalCard(goal) {
  const percent = progressPercent(goal);

  return `
    <article class="goal-card">
      <div class="goal-head">
        <div>
          <h3 class="item-title">${goal.name}</h3>
          <p class="item-meta">Previsão: ${goal.date}</p>
        </div>
        <span class="pill">${percent}%</span>
      </div>
      <div>
        <div class="progress-bar">
          <div class="progress" style="--progress-width: ${percent}%"></div>
        </div>
        <p class="item-meta">${formatCurrency(goal.current)} de ${formatCurrency(goal.desired)}</p>
      </div>
    </article>
  `;
}

function investmentCard(investment, compact = false) {
  return `
    <article class="investment-card">
      <div class="investment-head">
        <div class="item-left">
          <span class="investment-icon">${investment.icon}</span>
          <div>
            <h3 class="item-title">${investment.name}</h3>
            <p class="item-meta">${investment.category}</p>
          </div>
        </div>
        <span class="return-badge">+${investment.returnRate}%</span>
      </div>
      <strong class="investment-value">${formatCurrency(investment.current)}</strong>
      ${compact ? "" : `<p class="item-meta">${investment.institution} • investido em ${new Date(investment.date).toLocaleDateString("pt-BR")}</p>`}
      ${
        compact
          ? ""
          : `<div class="card-actions">
              <button class="btn-secondary" type="button" data-action="edit-investment" data-investment-id="${investment.id}">Editar</button>
            </div>`
      }
    </article>
  `;
}

function dashboardView() {
  return renderHomeDashboard({
    dashboardData,
    transactions,
    investments,
    creditCards,
    goals,
    firstName: getUserFirstName(),
  });
}

function transactionsView() {
  return `
    <section class="app-page">
      <div class="page-hero">
        <div>
          <span class="page-eyebrow">Transações</span>
          <h1 class="page-title">Movimentações fáceis de encontrar.</h1>
          <p class="page-subtitle">Filtre por período, categoria, conta, tipo ou busque pelo nome.</p>
        </div>
        <button class="btn-primary mobile-hide-fab-duplicate" type="button" data-action="add-transaction"><i class="fa-solid fa-plus"></i> Nova transação</button>
      </div>

      <section class="table-shell">
        <div class="filters-grid" id="transactionFilters">
          <div class="field">
            <label for="periodFilter">Período</label>
            <select id="periodFilter" data-filter="period">
              <option value="all">Todos</option>
              <option value="july">Julho</option>
              <option value="june">Junho</option>
            </select>
          </div>
          <div class="field">
            <label for="categoryFilter">Categoria</label>
            <select id="categoryFilter" data-filter="category">
              <option value="all">Todas</option>
              <option>Alimentação</option>
              <option>Receita</option>
              <option>Moradia</option>
              <option>Lazer</option>
            </select>
          </div>
          <div class="field">
            <label for="accountFilter">Conta</label>
            <select id="accountFilter" data-filter="account">
              <option value="all">Todas</option>
              <option>Nubank</option>
              <option>Itaú</option>
              <option>Inter</option>
            </select>
          </div>
          <div class="field">
            <label for="typeFilter">Tipo</label>
            <select id="typeFilter" data-filter="type">
              <option value="all">Todos</option>
              <option>Receita</option>
              <option>Despesa</option>
            </select>
          </div>
          <div class="field">
            <label for="searchFilter">Busca</label>
            <input id="searchFilter" type="search" data-filter="search" placeholder="Ex.: mercado">
          </div>
        </div>

        <div class="table-wrap" id="transactionsTable"></div>
      </section>
    </section>
  `;
}

function renderTransactionsTable() {
  const table = document.querySelector("#transactionsTable");
  if (!table) return;

  const category =
    document.querySelector("[data-filter='category']")?.value || "all";
  const account =
    document.querySelector("[data-filter='account']")?.value || "all";
  const type = document.querySelector("[data-filter='type']")?.value || "all";
  const period =
    document.querySelector("[data-filter='period']")?.value || "all";
  const search =
    document.querySelector("[data-filter='search']")?.value.toLowerCase() || "";

  const filtered = transactions.filter((transaction) => {
    const month = new Date(transaction.date).getMonth();
    const matchesPeriod =
      period === "all" ||
      (period === "july" && month === 6) ||
      (period === "june" && month === 5);
    const matchesCategory =
      category === "all" || transaction.category === category;
    const matchesAccount = account === "all" || transaction.account === account;
    const matchesType = type === "all" || transaction.type === type;
    const matchesSearch = transaction.description
      .toLowerCase()
      .includes(search);

    return (
      matchesPeriod &&
      matchesCategory &&
      matchesAccount &&
      matchesType &&
      matchesSearch
    );
  });

  if (!filtered.length) {
    table.innerHTML = `
      <div class="empty-state">
        <div>
          <i class="fa-solid fa-magnifying-glass"></i>
          <h2 class="font-title-md">Nenhuma transação encontrada</h2>
          <p>Limpe os filtros ou tente buscar por outro termo.</p>
        </div>
      </div>
    `;
    return;
  }

  const tableRows = filtered
    .map(
      (transaction) => `
        <tr>
          <td>
            <div class="item-left">
              <span class="item-icon"><i class="fa-solid ${transaction.icon}"></i></span>
              <strong class="item-title">${transaction.description}</strong>
            </div>
          </td>
          <td><span class="pill">${transaction.category}</span></td>
          <td>${transaction.account}</td>
          <td><strong class="${transaction.value >= 0 ? "amount-positive" : "amount-negative"}">${formatCurrency(transaction.value)}</strong></td>
          <td>${new Date(transaction.date).toLocaleDateString("pt-BR")}</td>
          <td>
            <button class="btn-secondary" type="button" data-action="edit-transaction" data-transaction-id="${transaction.id}">
              <i class="fa-solid fa-pen"></i> Editar
            </button>
          </td>
        </tr>
      `,
    )
    .join("");

  const cardRows = filtered
    .map(
      (transaction) => `
        <article class="tx-card">
          <div class="tx-card-top">
            <div class="item-left">
              <span class="item-icon"><i class="fa-solid ${transaction.icon}"></i></span>
              <div>
                <strong class="item-title">${transaction.description}</strong>
                <div class="tx-card-meta">
                  <span class="pill">${transaction.category}</span>
                  <span>${transaction.account}</span>
                </div>
              </div>
            </div>
            <strong class="${transaction.value >= 0 ? "amount-positive" : "amount-negative"}">${formatCurrency(transaction.value)}</strong>
          </div>
          <div class="tx-card-meta">
            <span>${new Date(transaction.date).toLocaleDateString("pt-BR")}</span>
          </div>
          <div class="tx-card-actions">
            <button class="btn-secondary" type="button" data-action="edit-transaction" data-transaction-id="${transaction.id}">
              <i class="fa-solid fa-pen"></i> Editar
            </button>
          </div>
        </article>
      `,
    )
    .join("");

  table.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Descrição</th>
          <th>Categoria</th>
          <th>Conta</th>
          <th>Valor</th>
          <th>Data</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
    <div class="tx-card-list" aria-label="Lista de movimentações">
      ${cardRows}
    </div>
  `;
}

function invoiceSummaryCard(entry) {
  const invoice = entry.invoice;
  const monthLabel = formatMonthYear(
    invoice?.referenceMonth || new Date().toISOString().slice(0, 10),
  );
  const meta = invoice
    ? invoiceStatusMeta(invoice.status)
    : { label: "Sem compras", className: "status-pending" };
  const total = Number(invoice?.total || 0);
  const paid = Number(invoice?.paid || 0);
  const remaining = Math.max(total - paid, 0);
  const dueDate = invoice?.dueDate || null;
  const canPay = invoice && invoice.status !== "paga" && total > 0;

  return `
    <article class="invoice-summary-card" style="--card-accent: ${entry.cardColor || "#0d6efd"}">
      <div class="invoice-summary-head">
        <div class="item-left">
          <span class="item-icon"><i class="fa-solid fa-credit-card"></i></span>
          <div>
            <p class="item-title">${entry.cardName}</p>
            <p class="item-meta">${entry.cardBrand || "Cartão"} · ••• ${entry.lastDigits || "---"}</p>
          </div>
        </div>
        <span class="status-pill ${meta.className}">${meta.label}</span>
      </div>
      <div class="invoice-summary-values">
        <div>
          <span>Fatura de ${monthLabel}</span>
          <strong class="${total > 0 ? "amount-negative" : ""}">${formatCurrency(total)}</strong>
        </div>
        <div>
          <span>Vencimento</span>
          <strong>${dueDate ? formatDateLabel(dueDate) : `Dia ${entry.dueDay || "-"}`}</strong>
        </div>
        <div>
          <span>Restante</span>
          <strong class="${remaining > 0 ? "amount-negative" : "text-income"}">${formatCurrency(remaining)}</strong>
        </div>
      </div>
      <div class="card-actions">
        ${
          canPay
            ? `<button class="btn-primary" type="button" data-action="pay-invoice" data-invoice-id="${invoice.id}"><i class="fa-solid fa-check"></i> Pagar</button>`
            : ""
        }
        <button class="btn-secondary" type="button" data-action="view-card" data-card-id="${entry.cardId}">Ver cartão</button>
      </div>
    </article>
  `;
}

function billsSummaryView() {
  const total = bills.reduce((sum, bill) => sum + bill.value, 0);
  const paid = bills
    .filter((bill) => bill.paid)
    .reduce((sum, bill) => sum + bill.value, 0);
  const pendingBills = bills.filter((bill) => !bill.paid);
  const nextBill = [...pendingBills].sort((first, second) =>
    first.dueDate.localeCompare(second.dueDate),
  )[0];
  const invoicesTotal = currentInvoices.reduce(
    (sum, entry) => sum + Number(entry.invoice?.total || 0),
    0,
  );
  const invoicesRemaining = currentInvoices.reduce((sum, entry) => {
    const total = Number(entry.invoice?.total || 0);
    const paidAmount = Number(entry.invoice?.paid || 0);
    return sum + Math.max(total - paidAmount, 0);
  }, 0);

  return `
    <section class="app-page">
      <div class="page-hero">
        <div>
          <span class="page-eyebrow">Contas deste mês</span>
          <h1 class="page-title">Tudo que você precisa pagar, sem confusão.</h1>
          <p class="page-subtitle">Veja contas pagas, pendentes, atrasadas e o próximo vencimento em uma tela simples.</p>
        </div>
        <button class="btn-primary" type="button" data-action="add-bill"><i class="fa-solid fa-plus"></i> Nova Conta</button>
      </div>

      <div class="metrics-grid">
        ${metricCard("Total a pagar", formatCurrency(total), "fa-file-invoice-dollar", "Todas as contas do mês", "expense")}
        ${metricCard("Total já pago", formatCurrency(paid), "fa-circle-check", "Contas marcadas como pagas", "income")}
        ${metricCard("Contas pendentes", pendingBills.length, "fa-clock", "Ainda precisam de atenção", pendingBills.length ? "expense" : "income")}
        ${metricCard("Próximo vencimento", nextBill ? formatDateLabel(nextBill.dueDate) : "Tudo pago", "fa-calendar-day", nextBill ? nextBill.name : "Nenhuma conta pendente")}
      </div>

      <section class="premium-card">
        <div class="card-title-row">
          <h2>Próximas contas</h2>
          <a class="btn-secondary" href="#contas-despesas">Ver todas</a>
        </div>
        <div class="bills-list">${[...bills]
          .sort((first, second) => first.dueDate.localeCompare(second.dueDate))
          .slice(0, 5)
          .map((bill) => billCard(bill, true))
          .join("")}</div>
      </section>

      <section class="premium-card">
        <div class="card-title-row">
          <h2>Faturas do mês</h2>
          <span class="pill">${formatCurrency(invoicesRemaining)} em aberto</span>
        </div>
        ${
          currentInvoices.length
            ? `<div class="invoices-summary-grid">${currentInvoices.map(invoiceSummaryCard).join("")}</div>`
            : `<div class="empty-state compact"><div><i class="fa-solid fa-credit-card"></i><p>Nenhum cartão cadastrado. Adicione um cartão para acompanhar as faturas aqui.</p></div></div>`
        }
        ${
          currentInvoices.length
            ? `<p class="item-meta summary-invoices-total">Total das faturas do mês: <strong class="amount-negative">${formatCurrency(invoicesTotal)}</strong></p>`
            : ""
        }
      </section>
    </section>
  `;
}

function billsView() {
  return `
    <section class="app-page">
      <div class="page-hero">
        <div>
          <span class="page-eyebrow">Despesas</span>
          <h1 class="page-title">Lista completa das contas cadastradas.</h1>
          <p class="page-subtitle">Filtre, encontre, marque como pago e mantenha os compromissos do mês sob controle.</p>
        </div>
        <button class="btn-primary" type="button" data-action="add-bill"><i class="fa-solid fa-plus"></i> Nova Conta</button>
      </div>

      <section class="table-shell">
        <div class="filters-grid" id="billFilters">
          <div class="field">
            <label for="billPeriodFilter">Período</label>
            <select id="billPeriodFilter" data-bill-filter="period">
              <option value="all">Todos</option>
              <option value="july">Julho</option>
              <option value="june">Junho</option>
            </select>
          </div>
          <div class="field">
            <label for="billCategoryFilter">Categoria</label>
            <select id="billCategoryFilter" data-bill-filter="category">
              <option value="all">Todas</option>
              <option>Moradia</option>
              <option>Casa</option>
              <option>Saúde</option>
              <option>Lazer</option>
            </select>
          </div>
          <div class="field">
            <label for="billStatusFilter">Status</label>
            <select id="billStatusFilter" data-bill-filter="status">
              <option value="all">Todos</option>
              <option>Pago</option>
              <option>Hoje</option>
              <option>Atrasado</option>
              <option>Pendente</option>
            </select>
          </div>
          <div class="field">
            <label for="billPaymentFilter">Forma de pagamento</label>
            <select id="billPaymentFilter" data-bill-filter="payment">
              <option value="all">Todas</option>
              <option>Pix</option>
              <option>Cartão de Crédito</option>
              <option>Boleto</option>
            </select>
          </div>
          <div class="field">
            <label for="billSearchFilter">Busca</label>
            <input id="billSearchFilter" type="search" data-bill-filter="search" placeholder="Ex.: aluguel">
          </div>
        </div>

        <div class="bills-list" id="billsList"></div>
      </section>
    </section>
  `;
}

function renderBillsList() {
  const list = document.querySelector("#billsList");
  if (!list) return;

  const category =
    document.querySelector("[data-bill-filter='category']")?.value || "all";
  const status =
    document.querySelector("[data-bill-filter='status']")?.value || "all";
  const payment =
    document.querySelector("[data-bill-filter='payment']")?.value || "all";
  const period =
    document.querySelector("[data-bill-filter='period']")?.value || "all";
  const search =
    document
      .querySelector("[data-bill-filter='search']")
      ?.value.toLowerCase() || "";

  const filtered = bills.filter((bill) => {
    const billStatus = getBillStatus(bill).label;
    const month = new Date(bill.dueDate).getMonth();
    const matchesPeriod =
      period === "all" ||
      (period === "july" && month === 6) ||
      (period === "june" && month === 5);
    const matchesCategory = category === "all" || bill.category === category;
    const matchesStatus = status === "all" || billStatus === status;
    const matchesPayment = payment === "all" || bill.payment === payment;
    const matchesSearch = bill.name.toLowerCase().includes(search);

    return (
      matchesPeriod &&
      matchesCategory &&
      matchesStatus &&
      matchesPayment &&
      matchesSearch
    );
  });

  list.innerHTML = filtered.length
    ? filtered.map((bill) => billCard(bill)).join("")
    : `<div class="empty-state"><div><i class="fa-solid fa-file-circle-check"></i><h2 class="font-title-md">Nenhuma conta encontrada</h2><p>Altere os filtros ou cadastre uma nova conta.</p></div></div>`;
}

function cardsView() {
  return `
    <section class="app-page">
      <div class="page-hero">
        <div>
          <span class="page-eyebrow">Cartões</span>
          <h1 class="page-title">Seus cartões organizados em um só lugar.</h1>
          <p class="page-subtitle">Acompanhe limite, vencimento, fechamento e fatura atual sem precisar informar o número completo do cartão.</p>
        </div>
        <button class="btn-primary" type="button" data-action="add-card"><i class="fa-solid fa-plus"></i> Novo Cartão</button>
      </div>

      <div class="cards-grid">${creditCards.map(cardSummary).join("")}</div>
    </section>
  `;
}

function accountsView() {
  const cards = accounts.length
    ? `<div class="cards-grid">${accounts.map(accountSummary).join("")}</div>`
    : `<div class="empty-state">
        <div>
          <i class="fa-solid fa-building-columns"></i>
          <h2 class="font-title-md">Nenhuma conta cadastrada</h2>
          <p>Cadastre onde você guarda seu dinheiro para organizar saldos e movimentações.</p>
          <button class="btn-primary" type="button" data-action="add-account"><i class="fa-solid fa-plus"></i> Nova Conta</button>
        </div>
      </div>`;

  return `
    <section class="app-page">
      <div class="page-hero">
        <div>
          <span class="page-eyebrow">Contas</span>
          <h1 class="page-title">Seu dinheiro organizado em um só lugar.</h1>
          <p class="page-subtitle">Acompanhe onde seu dinheiro está, movimentações, saldo e histórico de forma simples.</p>
        </div>
        <button class="btn-primary" type="button" data-action="add-account"><i class="fa-solid fa-plus"></i> Nova Conta</button>
      </div>

      ${cards}
    </section>
  `;
}

function formatMonthYear(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const label = date.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function invoiceStatusMeta(status) {
  const map = {
    aberta: { label: "Aberta", className: "status-pending" },
    fechada: { label: "Fechada", className: "status-today" },
    atrasada: { label: "Atrasada", className: "status-late" },
    paga: { label: "Paga", className: "status-paid" },
  };
  return map[status] || { label: status || "-", className: "status-pending" };
}

function invoiceCard(invoice) {
  const meta = invoiceStatusMeta(invoice.status);
  const remaining = Math.max(Number(invoice.total) - Number(invoice.paid), 0);
  const isPaid = invoice.status === "paga";
  const canPay = !isPaid && Number(invoice.total) > 0;

  const monthLabel = formatMonthYear(invoice.referenceMonth);

  return `
    <article class="invoice-card" data-invoice-card="${invoice.id}" data-action="select-invoice" data-invoice-id="${invoice.id}" data-month="${monthLabel}" role="button" tabindex="0" title="Ver compras desta fatura">
      <div class="invoice-card-head">
        <div>
          <strong class="invoice-month">${monthLabel}</strong>
          <p class="item-meta">Vencimento ${formatDateLabel(invoice.dueDate)}</p>
        </div>
        <div class="invoice-head-right">
          <span class="status-pill ${meta.className}">${meta.label}</span>
          <span class="invoice-selected-mark"><i class="fa-solid fa-check"></i></span>
        </div>
      </div>
      <div class="invoice-values">
        <div><span>Total</span><strong>${formatCurrency(invoice.total)}</strong></div>
        <div><span>Pago</span><strong class="text-income">${formatCurrency(invoice.paid)}</strong></div>
        <div><span>Restante</span><strong class="${remaining > 0 ? "amount-negative" : ""}">${formatCurrency(remaining)}</strong></div>
      </div>
      ${
        canPay
          ? `<button class="btn-primary invoice-pay-btn" type="button" data-action="pay-invoice" data-invoice-id="${invoice.id}"><i class="fa-solid fa-check"></i> Pagar fatura</button>`
          : isPaid
            ? `<p class="invoice-paid-note"><i class="fa-solid fa-circle-check"></i> Fatura quitada</p>`
            : ""
      }
    </article>
  `;
}

function purchaseRow({ name, category, date, value, meta }) {
  return `
    <div class="history-item">
      <div>
        <strong class="item-title">${name}</strong>
        <p class="item-meta">${category} • ${formatDateLabel(date)}${meta || ""}</p>
      </div>
      <strong class="amount-negative">${formatCurrency(value)}</strong>
    </div>`;
}

function renderPurchasesList(purchases) {
  if (!purchases || !purchases.length) {
    return `<div class="empty-state compact"><div><i class="fa-solid fa-cart-shopping"></i><p>Nenhuma compra registrada neste cartão.</p></div></div>`;
  }
  return `<div class="mini-list">${purchases.map((purchase) => purchaseRow(purchase)).join("")}</div>`;
}

function renderInvoiceItems(items) {
  if (!items || !items.length) {
    return `<div class="empty-state compact"><div><i class="fa-solid fa-receipt"></i><p>Nenhuma compra vinculada a esta fatura.</p></div></div>`;
  }
  return `<div class="mini-list">${items
    .map((item) =>
      purchaseRow({
        name: item.name,
        category: item.category,
        date: item.date,
        value: item.value,
        meta:
          item.installmentsTotal > 1
            ? ` • Parcela ${item.installmentNumber}/${item.installmentsTotal}`
            : "",
      }),
    )
    .join("")}</div>`;
}

function swapPurchasesContent(html) {
  const list = document.querySelector("#purchasesList");
  if (!list) return;
  list.innerHTML = html;
  list.classList.remove("purchases-swap");
  void list.offsetWidth;
  list.classList.add("purchases-swap");
}

function restoreAllPurchases() {
  const title = document.querySelector("#purchasesTitle");
  const countPill = document.querySelector("#purchasesCount");
  const clearBtn = document.querySelector("#purchasesClear");
  const purchases = cardDetailData?.purchases || [];
  if (title) title.textContent = "Compras cadastradas";
  if (countPill)
    countPill.textContent = `${purchases.length} ${purchases.length === 1 ? "compra" : "compras"}`;
  clearBtn?.classList.add("is-hidden");
  swapPurchasesContent(renderPurchasesList(purchases));
}

function cardDetailView() {
  const card = cardDetailData || creditCards[0];
  if (!card) {
    return `
      <section class="app-page">
        <div class="empty-state">
          <div>
            <i class="fa-solid fa-credit-card"></i>
            <h2 class="font-title-md">Nenhum cartão cadastrado</h2>
            <p>Cadastre um cartão para ver os detalhes aqui.</p>
            <button class="btn-primary" type="button" data-action="add-card"><i class="fa-solid fa-plus"></i> Novo Cartão</button>
          </div>
        </div>
      </section>
    `;
  }

  const available = card.totalLimit - card.usedLimit;
  const invoices = (card.invoices || [])
    .slice()
    .sort((a, b) => new Date(b.referenceMonth) - new Date(a.referenceMonth));
  const openTotal = invoices
    .filter((invoice) => invoice.status !== "paga")
    .reduce((sum, invoice) => sum + Math.max(invoice.total - invoice.paid, 0), 0);
  const purchases = card.purchases || [];

  return `
    <section class="app-page">
      <div class="page-hero">
        <div>
          <span class="page-eyebrow">Detalhes do cartão</span>
          <h1 class="page-title">${card.name} ••• ${card.lastDigits}</h1>
          <p class="page-subtitle">${card.notes || "Acompanhe limite, vencimentos e faturas cadastradas neste cartão."}</p>
        </div>
        <div class="hero-actions">
          <button class="btn-secondary" type="button" data-action="edit-card" data-card-id="${card.id}"><i class="fa-solid fa-pen"></i> Editar</button>
          <button class="btn-danger" type="button" data-action="delete-card" data-card-id="${card.id}"><i class="fa-solid fa-trash"></i> Excluir</button>
        </div>
      </div>

      <div class="detail-stat-grid">
        <div class="detail-stat"><span>Banco</span><strong>${card.bank}</strong></div>
        <div class="detail-stat"><span>Últimos 3 números</span><strong>••• ${card.lastDigits}</strong></div>
        <div class="detail-stat"><span>Limite</span><strong>${formatCurrency(card.totalLimit)}</strong></div>
        <div class="detail-stat"><span>Limite disponível</span><strong class="text-income">${formatCurrency(available)}</strong></div>
        <div class="detail-stat"><span>Fechamento</span><strong>Dia ${card.closingDay}</strong></div>
        <div class="detail-stat"><span>Vencimento</span><strong>Dia ${card.dueDay}</strong></div>
        <div class="detail-stat"><span>Fatura Atual</span><strong>${formatCurrency(card.invoiceCurrent)}</strong></div>
        <div class="detail-stat"><span>Em aberto</span><strong class="${openTotal > 0 ? "amount-negative" : ""}">${formatCurrency(openTotal)}</strong></div>
      </div>

      <section class="premium-card">
        <div class="card-title-row">
          <h2>Faturas</h2>
          <span class="pill">${invoices.length} ${invoices.length === 1 ? "fatura" : "faturas"}</span>
        </div>
        ${
          invoices.length
            ? `<div class="invoices-grid">${invoices.map(invoiceCard).join("")}</div>`
            : `<div class="empty-state compact"><div><i class="fa-solid fa-file-invoice-dollar"></i><p>Nenhuma fatura gerada ainda. Faça uma compra neste cartão para gerar a primeira fatura.</p></div></div>`
        }
      </section>

      <section class="premium-card">
        <div class="card-title-row">
          <h2 id="purchasesTitle">Compras cadastradas</h2>
          <div class="purchases-head-right">
            <button class="purchases-clear is-hidden" id="purchasesClear" type="button" data-action="clear-invoice-filter"><i class="fa-solid fa-xmark"></i> Ver todas</button>
            <span class="pill" id="purchasesCount">${purchases.length} ${purchases.length === 1 ? "compra" : "compras"}</span>
          </div>
        </div>
        <div id="purchasesList">${renderPurchasesList(purchases)}</div>
      </section>
    </section>
  `;
}

const MOVEMENT_TYPE_LABELS = {
  receita: "Receita",
  despesa: "Despesa",
  transferencia: "Transferência",
  pagamento_fatura: "Pagamento de fatura",
  compra_parcelada: "Compra no cartão",
  recorrencia: "Recorrência",
};

function movementTypeLabel(type) {
  return MOVEMENT_TYPE_LABELS[type] || "Movimentação";
}

function accountMovementRow(movement) {
  const amountClass =
    movement.flow === "in" ? "amount-positive" : "amount-negative";

  return `
    <div class="history-item">
      <div>
        <strong class="item-title">${movement.description}</strong>
        <p class="item-meta">${movement.category || movementTypeLabel(movement.type)} • ${formatDateLabel(movement.date)}</p>
      </div>
      <strong class="${amountClass}">${formatCurrency(movement.value)}</strong>
    </div>`;
}

function accountDetailView() {
  const account = accountDetailData;
  if (!account) {
    return `
      <section class="app-page">
        <div class="empty-state">
          <div>
            <i class="fa-solid fa-building-columns"></i>
            <h2 class="font-title-md">Conta não encontrada</h2>
            <p>Selecione uma conta na lista para ver os detalhes.</p>
            <a class="btn-primary" href="#contas-bancos"><i class="fa-solid fa-arrow-left"></i> Voltar para Minhas Contas</a>
          </div>
        </div>
      </section>
    `;
  }

  const income = Number(account.monthIncome || 0);
  const expenses = Number(account.monthExpenses || 0);
  const flow = income - expenses;
  const maxValue = Math.max(income, expenses, Math.abs(flow), 1);
  const barHeight = (value) =>
    Math.max(Math.round((Math.abs(value) / maxValue) * 88), 6);
  const movements = account.movements || [];
  const icon = resolveIcon(account.icon, "fa-building-columns");

  return `
    <section class="app-page">
      <div class="page-hero">
        <div>
          <span class="page-eyebrow"><i class="fa-solid ${icon}"></i> Detalhes da conta</span>
          <h1 class="page-title">${account.name}</h1>
          <p class="page-subtitle">${account.notes || `${accountTypeLabel(account.type)}${account.institution ? ` • ${account.institution}` : ""}`}</p>
        </div>
        <div class="hero-actions">
          <button class="btn-secondary" type="button" data-action="edit-account" data-account-id="${account.id}"><i class="fa-solid fa-pen"></i> Editar</button>
          <button class="btn-danger" type="button" data-action="remove-account" data-account-id="${account.id}"><i class="fa-solid fa-trash"></i> Excluir</button>
        </div>
      </div>

      <div class="detail-stat-grid">
        <div class="detail-stat"><span>Instituição</span><strong>${account.institution || "-"}</strong></div>
        <div class="detail-stat"><span>Tipo</span><strong>${accountTypeLabel(account.type)}</strong></div>
        <div class="detail-stat"><span>Saldo Atual</span><strong>${formatCurrency(account.balance)}</strong></div>
        <div class="detail-stat"><span>Receitas do mês</span><strong class="text-income">${formatCurrency(income)}</strong></div>
        <div class="detail-stat"><span>Despesas do mês</span><strong class="text-expense">${formatCurrency(expenses)}</strong></div>
        <div class="detail-stat"><span>Última movimentação</span><strong>${relativeDayLabel(account.lastMovement)}</strong></div>
        <div class="detail-stat"><span>Movimentações</span><strong>${account.movementsCount || movements.length}</strong></div>
        <div class="detail-stat"><span>Fluxo do mês</span><strong class="${flow >= 0 ? "text-income" : "text-expense"}">${formatCurrency(flow)}</strong></div>
      </div>

      <div class="wealth-grid">
        <section class="chart-card">
          <div class="card-title-row">
            <h2>Fluxo do mês</h2>
            <span class="pill">${formatCurrency(flow)}</span>
          </div>
          <div class="bar-chart" aria-label="Entradas, saídas e fluxo de caixa do mês">
            <span style="height: ${barHeight(income)}%" data-label="Entradas"></span>
            <span style="height: ${barHeight(expenses)}%" data-label="Saídas"></span>
            <span style="height: ${barHeight(flow)}%" data-label="Fluxo"></span>
          </div>
          <div class="mini-list patrimony-breakdown">
            <div class="history-item"><span>Entradas</span><strong class="text-income">${formatCurrency(income)}</strong></div>
            <div class="history-item"><span>Saídas</span><strong class="text-expense">${formatCurrency(expenses)}</strong></div>
            <div class="history-item"><span>Fluxo de caixa</span><strong class="${flow >= 0 ? "text-income" : "text-expense"}">${formatCurrency(flow)}</strong></div>
          </div>
        </section>

        <section class="premium-card">
          <div class="card-title-row">
            <h2>Histórico completo</h2>
            <span class="pill">${movements.length} ${movements.length === 1 ? "movimentação" : "movimentações"}</span>
          </div>
          ${
            movements.length
              ? `<div class="mini-list">${movements.map(accountMovementRow).join("")}</div>`
              : `<div class="empty-state compact"><div><i class="fa-solid fa-receipt"></i><p>Nenhuma movimentação registrada nesta conta ainda.</p></div></div>`
          }
        </section>
      </div>
    </section>
  `;
}

function wealthView() {
  const cashTotal = accounts.reduce((sum, account) => sum + account.balance, 0);
  const investmentsTotal = investments.reduce(
    (sum, investment) => sum + investment.current,
    0,
  );
  const invested = investments.reduce(
    (sum, investment) => sum + investment.invested,
    0,
  );
  const availableCredit = creditCards.reduce(
    (sum, card) => sum + (card.totalLimit - card.usedLimit),
    0,
  );
  const usedCredit = creditCards.reduce((sum, card) => sum + card.usedLimit, 0);
  const totalPatrimony = cashTotal + investmentsTotal;
  const purchasePower = cashTotal + availableCredit;
  const rates = portfolioSummary?.rates || {};
  const intelligenceBlock = renderPortfolioHighlights(portfolioSummary);
  const projectionBlock = renderPortfolioProjectionBlock(
    portfolioSummary?.portfolioProjection,
  );

  return `
    <section class="app-page">
      <div class="page-hero">
        <div>
          <span class="page-eyebrow">Patrimônio</span>
          <h1 class="page-title">Sua carteira financeira completa.</h1>
          <p class="page-subtitle">Acompanhe dinheiro em conta, reserva, limite disponível nos cartões e investimentos em uma visão única do seu patrimônio.</p>
        </div>
        <button class="btn-primary" type="button" data-action="add-investment"><i class="fa-solid fa-plus"></i> Adicionar investimento</button>
      </div>

      <div class="metrics-grid">
        ${metricCard("Patrimônio real", formatCurrency(totalPatrimony), "fa-gem", "Contas + investimentos")}
        ${metricCard("Dinheiro disponível", formatCurrency(cashTotal), "fa-wallet", "Saldo em contas e carteira", "income")}
        ${metricCard("Limite disponível", formatCurrency(availableCredit), "fa-credit-card", `${formatCurrency(usedCredit)} já utilizado`)}
        ${metricCard("Investimentos", formatCurrency(investmentsTotal), "fa-chart-line", `${investments.length} ativos acompanhados`)}
      </div>

      ${Object.keys(rates).length ? renderEconomicRatesStrip(rates) : ""}

      <div class="wealth-grid">
        <section class="premium-card">
          <div class="card-title-row">
            <h2>Dinheiro em contas</h2>
            <span class="pill">${formatCurrency(cashTotal)}</span>
          </div>
          <div class="financial-grid">
            ${accounts
              .map(
                (account) => `
                  <article class="financial-card">
                    <div class="investment-head">
                      <div class="item-left">
                        <span class="item-icon ${account.color}"><i class="fa-solid ${account.icon}"></i></span>
                        <div>
                          <h3 class="item-title">${account.name}</h3>
                          <p class="item-meta">${account.type}</p>
                        </div>
                      </div>
                    </div>
                    <strong class="investment-value">${formatCurrency(account.balance)}</strong>
                  </article>
                `,
              )
              .join("")}
          </div>
        </section>

        <section class="chart-card">
          <div class="card-title-row">
            <h2>Cartões de crédito</h2>
            <span class="pill">${formatCurrency(availableCredit)} livre</span>
          </div>
          <div class="mini-list">
            ${creditCards
              .map((card) => {
                const available = card.totalLimit - card.usedLimit;
                const usedPercent = Math.round(
                  (card.usedLimit / card.totalLimit) * 100,
                );

                return `
                  <article class="credit-card-summary">
                    <div class="card-title-row">
                      <div class="item-left">
                        <span class="item-icon"><i class="fa-solid ${card.icon}"></i></span>
                        <div>
                          <h3 class="item-title">${card.name}</h3>
                          <p class="item-meta">Fecha dia ${card.closingDay} • vence dia ${card.dueDay}</p>
                        </div>
                      </div>
                      <strong>${formatCurrency(available)}</strong>
                    </div>
                    <div class="progress-bar">
                      <div class="progress credit-progress" style="--progress-width: ${usedPercent}%"></div>
                    </div>
                    <p class="item-meta">${formatCurrency(card.usedLimit)} usado de ${formatCurrency(card.totalLimit)}</p>
                  </article>
                `;
              })
              .join("")}
          </div>
        </section>
      </div>

      <div class="wealth-grid">
        <section class="premium-card">
          <div class="card-title-row">
            <h2>Investimentos</h2>
            <span class="pill">${formatCurrency(investmentsTotal)}</span>
          </div>
          <div class="investments-grid">${investments.map((investment) => investmentCard(investment)).join("")}</div>
        </section>

        <section class="chart-card">
          <div class="card-title-row">
            <h2>Composição geral</h2>
            <span class="pill">${formatCurrency(totalPatrimony)}</span>
          </div>
          <div class="bar-chart">
            <span style="height: ${Math.max(Math.round((cashTotal / totalPatrimony) * 88), 18)}%" data-label="Contas"></span>
            <span style="height: ${Math.max(Math.round((investmentsTotal / totalPatrimony) * 88), 18)}%" data-label="Invest."></span>
            <span style="height: ${Math.max(Math.round((availableCredit / purchasePower) * 88), 18)}%" data-label="Limite"></span>
          </div>
          <div class="mini-list patrimony-breakdown">
            <div class="history-item"><span>Patrimônio real</span><strong>${formatCurrency(totalPatrimony)}</strong></div>
            <div class="history-item"><span>Poder de compra com limite</span><strong>${formatCurrency(purchasePower)}</strong></div>
            <div class="history-item"><span>Lucro nos investimentos</span><strong class="${investmentsTotal - invested >= 0 ? "text-income" : "text-expense"}">${formatCurrency(investmentsTotal - invested)}</strong></div>
          </div>
        </section>
      </div>

      ${
        intelligenceBlock || projectionBlock
          ? `<div class="wealth-grid">${intelligenceBlock}${projectionBlock}</div>`
          : ""
      }
    </section>
  `;
}

function investmentDetailView() {
  if (!investments.length) {
    return `
      <section class="app-page">
        <div class="page-hero">
          <div>
            <span class="page-eyebrow">Detalhes</span>
            <h1 class="page-title">Nenhum investimento encontrado.</h1>
            <p class="page-subtitle">Assim que os dados forem carregados da API, ou um novo investimento for cadastrado, os detalhes aparecerão aqui.</p>
          </div>
          <button class="btn-primary" type="button" data-action="add-investment"><i class="fa-solid fa-plus"></i> Novo investimento</button>
        </div>
      </section>
    `;
  }

  const totalCurrent = investments.reduce(
    (sum, investment) => sum + investment.current,
    0,
  );
  const totalInvested = investments.reduce(
    (sum, investment) => sum + investment.invested,
    0,
  );
  const totalProfit = totalCurrent - totalInvested;
  const averageReturn = investments.length
    ? Math.round(
        investments.reduce(
          (sum, investment) => sum + investment.returnRate,
          0,
        ) / investments.length,
      )
    : 0;
  const highestInvestment = investments.reduce(
    (highest, investment) =>
      investment.current > highest.current ? investment : highest,
    investments[0],
  );

  return `
    <section class="app-page">
      <div class="page-hero">
        <div>
          <span class="page-eyebrow">Detalhes</span>
          <h1 class="page-title">Todos os investimentos em detalhes.</h1>
          <p class="page-subtitle">Projeções de renda fixa e indicadores de mercado para renda variável, sem previsão de preço futuro.</p>
        </div>
        <div class="hero-actions">
          <button class="btn-primary" type="button" data-action="add-investment"><i class="fa-solid fa-plus"></i> Novo investimento</button>
          <a class="btn-secondary" href="#patrimonio"><i class="fa-solid fa-wallet"></i> Ver carteira</a>
        </div>
      </div>

      <div class="detail-stat-grid">
        <div class="detail-stat"><span>Total investido</span><strong>${formatCurrency(totalInvested)}</strong></div>
        <div class="detail-stat"><span>Valor atual</span><strong>${formatCurrency(totalCurrent)}</strong></div>
        <div class="detail-stat"><span>Resultado</span><strong class="${totalProfit >= 0 ? "text-income" : "text-expense"}">${formatCurrency(totalProfit)}</strong></div>
        <div class="detail-stat"><span>Rentabilidade média</span><strong class="${averageReturn >= 0 ? "text-income" : "text-expense"}">${averageReturn >= 0 ? "+" : ""}${averageReturn}%</strong></div>
        <div class="detail-stat"><span>Investimentos</span><strong>${investments.length}</strong></div>
        <div class="detail-stat"><span>Maior posição</span><strong>${highestInvestment.name}</strong></div>
      </div>

      <div class="investment-detail-list">
        ${investments
          .map((investment) => {
            const profit = investment.current - investment.invested;
            const returnClass = profit >= 0 ? "text-income" : "text-expense";
            const simulation = investment.simulation;
            const isFixed = simulation?.kind === "fixed_income";
            const isVariable = simulation?.kind === "variable_income";

            return `
              <section class="premium-card investment-detail-card">
                <div class="card-title-row">
                  <div class="item-left">
                    <span class="investment-icon">${investment.icon}</span>
                    <div>
                      <h2 class="item-title">${investment.name}</h2>
                      <p class="item-meta">${investment.category}${investment.assetCode ? ` · ${investment.assetCode}` : ""} · ${investment.institution}</p>
                    </div>
                  </div>
                  <div class="detail-investment-values">
                    <strong>${formatCurrency(investment.current)}</strong>
                    <span class="${returnClass}">${profit >= 0 ? "+" : ""}${formatCurrency(profit)} · ${investment.returnRate >= 0 ? "+" : ""}${investment.returnRate}%</span>
                  </div>
                </div>

                <div class="detail-stat-grid">
                  <div class="detail-stat"><span>Investido</span><strong>${formatCurrency(investment.invested)}</strong></div>
                  <div class="detail-stat"><span>Atual</span><strong>${formatCurrency(investment.current)}</strong></div>
                  <div class="detail-stat"><span>Tipo</span><strong>${investment.investmentType || "—"}</strong></div>
                  <div class="detail-stat"><span>Qtd.</span><strong>${investment.quantity ?? "—"}</strong></div>
                </div>

                ${isFixed ? renderFixedSimulationBlock(simulation) : ""}
                ${isVariable ? renderVariableMarketBlock(simulation, investment.id) : ""}

                <div class="new-expense-actions" style="margin-top:1rem">
                  <button class="expense-secondary-btn" type="button" data-action="edit-investment" data-investment-id="${investment.id}">
                    <i class="fa-solid fa-pen"></i> Editar
                  </button>
                  <button class="expense-secondary-btn" type="button" data-action="delete-investment" data-investment-id="${investment.id}">
                    <i class="fa-solid fa-trash"></i> Excluir
                  </button>
                </div>
              </section>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function mountInvestmentDetailCharts() {
  investments.forEach((investment) => {
    const history = investment.simulation?.market?.history || [];
    if (!history.length) return;
    const el = document.querySelector(`#market-chart-${investment.id}`);
    if (!el) return;

    const recent = history.slice(-90);
    mountChart(
      el,
      chartService.areaChart({
        categories: recent.map((item) =>
          String(item.date).slice(5).replace("-", "/"),
        ),
        series: [
          {
            name: investment.assetCode || investment.name,
            data: recent.map((item) => Number(item.price) || 0),
          },
        ],
        height: 240,
      }),
    );
  });
}

function goalsView() {
  return `
    <section class="app-page">
      <div class="page-hero">
        <div>
          <span class="page-eyebrow">Metas financeiras</span>
          <h1 class="page-title">Objetivos claros motivam escolhas melhores.</h1>
          <p class="page-subtitle">Cada meta mostra valor desejado, valor atual, progresso e data prevista em cards fáceis de acompanhar.</p>
        </div>
        <button class="btn-primary" type="button" data-action="add-goal"><i class="fa-solid fa-plus"></i> Adicionar meta</button>
      </div>

      <div class="goals-page-grid">${goals.map(goalCard).join("")}</div>
    </section>
  `;
}

function profileView() {
  return renderProfilePage({
    user: currentUser,
    personalization: personalizationContext,
  });
}

function adminView() {
  return renderAdminPage();
}

function isAdminUser(user = currentUser) {
  return user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
}

async function renderRoute() {
  const route = getRoute();
  const viewRoute = route === "investimento-novo" ? "patrimonio" : route;
  setActiveRoute(viewRoute);

  if (viewRoute === "admin" && !isAdminUser()) {
    window.location.hash = "#dashboard";
    showToast("Acesso restrito a administradores.");
    return;
  }

  if (isAnalyticsDashboardRoute(viewRoute)) {
    await renderAnalyticsDashboardPage(route);
    return;
  }

  destroyAllCharts();
  app.innerHTML = `
    <section class="app-page">
      <div class="skeleton"></div>
      <div class="skeleton"></div>
    </section>
  `;

  await loadRouteData(route);

  if (viewRoute === "perfil" && !personalizationContext) {
    personalizationContext = await personalizationService
      .getContext()
      .catch(() => null);
  }

  if (viewRoute === "cartao-detalhe") {
    if (!bootstrapReady) await loadBootstrap();
    const cardId = selectedCardId || creditCards[0]?.id || null;
    cardDetailData = cardId
      ? await cardsService.detail(cardId).catch(() => null)
      : null;
  }

  if (viewRoute === "conta-detalhe") {
    if (!bootstrapReady) await loadBootstrap();
    const accountId = selectedAccountId || accounts[0]?.id || null;
    accountDetailData = accountId
      ? await accountsService.detail(accountId).catch(() => null)
      : null;
  }

  const views = {
    dashboard: dashboardView,
    transacoes: transactionsView,
    patrimonio: wealthView,
    "investimento-detalhe": investmentDetailView,
    "contas-resumo": billsSummaryView,
    "contas-bancos": accountsView,
    "contas-despesas": billsView,
    "contas-cartoes": cardsView,
    "cartao-detalhe": cardDetailView,
    "conta-detalhe": accountDetailView,
    metas: goalsView,
    perfil: profileView,
    admin: adminView,
  };

  app.innerHTML = views[viewRoute]();

  if (viewRoute === "perfil") {
    bindProfilePage(app, {
      showToast,
      onSaved: async () => {
        personalizationContext = await personalizationService
          .getContext()
          .catch(() => personalizationContext);
        bootstrapReady = false;
        await reloadAndRender();
      },
    });
  }

  if (viewRoute === "admin") {
    bindAdminPage(app, {
      showToast,
      currentUser,
    });
  }

  if (viewRoute === "investimento-detalhe") {
    mountInvestmentDetailCharts();
  }

  if (viewRoute === "transacoes") renderTransactionsTable();
  if (viewRoute === "contas-despesas") renderBillsList();
  initCustomSelects(app);
  if (route === "investimento-novo") openInvestmentModal();
}

document.addEventListener("input", (event) => {
  if (event.target.closest("#transactionFilters")) renderTransactionsTable();
  if (event.target.closest("#billFilters")) renderBillsList();
  if (event.target.matches("#cardColor"))
    updateCardColorPreview(event.target.value);
  if (event.target.matches("#accountColor"))
    updateAccountColorPreview(event.target.value);
});

document.addEventListener("change", (event) => {
  if (event.target.closest("#transactionFilters")) renderTransactionsTable();
  if (event.target.closest("#billFilters")) renderBillsList();
  if (
    event.target.matches("#investmentType") ||
    event.target.closest("#investmentForm")
  ) {
    syncInvestmentFormFields(investmentForm);
    scheduleInvestmentSimulation();
  }
});

document.addEventListener("input", (event) => {
  if (event.target.closest("#investmentForm")) {
    scheduleInvestmentSimulation();
  }
});

document.addEventListener("submit", async (event) => {
  if (event.target.matches("#expenseForm")) {
    event.preventDefault();
    await addExpenseFromForm();
    return;
  }

  if (event.target.matches("#investmentForm")) {
    event.preventDefault();
    await addInvestmentFromForm();
    return;
  }

  if (event.target.matches("#billForm")) {
    event.preventDefault();
    await addBillFromForm();
    return;
  }

  if (event.target.matches("#cardForm")) {
    event.preventDefault();
    await addCardFromForm();
    return;
  }

  if (event.target.matches("#accountForm")) {
    event.preventDefault();
    await addAccountFromForm();
  }
});

document.addEventListener("click", async (event) => {
  if (event.target === expenseModal) {
    closeExpenseDialog();
    return;
  }

  if (event.target.closest("#closeExpenseModal")) {
    closeExpenseDialog();
    return;
  }

  if (event.target.closest("#cancelExpenseForm")) {
    closeExpenseDialog({ reset: true });
    return;
  }

  if (event.target === investmentModal) {
    closeInvestmentDialog();
    return;
  }

  if (event.target.closest("#closeInvestmentModal")) {
    closeInvestmentDialog();
    return;
  }

  if (event.target.closest("#cancelInvestmentForm")) {
    closeInvestmentDialog({ reset: true });
    return;
  }

  if (event.target === billModal) {
    closeBillDialog();
    return;
  }

  if (event.target.closest("#closeBillModal")) {
    closeBillDialog();
    return;
  }

  if (event.target.closest("#cancelBillForm")) {
    closeBillDialog({ reset: true });
    return;
  }

  if (event.target === cardModal) {
    closeCardDialog();
    return;
  }

  if (event.target.closest("#closeCardModal")) {
    closeCardDialog();
    return;
  }

  if (event.target.closest("#cancelCardForm")) {
    closeCardDialog({ reset: true });
    return;
  }

  if (event.target === accountModal) {
    closeAccountDialog();
    return;
  }

  if (event.target.closest("#closeAccountModal")) {
    closeAccountDialog();
    return;
  }

  if (event.target.closest("#cancelAccountForm")) {
    closeAccountDialog({ reset: true });
    return;
  }

  const accountIconOption = event.target.closest("[data-account-icon]");
  if (accountIconOption) {
    setAccountIcon(accountIconOption.dataset.accountIcon);
    return;
  }

  const quickAdd = event.target.closest("[data-quick-add]")?.dataset.quickAdd;
  if (quickAdd === "expense") {
    openExpenseModal();
    return;
  }

  if (quickAdd === "investment") {
    openInvestmentModal();
    return;
  }

  if (quickAdd === "bill") {
    openBillModal();
    return;
  }

  if (quickAdd === "card") {
    openCardModal();
    return;
  }

  if (
    quickActionMenu &&
    !quickActionMenu.classList.contains("is-hidden") &&
    !event.target.closest("#quickActionMenu") &&
    !event.target.closest("#quickAction")
  ) {
    closeQuickActionMenu();
  }

  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;

  if (action === "toggle-investments-menu") {
    toggleInvestmentsMenu();
    return;
  }

  if (action === "toggle-accounts-menu") {
    toggleAccountsMenu();
    return;
  }

  if (action === "toggle-dashboards-menu") {
    toggleDashboardsMenu();
    return;
  }

  if (action === "logout") {
    await window.finsightLogout?.();
    return;
  }

  if (action === "dashboard-period") {
    const period = event.target.closest("[data-period]")?.dataset.period;
    if (period) await reloadDashboardWithPeriod(period);
    return;
  }

  if (action === "retry-dashboard") {
    analyticsDashboardData = null;
    await renderAnalyticsDashboardPage(currentAnalyticsRoute);
    return;
  }

  if (action === "add-bill") {
    movementModal.openType("conta");
    return;
  }

  if (action === "add-card") {
    openCardModal();
    return;
  }

  if (action === "view-card") {
    selectedCardId =
      event.target.closest("[data-card-id]")?.dataset.cardId || null;
    window.location.hash = "cartao-detalhe";
    return;
  }

  if (action === "select-invoice") {
    const invoiceId = event.target.closest("[data-invoice-id]")?.dataset
      .invoiceId;
    if (!invoiceId) return;
    const card = document.querySelector(`[data-invoice-card="${invoiceId}"]`);
    const wasSelected = card?.classList.contains("is-selected");

    document
      .querySelectorAll(".invoice-card.is-selected")
      .forEach((el) => el.classList.remove("is-selected"));

    if (wasSelected) {
      restoreAllPurchases();
      return;
    }

    card?.classList.add("is-selected");
    const title = document.querySelector("#purchasesTitle");
    const countPill = document.querySelector("#purchasesCount");
    const clearBtn = document.querySelector("#purchasesClear");
    if (title) title.textContent = `Compras • ${card?.dataset.month || "fatura"}`;
    clearBtn?.classList.remove("is-hidden");
    swapPurchasesContent(
      `<div class="empty-state compact"><div><i class="fa-solid fa-spinner fa-spin"></i><p>Carregando compras da fatura...</p></div></div>`,
    );

    try {
      const items = await invoicesService.items(invoiceId);
      if (countPill)
        countPill.textContent = `${items.length} ${items.length === 1 ? "compra" : "compras"}`;
      swapPurchasesContent(renderInvoiceItems(items));
    } catch (error) {
      swapPurchasesContent(
        `<p class="invoice-items-empty">${error?.message || "Não foi possível carregar as compras."}</p>`,
      );
    }
    return;
  }

  if (action === "clear-invoice-filter") {
    document
      .querySelectorAll(".invoice-card.is-selected")
      .forEach((el) => el.classList.remove("is-selected"));
    restoreAllPurchases();
    return;
  }

  if (action === "pay-invoice") {
    const invoiceId = event.target.closest("[data-invoice-id]")?.dataset
      .invoiceId;
    if (!invoiceId) return;
    const confirmed = await confirmDialog({
      title: "Pagar fatura",
      message:
        "Todas as parcelas desta fatura serão marcadas como pagas e o limite do cartão será restaurado.",
      confirmText: "Pagar fatura",
      tone: "primary",
      icon: "fa-circle-check",
    });
    if (confirmed) {
      try {
        await invoicesService.pay(invoiceId);
        showToast("Fatura paga com sucesso.");
        await reloadAndRender();
      } catch (error) {
        showToast(error?.message || "Não foi possível pagar a fatura.");
      }
    }
    return;
  }

  if (action === "toggle-bill-paid") {
    const billId = event.target.closest("[data-bill-id]")?.dataset.billId;
    const bill = bills.find((item) => String(item.id) === String(billId));
    if (bill) {
      const nextPaid = !bill.paid;
      await billsService.markPaid(bill.id, nextPaid);
      showToast(
        nextPaid ? "Conta marcada como paga." : "Conta voltou para pendente.",
      );
      await reloadAndRender();
    }
    return;
  }

  if (action === "delete-bill") {
    const confirmed = await confirmDialog({
      title: "Excluir conta",
      message: "Tem certeza que deseja excluir esta conta? Essa ação não pode ser desfeita.",
      confirmText: "Excluir",
    });
    if (confirmed) {
      const billId = event.target.closest("[data-bill-id]")?.dataset.billId;
      await billsService.remove(billId);
      showToast("Conta excluída com segurança.");
      await reloadAndRender();
    }
    return;
  }

  if (action === "delete-card") {
    const confirmed = await confirmDialog({
      title: "Excluir cartão",
      message: "Tem certeza que deseja excluir este cartão? Faturas e compras vinculadas serão perdidas.",
      confirmText: "Excluir",
    });
    if (confirmed) {
      const cardId = event.target.closest("[data-card-id]")?.dataset.cardId;
      await cardsService.remove(cardId);
      showToast("Cartão excluído com segurança.");
      await reloadAndRender();
    }
    return;
  }

  if (action === "add-account") {
    openAccountModal();
    return;
  }

  if (action === "view-account") {
    selectedAccountId =
      event.target.closest("[data-account-id]")?.dataset.accountId || null;
    window.location.hash = "conta-detalhe";
    return;
  }

  if (action === "edit-account") {
    const accountId = event.target.closest("[data-account-id]")?.dataset
      .accountId;
    const account = accounts.find(
      (item) => String(item.id) === String(accountId),
    );
    if (account) openAccountModal(account);
    return;
  }

  if (action === "remove-account") {
    const accountId = event.target.closest("[data-account-id]")?.dataset
      .accountId;
    const account = accounts.find(
      (item) => String(item.id) === String(accountId),
    );
    const confirmed = await confirmDialog({
      title: "Excluir conta",
      message: `Tem certeza que deseja excluir ${account?.name ? `a conta "${account.name}"` : "esta conta"}? Essa ação não pode ser desfeita.`,
      confirmText: "Excluir",
    });
    if (confirmed) {
      try {
        await accountsService.remove(accountId);
        showToast("Conta excluída com segurança.");
        if (String(selectedAccountId) === String(accountId)) {
          selectedAccountId = null;
          accountDetailData = null;
        }
        if (getRoute() === "conta-detalhe") {
          await reloadAndRender();
          window.location.hash = "contas-bancos";
        } else {
          await reloadAndRender();
        }
      } catch (error) {
        showToast(error?.message || "Não foi possível excluir a conta.");
      }
    }
    return;
  }

  if (action === "edit-transaction") {
    const transactionId = event.target.closest("[data-transaction-id]")?.dataset
      .transactionId;
    const transaction = transactions.find(
      (item) => String(item.id) === String(transactionId),
    );
    if (transaction) movementModal.openEdit(transaction);
    return;
  }

  if (action === "edit-investment") {
    const investmentId = event.target.closest("[data-investment-id]")?.dataset
      .investmentId;
    const investment = investments.find(
      (item) => String(item.id) === String(investmentId),
    );
    if (investment) openInvestmentModal(investment);
    return;
  }

  if (action === "edit-bill") {
    const billId = event.target.closest("[data-bill-id]")?.dataset.billId;
    const bill = bills.find((item) => String(item.id) === String(billId));
    if (bill) movementModal.openEdit(bill, "conta");
    return;
  }

  if (action === "edit-card") {
    const cardId = event.target.closest("[data-card-id]")?.dataset.cardId;
    const card = creditCards.find((item) => String(item.id) === String(cardId));
    if (card) openCardModal(card);
    return;
  }

  if (action === "open-transaction-actions") {
    showToast("As ações desta transação ainda serão habilitadas.");
    return;
  }

  if (action === "save-profile") {
    return;
  }

  if (action === "change-password") {
    showToast("Alteração de senha ficará para a etapa de autenticação.");
    return;
  }

  if (action === "delete-investment") {
    const investmentId =
      event.target.closest("[data-investment-id]")?.dataset.investmentId;
    const confirmed = await confirmDialog({
      title: "Excluir investimento",
      message:
        "Tem certeza que deseja excluir este investimento? Essa ação não pode ser desfeita.",
      confirmText: "Excluir",
    });
    if (!confirmed || !investmentId) return;

    try {
      await investmentsService.remove(investmentId);
      showToast("Investimento excluído com sucesso.");
      await reloadAndRender();
    } catch (error) {
      showToast(error?.message || "Não foi possível excluir o investimento.");
    }
    return;
  }

  if (action === "delete-account") {
    const confirmed = await confirmDialog({
      title: "Excluir conta",
      message: "Tem certeza que deseja excluir sua conta? Essa ação é permanente e exige confirmação.",
      confirmText: "Excluir conta",
    });
    if (confirmed) showToast("Solicitação de exclusão registrada.");
    return;
  }

  if (action === "add-transaction") {
    movementModal.open();
    return;
  }

  if (action === "add-investment") {
    openInvestmentModal();
    return;
  }

  if (action === "add-goal") {
    showToast("Nova meta pronta para cadastro.");
    return;
  }
});

const movementModal = createMovementModal({
  getAccounts: () => accounts,
  getCards: () => creditCards,
  onSaved: async (message) => {
    showToast(message);
    await reloadAndRender();
  },
  showToast,
});

const onboardingWizard = createOnboardingWizard({
  getAccounts: () => accounts,
  showToast,
  onComplete: async () => {
    bootstrapReady = false;
    loadedRouteKey = null;
    await reloadAndRender();
  },
  onSkip: () => {},
});

// Expõe para testes / reabertura manual: onboardingWizard.open({ force: true })
window.onboardingWizard = onboardingWizard;

quickAction.addEventListener("click", () => {
  movementModal.open();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeAllCustomCalendars();
    closeQuickActionMenu();
  }

  if (event.key === "Escape" && !expenseModal?.classList.contains("isHidden")) {
    closeExpenseDialog();
  }

  if (
    event.key === "Escape" &&
    !investmentModal?.classList.contains("isHidden")
  ) {
    closeInvestmentDialog();
  }

  if (event.key === "Escape" && !billModal?.classList.contains("isHidden")) {
    closeBillDialog();
  }

  if (event.key === "Escape" && !cardModal?.classList.contains("isHidden")) {
    closeCardDialog();
  }

  if (event.key === "Escape" && !accountModal?.classList.contains("isHidden")) {
    closeAccountDialog();
  }
});

setupCustomSelects();
setupCustomCalendars();
window.addEventListener("hashchange", renderRoute);

async function bootApp() {
  const user = await ensureAuthenticated(async (authenticatedUser) => {
    applyAuthenticatedUser(authenticatedUser);
    document.body.classList.remove("is-auth-screen");
    await renderRoute();
    const forceOnboarding = window.location.hash === "#onboarding";
    if (forceOnboarding) {
      onboardingWizard.open({ force: true });
      return;
    }
    onboardingWizard.maybeOpen();
  });

  if (!user) {
    document.body.classList.add("is-auth-screen");
  }
}

function applyAuthenticatedUser(user) {
  if (!user) return;
  currentUser = user;
  const profileLabel = document.querySelector(".profile span:first-child");
  const profilePicture = document.querySelector(".profile-picture");
  const firstName = String(user.name || "").split(" ")[0] || "Usuario";
  if (profileLabel) profileLabel.textContent = `Ola, ${firstName}!`;
  if (profilePicture) {
    profilePicture.textContent = firstName.slice(0, 2).toUpperCase();
  }
  document.querySelectorAll(".admin-only-nav").forEach((el) => {
    el.classList.toggle("is-hidden", !isAdminUser(user));
  });
  window.__finsightUser = user;
}

bootApp();

window.addEventListener("finsight:session-expired", () => {
  if (document.body.classList.contains("is-auth-screen")) return;
  window.finsightLogout?.();
});

window.finsightLogout = async () => {
  try {
    await authApi.logout();
  } catch {
    /* ignore */
  }
  window.location.reload();
};
