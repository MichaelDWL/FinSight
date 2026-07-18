import { accountsService } from "../services/accounts.js";
import { billsService } from "../services/bills.js";
import { cardsService } from "../services/cards.js";
import { bootstrapService } from "../services/bootstrap.js";
import { investmentsService } from "../services/investments.js";
import { usersService } from "../services/users.js";
import { transactionsService } from "../services/transactions.js";
import { invoicesService } from "../services/invoices.js";
import { bffService } from "../services/bff.js";
import { privacyService } from "../services/privacy.js";
import { escapeHtml } from "../utils/dom.js";
import { formatCurrency } from "../utils/currency.js";
import {
  formatDateLabel,
  toIsoDate,
  getIsoDateValue,
} from "../utils/dates.js";
import { resolveIcon } from "../utils/icons.js";
import { mapPaymentMethod, mapPaymentLabel } from "../utils/payment.js";
import {
  normalizeTransaction,
  normalizeInvestment,
  normalizeGoal,
  normalizeBill,
  normalizeCardLastDigits,
} from "../utils/normalize.js";
import { routeTitles, getRoute } from "./router.js";
import { store } from "./store.js";
import { bindAppEvents } from "./events.js";
import {
  render as renderTransactionsPage,
  renderTable as renderTransactionsTableView,
} from "../modules/transactions/render.js";
import * as accountsModule from "../modules/accounts/render.js";
import * as cardsModule from "../modules/cards/render.js";
import * as investmentsModule from "../modules/investments/render.js";
import * as goalsModule from "../modules/goals/render.js";

import { destroyAllCharts } from "../components/charts/ChartWrapper.js";
import { renderDashboardSkeleton } from "../modules/dashboard/shared/DashboardSkeleton.js";
import {
  mountGeneralDashboardCharts,
  renderGeneralDashboard,
} from "../modules/dashboard/general/render.js";
import {
  mountExpensesDashboardCharts,
  renderExpensesDashboard,
} from "../modules/dashboard/expenses/render.js";
import {
  mountCashflowDashboardCharts,
  renderCashflowDashboard,
} from "../modules/dashboard/cashflow/render.js";
import {
  mountCardsDashboardCharts,
  renderCardsDashboard,
} from "../modules/dashboard/cards/render.js";
import {
  mountInvestmentsDashboardCharts,
  renderInvestmentsDashboard,
} from "../modules/dashboard/investments/render.js";
import {
  buildInvestmentPayload,
  buildSimulationPayload,
  isFixedIncomeType,
  renderProjectionPanel,
  syncInvestmentFormFields,
} from "../modules/investments/form.js";
import { normalizeDashboardRoute } from "../modules/dashboard/shared/periodLabels.js";
import { initDashboardScrollHints } from "../modules/dashboard/shared/DashboardNav.js";
import { renderHomeDashboard } from "../modules/home/render.js";
import { createMovementModal } from "../components/modal/movementModal.js";
import { createOnboardingWizard } from "../modules/onboarding/onboardingWizard.js";
import { renderProfilePage } from "../modules/profile/render.js";
import { bindProfilePage } from "../modules/profile/events.js";
import { renderAdminPage } from "../modules/admin/render.js";
import { bindAdminPage } from "../modules/admin/events.js";
import { personalizationService } from "../services/personalization.js";
import { confirmDialog } from "../components/modal/confirmModal.js";
import { ensureAuthenticated } from "../modules/auth/authGate.js";
import { authApi } from "../services/api.js";
import {
  initCustomSelects,
  refreshCustomSelectValue,
  setupCustomSelects,
} from "../components/select/customSelect.js";
import {
  closeAllCustomCalendars,
  initCustomCalendars,
  refreshCustomCalendarValue,
  setCustomCalendarValue,
  setupCustomCalendars,
} from "../components/calendar/customCalendar.js";
import { hideModal, showModal } from "../components/modal/modalFocus.js";

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


function updateCardColorPreview(color = "#0d6efd") {
  const picker = cardForm?.querySelector(".card-color-picker");
  const valueLabel = cardForm?.querySelector(".card-color-value");
  if (!picker) return;

  picker.style.setProperty("--selected-card-color", color);
  if (valueLabel) valueLabel.textContent = color.toUpperCase();
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



function applyBootstrapData(data = {}) {
  store.accounts = (data.accounts || []).map((account) => ({
    ...account,
    icon: resolveIcon(account.icon, "fa-building-columns"),
  }));
  store.creditCards = data.cards || [];
}

function applyDashboardData(data = {}) {
  store.dashboardData = data;
  store.transactions = (data.transactions || data.latestTransactions || data.recentTransactions || []).map(
    normalizeTransaction,
  );
  store.investments = (data.investments || data.portfolio || []).map(normalizeInvestment);
  store.accounts = (data.accounts || []).map((account) => ({
    ...account,
    icon: resolveIcon(account.icon, "fa-building-columns"),
  }));
  const cardsList = Array.isArray(data.cards) ? data.cards : data.cards?.list;
  if (cardsList) store.creditCards = cardsList;
  store.bills = (data.bills || data.pendingBills || data.nextBills || []).map(normalizeBill);
  store.goals = (data.goals || []).map(normalizeGoal);
}

/** Aplica user/contas/cartoes vindos de qualquer endpoint BFF (1 call por tela). */
function applyBffShell(data = {}) {
  if (data.user) {
    store.currentUser = data.user;
    updateUserHeader();
  }

  if (Array.isArray(data.accounts)) {
    store.accounts = data.accounts.map((account) => ({
      ...account,
      icon: resolveIcon(account.icon, "fa-building-columns"),
    }));
  }

  const cardsList = Array.isArray(data.cards) ? data.cards : data.cards?.list;
  if (cardsList) store.creditCards = cardsList;

  store.bootstrapReady = true;
}

const BFF_ROUTE_LOADERS = new Set([
  "dashboard",
  "transacoes",
  "contas-resumo",
  "contas-despesas",
  "contas-bancos",
  "contas-cartoes",
  "cartao-detalhe",
  "conta-detalhe",
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
    store.transactions = (data.list || []).map(normalizeTransaction);
  },
  "contas-resumo": async () => {
    const data = await bffService.getAccounts();
    applyBffShell(data);
    store.bills = (data.bills || []).map(normalizeBill);
    store.currentInvoices = data.invoices || [];
  },
  "contas-despesas": async () => {
    const data = await bffService.getAccounts();
    applyBffShell(data);
    store.bills = (data.bills || []).map(normalizeBill);
  },
  "contas-bancos": async () => {
    const data = await bffService.getAccounts();
    applyBffShell(data);
  },
  "contas-cartoes": async () => {
    const data = await bffService.getCards();
    applyBffShell(data);
  },
  "cartao-detalhe": async () => {
    const id = store.selectedCardId || store.creditCards[0]?.id;
    if (!id) {
      store.cardDetailData = null;
      return;
    }
    const data = await bffService.getCardDetail(id);
    applyBffShell(data);
    store.cardDetailData = data.card || null;
    if (store.cardDetailData?.id) store.selectedCardId = store.cardDetailData.id;
  },
  "conta-detalhe": async () => {
    const id = store.selectedAccountId || store.accounts[0]?.id;
    if (!id) {
      store.accountDetailData = null;
      return;
    }
    const data = await bffService.getAccountDetail(id);
    applyBffShell(data);
    store.accountDetailData = data.account
      ? {
          ...data.account,
          icon: resolveIcon(data.account.icon, "fa-building-columns"),
        }
      : null;
    if (store.accountDetailData?.id) store.selectedAccountId = store.accountDetailData.id;
  },
  patrimonio: async () => {
    const data = await bffService.getInvestments();
    applyBffShell(data);
    store.investments = (data.portfolio || []).map(normalizeInvestment);
    store.portfolioSummary = data.summary || null;
  },
  "investimento-detalhe": async () => {
    const data = await bffService.getInvestments();
    applyBffShell(data);
    store.investments = (data.portfolio || []).map(normalizeInvestment);
    store.portfolioSummary = data.summary || null;
  },
  metas: async () => {
    const data = await bffService.getInsights();
    applyBffShell(data);
    store.goals = (data.goals || []).map(normalizeGoal);
  },
  perfil: async () => {
    const data = await bffService.getInsights();
    applyBffShell(data);
    store.personalizationContext = data.personalization || null;
    store.goals = (data.goals || []).map(normalizeGoal);
  },
};

async function loadBootstrap({ force = false } = {}) {
  if (store.bootstrapReady && !force) return;
  if (store.isLoadingData) return;

  store.isLoadingData = true;
  try {
    const [bootstrap, user] = await Promise.all([
      bootstrapService.getBootstrap(),
      usersService.profile(),
    ]);
    applyBootstrapData(bootstrap);
    store.currentUser = user;
    store.bootstrapReady = true;
    updateUserHeader();
  } catch (error) {
    console.error(error);
    showToast(error.message || "Não foi possível carregar os dados da API.");
  } finally {
    store.isLoadingData = false;
  }
}

async function loadRouteData(route, { force = false } = {}) {
  const viewRoute = route === "investimento-novo" ? "patrimonio" : route;
  const loader = ROUTE_DATA_LOADERS[viewRoute];

  const routeCacheKey =
    viewRoute === "cartao-detalhe"
      ? `cartao-detalhe:${store.selectedCardId || ""}`
      : viewRoute === "conta-detalhe"
        ? `conta-detalhe:${store.selectedAccountId || ""}`
        : viewRoute;

  // Telas BFF: uma unica chamada HTTP (sem bootstrap separado)
  if (loader && BFF_ROUTE_LOADERS.has(viewRoute)) {
    if (store.loadedRouteKey === routeCacheKey && !force && store.bootstrapReady) return;
    await loader();
    store.loadedRouteKey = routeCacheKey;
    return;
  }

  await loadBootstrap({ force });
  if (!loader) return;
  if (store.loadedRouteKey === routeCacheKey && !force) return;
  await loader();
  store.loadedRouteKey = routeCacheKey;
}

function updateUserHeader() {
  if (!store.currentUser) return;

  const profile = document.querySelector(".profile");
  const name = store.currentUser.name || "Usuario";
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

async function loadAnalyticsDashboard(route = store.currentAnalyticsRoute, period = store.currentDashboardPeriod) {
  const normalizedRoute = normalizeDashboardRoute(route);
  const renderer = DASHBOARD_RENDERERS[normalizedRoute];
  if (!renderer) return null;

  if (store.isLoadingAnalyticsDashboard) return store.analyticsDashboardData;

  store.isLoadingAnalyticsDashboard = true;
  try {
    // Uma unica chamada BFF para todos os paineis do dashboard
    if (
      !store.analyticsDashboardPayload ||
      store.currentDashboardPeriod !== period
    ) {
      store.analyticsDashboardPayload = await bffService.getDashboard({ period });
      applyBffShell(store.analyticsDashboardPayload);
    }

    store.analyticsDashboardData = pickAnalyticsSection(
      store.analyticsDashboardPayload,
      renderer.section,
    );
    store.currentDashboardPeriod = period;
    store.currentAnalyticsRoute = normalizedRoute;
    return store.analyticsDashboardData;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    store.isLoadingAnalyticsDashboard = false;
  }
}

function renderAnalyticsDashboardView(route, data) {
  const normalizedRoute = normalizeDashboardRoute(route);
  const renderer = DASHBOARD_RENDERERS[normalizedRoute];
  if (!renderer) return "";

  return renderer.render(data, {
    period: store.currentDashboardPeriod,
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
    await loadAnalyticsDashboard(normalizedRoute, store.currentDashboardPeriod);

    app.innerHTML = renderAnalyticsDashboardView(normalizedRoute, store.analyticsDashboardData);
    mountAnalyticsDashboardCharts(normalizedRoute, store.analyticsDashboardData);
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
  if (period === store.currentDashboardPeriod && store.analyticsDashboardData) return;

  store.currentDashboardPeriod = period;
  store.analyticsDashboardData = null;
  store.analyticsDashboardPayload = null;
  destroyAllCharts();
  app.innerHTML = renderDashboardSkeleton();

  try {
    await loadAnalyticsDashboard(store.currentAnalyticsRoute, period);
    app.innerHTML = renderAnalyticsDashboardView(store.currentAnalyticsRoute, store.analyticsDashboardData);
    mountAnalyticsDashboardCharts(store.currentAnalyticsRoute, store.analyticsDashboardData);
    initDashboardScrollHints(app);
  } catch (error) {
    showToast(error.message || "Não foi possível atualizar o período.");
    await renderAnalyticsDashboardPage(store.currentAnalyticsRoute);
  }
}

async function loadGeneralDashboard(period = store.currentDashboardPeriod) {
  return loadAnalyticsDashboard("dashboards/geral", period);
}

async function renderDashboardPage() {
  return renderAnalyticsDashboardPage("dashboards/geral");
}

async function reloadAndRender() {
  store.bootstrapReady = false;
  store.loadedRouteKey = null;
  store.dashboardData = null;
  store.analyticsDashboardData = null;
  store.analyticsDashboardPayload = null;
  await renderRoute();
}

function openExpenseModal(transaction = null) {
  if (!expenseModal || !expenseForm) return;

  closeQuickActionMenu();
  expenseForm.reset();
  store.editingTransactionId = transaction?.id || null;

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
    store.editingTransactionId = null;
  }
}

function openInvestmentModal(investment = null) {
  if (!investmentModal || !investmentForm) return;

  closeQuickActionMenu();
  setInvestmentsMenuExpanded(true);
  investmentForm.reset();
  store.editingInvestmentId = investment?.id || null;

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
  clearTimeout(store.investmentSimulationTimer);
  store.investmentSimulationTimer = setTimeout(() => {
    refreshInvestmentSimulation();
  }, 350);
}

function closeInvestmentDialog({ reset = false } = {}) {
  if (!investmentModal) return;

  closeAllCustomCalendars();
  hideModal(investmentModal);

  if (reset) {
    investmentForm?.reset();
    store.editingInvestmentId = null;
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
  store.editingBillId = bill?.id || null;

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
    store.editingBillId = null;
  }
}

function openCardModal(card = null) {
  if (!cardModal || !cardForm) return;

  closeQuickActionMenu();
  setAccountsMenuExpanded(true);
  cardForm.reset();
  store.editingCardId = card?.id || null;

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
    store.editingCardId = null;
  }
}

function openAccountModal(account = null) {
  if (!accountModal || !accountForm) return;

  closeQuickActionMenu();
  setAccountsMenuExpanded(true);
  accountForm.reset();
  store.editingAccountId = account?.id || null;

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
    store.editingAccountId = null;
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




async function addExpenseFromForm() {
  if (!expenseForm) return;

  const formData = new FormData(expenseForm);
  const value = Number(formData.get("value")) || 0;
  const currentTransaction = store.transactions.find(
    (transaction) => String(transaction.id) === String(store.editingTransactionId),
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
    type: store.editingTransactionId ? transactionType : "despesa",
    category: formData.get("category") || null,
    payment: mapPaymentMethod(formData.get("payment")),
    status: currentTransaction?.status || "confirmada",
    notes: formData.get("notes") || "",
  };

  if (store.editingTransactionId) {
    await transactionsService.update(store.editingTransactionId, payload);
  } else {
    await transactionsService.create(payload);
  }

  const wasEditing = Boolean(store.editingTransactionId);
  closeExpenseDialog({ reset: true });
  showToast(
    wasEditing
      ? "Despesa atualizada com sucesso."
      : "Despesa adicionada com sucesso.",
  );
  await reloadAndRender();
}


async function addInvestmentFromForm() {
  if (!investmentForm) return;

  const payload = buildInvestmentPayload(investmentForm);

  if (store.editingInvestmentId) {
    await investmentsService.update(store.editingInvestmentId, payload);
  } else {
    await investmentsService.create(payload);
  }

  const wasEditing = Boolean(store.editingInvestmentId);
  closeInvestmentDialog({ reset: true });
  showToast(
    wasEditing
      ? "Investimento atualizado com sucesso."
      : "Investimento salvo com sucesso.",
  );
  await reloadAndRender();
}






async function addBillFromForm() {
  if (!billForm) return;

  const formData = new FormData(billForm);
  const currentBill = store.bills.find(
    (bill) => String(bill.id) === String(store.editingBillId),
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

  if (store.editingBillId) {
    await billsService.update(store.editingBillId, payload);
  } else {
    await billsService.create(payload);
  }

  const wasEditing = Boolean(store.editingBillId);
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
    const currentCard = store.creditCards.find(
      (card) => String(card.id) === String(store.editingCardId),
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
      availableLimit: store.editingCardId ? availableLimit : undefined,
      notes: formData.get("notes") || "",
    };

    if (store.editingCardId) {
      await cardsService.update(store.editingCardId, payload);
    } else {
      await cardsService.create(payload);
    }

    const wasEditing = Boolean(store.editingCardId);
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

    if (!store.editingAccountId) {
      payload.balance = Number(balanceRaw) || 0;
    } else if (balanceRaw !== null && balanceRaw !== "") {
      payload.balance = Number(balanceRaw) || 0;
    }

    if (store.editingAccountId) {
      await accountsService.update(store.editingAccountId, payload);
    } else {
      await accountsService.create(payload);
    }

    const wasEditing = Boolean(store.editingAccountId);
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


function getUserFirstName() {
  const name = store.currentUser?.name || "Usuário";
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
          <p class="item-title">${escapeHtml(transaction.description)}</p>
          <p class="item-meta">${transaction.category} • ${transaction.account}</p>
        </div>
      </div>
      <strong class="${amountClass}">${formatCurrency(transaction.value)}</strong>
    </div>
  `;
}




function dashboardView() {
  return renderHomeDashboard({
    dashboardData: store.dashboardData,
    transactions: store.transactions,
    investments: store.investments,
    creditCards: store.creditCards,
    goals: store.goals,
    firstName: getUserFirstName(),
  });
}




function transactionsView() {
  return renderTransactionsPage();
}

function renderTransactionsTable() {
  renderTransactionsTableView(store.transactions);
}


function billsSummaryView() {
  return accountsModule.renderSummary(store.bills, store.currentInvoices);
}

function billsView() {
  return accountsModule.renderBillsPage();
}

function renderBillsList() {
  accountsModule.renderBillsList(store.bills);
}

function cardsView() {
  return cardsModule.render(store.creditCards);
}

function accountsView() {
  return accountsModule.render(store.accounts);
}

function accountDetailView() {
  return accountsModule.renderDetail(store.accountDetailData);
}

function cardDetailView() {
  return cardsModule.renderDetail(store.cardDetailData, store.creditCards);
}

function restoreAllPurchases() {
  cardsModule.restoreAllPurchases(store.cardDetailData);
}

function swapPurchasesContent(html) {
  cardsModule.swapPurchasesContent(html);
}

function renderPurchasesList(purchases) {
  return cardsModule.renderPurchasesList(purchases);
}

function renderInvoiceItems(items) {
  return cardsModule.renderInvoiceItems(items);
}

function wealthView() {
  return investmentsModule.renderWealth(
    store.accounts,
    store.investments,
    store.creditCards,
    store.portfolioSummary,
  );
}

function investmentDetailView() {
  return investmentsModule.renderDetail(store.investments);
}

function mountInvestmentDetailCharts() {
  investmentsModule.mountDetailCharts(store.investments);
}

function goalsView() {
  return goalsModule.render(store.goals);
}

























function profileView() {
  return renderProfilePage({
    user: store.currentUser,
    personalization: store.personalizationContext,
  });
}

function adminView() {
  return renderAdminPage();
}

function isAdminUser(user = store.currentUser) {
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

  if (viewRoute === "perfil" && !store.personalizationContext) {
    store.personalizationContext = await personalizationService
      .getContext()
      .catch(() => null);
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
        store.personalizationContext = await personalizationService
          .getContext()
          .catch(() => store.personalizationContext);
        store.bootstrapReady = false;
        await reloadAndRender();
      },
    });
  }

  if (viewRoute === "admin") {
    bindAdminPage(app, {
      showToast,
      currentUser: store.currentUser,
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

function onFiltersInput(event) {
  if (event.target.closest("#transactionFilters")) renderTransactionsTable();
  if (event.target.closest("#billFilters")) renderBillsList();
  if (event.target.matches("#cardColor"))
    updateCardColorPreview(event.target.value);
  if (event.target.matches("#accountColor"))
    updateAccountColorPreview(event.target.value);
}

function onFiltersChange(event) {
  if (event.target.closest("#transactionFilters")) renderTransactionsTable();
  if (event.target.closest("#billFilters")) renderBillsList();
  if (
    event.target.matches("#investmentType") ||
    event.target.closest("#investmentForm")
  ) {
    syncInvestmentFormFields(investmentForm);
    scheduleInvestmentSimulation();
  }
}

function onInvestmentFormInput(event) {
  if (event.target.closest("#investmentForm")) {
    scheduleInvestmentSimulation();
  }
}

async function onFormSubmit(event) {
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
}

async function onDocumentClick(event) {
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
    store.analyticsDashboardData = null;
    await renderAnalyticsDashboardPage(store.currentAnalyticsRoute);
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
    store.selectedCardId =
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
    const bill = store.bills.find((item) => String(item.id) === String(billId));
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
    store.selectedAccountId =
      event.target.closest("[data-account-id]")?.dataset.accountId || null;
    window.location.hash = "conta-detalhe";
    return;
  }

  if (action === "edit-account") {
    const accountId = event.target.closest("[data-account-id]")?.dataset
      .accountId;
    const account = store.accounts.find(
      (item) => String(item.id) === String(accountId),
    );
    if (account) openAccountModal(account);
    return;
  }

  if (action === "remove-account") {
    const accountId = event.target.closest("[data-account-id]")?.dataset
      .accountId;
    const account = store.accounts.find(
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
        if (String(store.selectedAccountId) === String(accountId)) {
          store.selectedAccountId = null;
          store.accountDetailData = null;
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
    const transaction = store.transactions.find(
      (item) => String(item.id) === String(transactionId),
    );
    if (transaction) movementModal.openEdit(transaction);
    return;
  }

  if (action === "edit-investment") {
    const investmentId = event.target.closest("[data-investment-id]")?.dataset
      .investmentId;
    const investment = store.investments.find(
      (item) => String(item.id) === String(investmentId),
    );
    if (investment) openInvestmentModal(investment);
    return;
  }

  if (action === "edit-bill") {
    const billId = event.target.closest("[data-bill-id]")?.dataset.billId;
    const bill = store.bills.find((item) => String(item.id) === String(billId));
    if (bill) movementModal.openEdit(bill, "conta");
    return;
  }

  if (action === "edit-card") {
    const cardId = event.target.closest("[data-card-id]")?.dataset.cardId;
    const card = store.creditCards.find((item) => String(item.id) === String(cardId));
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

  if (action === "export-data") {
    try {
      const data = await privacyService.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `finsight-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Exportacao LGPD baixada.");
    } catch (error) {
      showToast(error?.message || "Nao foi possivel exportar os dados.");
    }
    return;
  }

  if (action === "delete-account") {
    const confirmed = await confirmDialog({
      title: "Excluir conta",
      message:
        "Tem certeza que deseja excluir sua conta? Seus dados pessoais serao anonimizados (LGPD). Essa acao nao pode ser desfeita.",
      confirmText: "Excluir conta",
    });
    if (!confirmed) return;
    try {
      await privacyService.deleteAccount();
      showToast("Conta excluida e dados anonimizados.");
      window.dispatchEvent(new CustomEvent("finsight:session-expired"));
    } catch (error) {
      showToast(error?.message || "Nao foi possivel excluir a conta.");
    }
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
}

const movementModal = createMovementModal({
  getAccounts: () => store.accounts,
  getCards: () => store.creditCards,
  onSaved: async (message) => {
    showToast(message);
    await reloadAndRender();
  },
  showToast,
});

const onboardingWizard = createOnboardingWizard({
  getAccounts: () => store.accounts,
  showToast,
  onComplete: async () => {
    store.bootstrapReady = false;
    store.loadedRouteKey = null;
    await reloadAndRender();
  },
  onSkip: () => {},
});

// Expõe para testes / reabertura manual: onboardingWizard.open({ force: true })
window.onboardingWizard = onboardingWizard;

function onDocumentKeydown(event) {
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
}

setupCustomSelects();
setupCustomCalendars();

bindAppEvents({
  onFiltersInput,
  onFiltersChange,
  onInvestmentFormInput,
  onFormSubmit,
  onDocumentClick,
  onDocumentKeydown,
  onHashChange: renderRoute,
  onSessionExpired: () => {
    if (document.body.classList.contains("is-auth-screen")) return;
    window.finsightLogout?.();
  },
  quickAction,
  onQuickActionClick: () => {
    movementModal.open();
  },
});

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
  store.currentUser = user;
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


window.finsightLogout = async () => {
  try {
    await authApi.logout();
  } catch {
    /* ignore */
  }
  window.location.reload();
};
