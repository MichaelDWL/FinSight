const app = document.querySelector("#app");
const pageTitle = document.querySelector("#pageTitle");
const toast = document.querySelector("#toast");
const quickAction = document.querySelector("#quickAction");
const quickActionMenu = document.querySelector("#quickActionMenu");
const expenseModal = document.querySelector("#expenseModal");
const expenseForm = document.querySelector("#expenseForm");
const closeExpenseModal = document.querySelector("#closeExpenseModal");
const cancelExpenseForm = document.querySelector("#cancelExpenseForm");
const expenseCalendar = document.querySelector("#expenseCalendar");
const expenseDateInput = document.querySelector("#date-expense");
const expenseDateDisplay = document.querySelector("#date-expense-display");
const investmentModal = document.querySelector("#investmentModal");
const investmentForm = document.querySelector("#investmentForm");
const closeInvestmentModal = document.querySelector("#closeInvestmentModal");
const cancelInvestmentForm = document.querySelector("#cancelInvestmentForm");
const billModal = document.querySelector("#billModal");
const billForm = document.querySelector("#billForm");
const cardModal = document.querySelector("#cardModal");
const cardForm = document.querySelector("#cardForm");

let calendarVisibleDate = new Date();
let investmentCalendarVisibleDate = new Date();

const formatCurrency = (value) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const formatDateLabel = (isoDate) => {
  if (!isoDate) return "";

  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR").format(new Date(year, month - 1, day));
};

const toIsoDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const transactions = [
  {
    icon: "fa-cart-shopping",
    description: "Supermercado",
    category: "Alimentação",
    account: "Nubank",
    value: -150,
    date: "2026-07-09",
    type: "Despesa",
  },
  {
    icon: "fa-building-columns",
    description: "Salário recebido",
    category: "Receita",
    account: "Itaú",
    value: 5150,
    date: "2026-07-05",
    type: "Receita",
  },
  {
    icon: "fa-bolt",
    description: "Conta de luz",
    category: "Moradia",
    account: "Nubank",
    value: -180,
    date: "2026-07-04",
    type: "Despesa",
  },
  {
    icon: "fa-utensils",
    description: "Restaurante",
    category: "Lazer",
    account: "Inter",
    value: -120,
    date: "2026-07-02",
    type: "Despesa",
  },
  {
    icon: "fa-laptop",
    description: "Projeto freelance",
    category: "Receita",
    account: "Nubank",
    value: 980,
    date: "2026-06-28",
    type: "Receita",
  },
];

const investments = [
  {
    icon: "🏦",
    name: "Nubank",
    category: "Poupança",
    institution: "Nubank",
    invested: 7600,
    current: 8500,
    date: "2025-11-12",
    returnRate: 12,
    notes: "Reserva de emergência para manter seis meses de tranquilidade.",
  },
  {
    icon: "₿",
    name: "Bitcoin",
    category: "Cripto",
    institution: "Mercado Bitcoin",
    invested: 2400,
    current: 3250,
    date: "2025-09-18",
    returnRate: 35,
    notes: "Exposição pequena e acompanhada mensalmente.",
  },
  {
    icon: "📈",
    name: "Tesouro Selic",
    category: "Renda fixa",
    institution: "Tesouro Direto",
    invested: 4800,
    current: 5120,
    date: "2026-01-20",
    returnRate: 7,
    notes: "Objetivo conservador para metas de curto prazo.",
  },
];

const accounts = [
  {
    icon: "fa-building-columns",
    name: "Nubank",
    type: "Conta corrente",
    balance: 4380,
    color: "text-brand",
  },
  {
    icon: "fa-piggy-bank",
    name: "Reserva diária",
    type: "Poupança",
    balance: 6200,
    color: "text-income",
  },
  {
    icon: "fa-wallet",
    name: "Carteira",
    type: "Dinheiro físico",
    balance: 420,
    color: "text-warning",
  },
];

const creditCards = [
  {
    icon: "fa-credit-card",
    name: "Nubank Platinum",
    bank: "Nubank",
    brand: "Mastercard",
    lastDigits: "458",
    color: "#7c3aed",
    closingDay: 18,
    dueDay: 25,
    totalLimit: 8500,
    usedLimit: 3120,
    invoiceCurrent: 3120,
    nextInvoice: 680,
    notes: "Cartão principal para compras do mês.",
    purchases: [
      { name: "Mercado", category: "Alimentação", value: 420, date: "2026-07-08" },
      { name: "Streaming", category: "Assinaturas", value: 59.9, date: "2026-07-06" },
      { name: "Farmácia", category: "Saúde", value: 180, date: "2026-07-03" },
    ],
  },
  {
    icon: "fa-credit-card",
    name: "Itaú Click",
    bank: "Itaú",
    brand: "Visa",
    lastDigits: "921",
    color: "#0d6efd",
    closingDay: 10,
    dueDay: 17,
    totalLimit: 5200,
    usedLimit: 1880,
    invoiceCurrent: 1880,
    nextInvoice: 240,
    notes: "Cartão de apoio para compras parceladas.",
    purchases: [
      { name: "Tênis", category: "Lazer", value: 320, date: "2026-07-02" },
      { name: "Internet", category: "Casa", value: 129.9, date: "2026-07-01" },
    ],
  },
];

const bills = [
  {
    id: 1,
    icon: "fa-bolt",
    name: "Conta de luz",
    category: "Moradia",
    value: 180,
    dueDate: "2026-07-04",
    account: "Nubank",
    payment: "Pix",
    recurring: true,
    paid: true,
    notes: "Conta já paga este mês.",
  },
  {
    id: 2,
    icon: "fa-wifi",
    name: "Internet",
    category: "Casa",
    value: 129.9,
    dueDate: "2026-07-10",
    account: "Nubank",
    payment: "Cartão de Crédito",
    recurring: true,
    paid: false,
    notes: "Vence hoje.",
  },
  {
    id: 3,
    icon: "fa-house",
    name: "Aluguel",
    category: "Moradia",
    value: 1850,
    dueDate: "2026-07-15",
    account: "Reserva diária",
    payment: "Boleto",
    recurring: true,
    paid: false,
    notes: "Pagamento mensal da moradia.",
  },
  {
    id: 4,
    icon: "fa-heart-pulse",
    name: "Plano de saúde",
    category: "Saúde",
    value: 420,
    dueDate: "2026-07-20",
    account: "Nubank",
    payment: "Pix",
    recurring: true,
    paid: false,
    notes: "Plano familiar.",
  },
];

const goals = [
  {
    name: "Reserva de emergência",
    desired: 18000,
    current: 12600,
    date: "Dezembro de 2026",
  },
  {
    name: "Viagem de férias",
    desired: 7000,
    current: 4200,
    date: "Janeiro de 2027",
  },
  {
    name: "Entrada do carro",
    desired: 24000,
    current: 8300,
    date: "Agosto de 2027",
  },
];

const routeTitles = {
  dashboard: "Dashboard",
  transacoes: "Transações",
  patrimonio: "Patrimônio",
  "investimento-novo": "Adicionar investimento",
  "investimento-detalhe": "Detalhes do investimento",
  "contas-resumo": "Contas",
  "contas-despesas": "Despesas",
  "contas-cartoes": "Cartões",
  "cartao-detalhe": "Detalhes do cartão",
  metas: "Metas financeiras",
  perfil: "Perfil",
};

function showToast(message = "Tudo certo. Sua ação foi registrada.") {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2600);
}

function openExpenseModal() {
  if (!expenseModal || !expenseForm) return;

  closeQuickActionMenu();

  const dateInput = expenseForm.querySelector("#date-expense");
  if (dateInput && !dateInput.value) {
    setExpenseDate(toIsoDate(new Date()));
  }

  expenseModal.classList.remove("isHidden");
  expenseModal.setAttribute("aria-hidden", "false");
  expenseForm.querySelector("#desc-expense")?.focus();
}

function closeExpenseDialog({ reset = false } = {}) {
  if (!expenseModal) return;

  closeExpenseCalendar();
  expenseModal.classList.add("isHidden");
  expenseModal.setAttribute("aria-hidden", "true");

  if (reset) {
    expenseForm?.reset();
    resetExpenseSelects();
  }
}

function openInvestmentModal() {
  if (!investmentModal || !investmentForm) return;

  closeQuickActionMenu();
  setInvestmentsMenuExpanded(true);
  setInvestmentSubroute("investimento-novo");
  setInvestmentDate(investmentForm.querySelector("#investmentDate")?.value || toIsoDate(new Date()));
  investmentModal.classList.remove("isHidden");
  investmentModal.setAttribute("aria-hidden", "false");
  investmentForm.querySelector("#investmentName")?.focus();
}

function closeInvestmentDialog({ reset = false } = {}) {
  if (!investmentModal) return;

  closeInvestmentCalendar();
  investmentModal.classList.add("isHidden");
  investmentModal.setAttribute("aria-hidden", "true");

  if (reset) investmentForm?.reset();
  setActiveRoute(getRoute() === "investimento-novo" ? "patrimonio" : getRoute());
}

function openBillModal() {
  if (!billModal || !billForm) return;

  closeQuickActionMenu();
  setAccountsMenuExpanded(true);
  billModal.classList.remove("isHidden");
  billModal.setAttribute("aria-hidden", "false");
  billForm.querySelector("#billName")?.focus();
}

function closeBillDialog({ reset = false } = {}) {
  if (!billModal) return;

  billModal.classList.add("isHidden");
  billModal.setAttribute("aria-hidden", "true");
  if (reset) billForm?.reset();
}

function openCardModal() {
  if (!cardModal || !cardForm) return;

  closeQuickActionMenu();
  setAccountsMenuExpanded(true);
  cardModal.classList.remove("isHidden");
  cardModal.setAttribute("aria-hidden", "false");
  cardForm.querySelector("#cardName")?.focus();
}

function closeCardDialog({ reset = false } = {}) {
  if (!cardModal) return;

  cardModal.classList.add("isHidden");
  cardModal.setAttribute("aria-hidden", "true");
  if (reset) cardForm?.reset();
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
  const toggle = group?.querySelector("[data-action='toggle-investments-menu']");
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

function setInvestmentSubroute(activeRoute) {
  document.querySelectorAll(".nav-submenu [data-route], .nav-submenu [data-subroute]").forEach((item) => {
    const route = item.dataset.route || item.dataset.subroute;
    item.classList.toggle("nav-subitem-active", route === activeRoute);
  });
}

function setAccountSubroute(activeRoute) {
  document.querySelectorAll("[data-nav-group='accounts'] .nav-submenu [data-route]").forEach((item) => {
    item.classList.toggle("nav-subitem-active", item.dataset.route === activeRoute);
  });
}

function setExpenseDate(isoDate) {
  if (!expenseDateInput || !expenseDateDisplay) return;

  expenseDateInput.value = isoDate;
  expenseDateDisplay.value = formatDateLabel(isoDate);

  const [year, month, day] = isoDate.split("-").map(Number);
  calendarVisibleDate = new Date(year, month - 1, day);
  renderExpenseCalendar();
}

function openExpenseCalendar() {
  if (!expenseCalendar) return;

  expenseCalendar.classList.remove("is-hidden");
  renderExpenseCalendar();
}

function closeExpenseCalendar() {
  expenseCalendar?.classList.add("is-hidden");
}

function toggleExpenseCalendar() {
  if (!expenseCalendar) return;

  if (expenseCalendar.classList.contains("is-hidden")) {
    openExpenseCalendar();
    return;
  }

  closeExpenseCalendar();
}

function renderExpenseCalendar() {
  if (!expenseCalendar) return;

  const selectedDate = expenseDateInput?.value || toIsoDate(new Date());
  const year = calendarVisibleDate.getFullYear();
  const month = calendarVisibleDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDate = new Date(firstDay);
  startDate.setDate(firstDay.getDate() - firstDay.getDay());

  const monthTitle = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(calendarVisibleDate);

  const todayIso = toIsoDate(new Date());
  const days = Array.from({ length: 42 }, (_, index) => {
    const dayDate = new Date(startDate);
    dayDate.setDate(startDate.getDate() + index);

    const isoDate = toIsoDate(dayDate);
    const isCurrentMonth = dayDate.getMonth() === month;
    const classes = [
      "expense-calendar-day",
      isCurrentMonth ? "" : "is-muted",
      isoDate === todayIso ? "is-today" : "",
      isoDate === selectedDate ? "is-selected" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return `<button class="${classes}" type="button" data-calendar-day="${isoDate}">${dayDate.getDate()}</button>`;
  }).join("");

  expenseCalendar.innerHTML = `
    <div class="expense-calendar-header">
      <button class="expense-calendar-nav" type="button" data-calendar-nav="prev" aria-label="Mês anterior">
        <i class="fa-solid fa-chevron-left"></i>
      </button>
      <strong class="expense-calendar-title">${monthTitle}</strong>
      <button class="expense-calendar-nav" type="button" data-calendar-nav="next" aria-label="Próximo mês">
        <i class="fa-solid fa-chevron-right"></i>
      </button>
    </div>
    <div class="expense-calendar-weekdays" aria-hidden="true">
      <span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span>
    </div>
    <div class="expense-calendar-grid">${days}</div>
  `;
}

function collapseExpenseSelect(select) {
  select.querySelectorAll("li").forEach((item, index) => {
    item.style.display = index === 0 ? "flex" : "";
  });
}

function resetExpenseSelects() {
  expenseForm?.querySelectorAll("[data-expense-select]").forEach((select) => {
    [...select.children]
      .sort((first, second) => Number(first.dataset.initialIndex) - Number(second.dataset.initialIndex))
      .forEach((item) => select.append(item));

    select.classList.remove("is-open");
    collapseExpenseSelect(select);

    const hiddenInput = select.previousElementSibling;
    const firstItem = select.querySelector("li");
    if (hiddenInput && firstItem) hiddenInput.value = firstItem.dataset.value;
  });
}

function initializeExpenseSelects() {
  expenseForm?.querySelectorAll("[data-expense-select]").forEach((select) => {
    select.querySelectorAll("li").forEach((item, index) => {
      item.dataset.initialIndex = String(index);
    });
  });

  resetExpenseSelects();
}

function getExpenseIcon(category) {
  const icons = {
    Alimentação: "fa-cart-shopping",
    Casa: "fa-house-chimney",
    Lazer: "fa-utensils",
    Saúde: "fa-heart-pulse",
    Viagem: "fa-plane",
    Transporte: "fa-car",
    Assinaturas: "fa-receipt",
  };

  return icons[category] || "fa-wallet";
}

function addExpenseFromForm() {
  if (!expenseForm) return;

  const formData = new FormData(expenseForm);
  const category = formData.get("category") || "Despesa";
  const value = Number(formData.get("value")) || 0;

  transactions.unshift({
    icon: getExpenseIcon(category),
    description: formData.get("description") || "Nova despesa",
    category,
    account: formData.get("account") || "Nubank",
    value: -Math.abs(value),
    date: formData.get("date") || new Date().toISOString().slice(0, 10),
    type: "Despesa",
  });

  closeExpenseDialog({ reset: true });
  showToast("Despesa adicionada com sucesso.");

  const route = getRoute();
  if (route === "transacoes") {
    renderTransactionsTable();
    return;
  }

  if (route === "dashboard") renderRoute();
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

function addInvestmentFromForm() {
  if (!investmentForm) return;

  const formData = new FormData(investmentForm);
  const category = formData.get("category") || "Investimento";
  const invested = Number(formData.get("invested")) || 0;
  const current = Number(formData.get("current")) || invested;
  const returnRate = invested > 0 ? Math.round(((current - invested) / invested) * 100) : 0;

  investments.unshift({
    icon: getInvestmentIcon(category),
    name: formData.get("name") || "Novo investimento",
    category,
    institution: formData.get("institution") || "Instituição",
    invested,
    current,
    date: formData.get("date") || toIsoDate(new Date()),
    returnRate,
    notes: formData.get("notes") || "Investimento cadastrado no FinSight.",
  });

  closeInvestmentDialog({ reset: true });
  showToast("Investimento salvo com sucesso.");

  if (["patrimonio", "investimento-novo"].includes(getRoute())) renderRoute();
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
    return { label: "Atrasado", className: "status-late", icon: "fa-circle-exclamation" };
  }

  return { label: "Pendente", className: "status-pending", icon: "fa-hourglass-half" };
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
              <button class="btn-secondary" type="button" data-action="edit-bill">Editar</button>
              <button class="btn-secondary" type="button" data-action="toggle-bill-paid" data-bill-id="${bill.id}">${bill.paid ? "Voltar para Pendente" : "Marcar como Pago"}</button>
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
        <a class="btn-secondary" href="#cartao-detalhe" data-route="cartao-detalhe">Ver detalhes</a>
        <button class="btn-secondary" type="button" data-action="show-toast">Editar</button>
        <button class="btn-danger" type="button" data-action="delete-card" data-card-name="${card.name}">Excluir</button>
      </div>
    </article>
  `;
}

function addBillFromForm() {
  if (!billForm) return;

  const formData = new FormData(billForm);
  const category = formData.get("category") || "Conta";

  bills.unshift({
    id: Date.now(),
    icon: getBillIcon(category),
    name: formData.get("name") || "Nova conta",
    category,
    value: Number(formData.get("value")) || 0,
    dueDate: formData.get("dueDate") || toIsoDate(new Date()),
    account: formData.get("account") || "Nubank",
    payment: formData.get("payment") || "Pix",
    recurring: formData.get("recurring") === "Sim",
    paid: false,
    notes: formData.get("notes") || "",
  });

  closeBillDialog({ reset: true });
  showToast("Conta cadastrada com sucesso.");
  if (getRoute().startsWith("contas-")) renderRoute();
}

function addCardFromForm() {
  if (!cardForm) return;

  const formData = new FormData(cardForm);
  const totalLimit = Number(formData.get("totalLimit")) || 0;

  creditCards.unshift({
    icon: "fa-credit-card",
    name: formData.get("name") || "Novo cartão",
    bank: formData.get("bank") || "Banco",
    brand: formData.get("brand") || "Cartão",
    lastDigits: String(formData.get("lastDigits") || "000").slice(-3),
    color: formData.get("color") || "#0d6efd",
    closingDay: Number(formData.get("closingDay")) || 1,
    dueDay: Number(formData.get("dueDay")) || 10,
    totalLimit,
    usedLimit: 0,
    invoiceCurrent: 0,
    nextInvoice: 0,
    notes: formData.get("notes") || "",
    purchases: [],
  });

  closeCardDialog({ reset: true });
  showToast("Cartão cadastrado com segurança.");
  if (["contas-cartoes", "cartao-detalhe"].includes(getRoute())) renderRoute();
}

function getRoute() {
  const route = window.location.hash.replace("#", "") || "dashboard";
  return routeTitles[route] ? route : "dashboard";
}

function setActiveRoute(route) {
  const accountRoutes = ["contas-resumo", "contas-despesas", "contas-cartoes", "cartao-detalhe"];
  const activeRoute = ["investimento-novo", "investimento-detalhe"].includes(route)
    ? "patrimonio"
    : accountRoutes.includes(route)
      ? "contas-resumo"
      : route;

  document.querySelectorAll("[data-route]").forEach((link) => {
    const targetRoute = link.closest(".nav-submenu") ? route : activeRoute;
    const isActive = link.dataset.route === targetRoute;
    link.classList.toggle("nav-link-active", isActive);
    link.closest(".nav-item")?.classList.toggle("nav-active", isActive);
  });

  const investmentRoutes = ["patrimonio", "investimento-novo", "investimento-detalhe"];
  const isInvestmentRoute = investmentRoutes.includes(route);
  document.querySelector("[data-nav-group='investments']")?.classList.toggle("nav-active", isInvestmentRoute);
  if (isInvestmentRoute && !document.body.classList.contains("sidebar-closed")) setInvestmentsMenuExpanded(true);
  setInvestmentSubroute(route);

  const isAccountRoute = accountRoutes.includes(route);
  document.querySelector("[data-nav-group='accounts']")?.classList.toggle("nav-active", isAccountRoute);
  if (isAccountRoute && !document.body.classList.contains("sidebar-closed")) setAccountsMenuExpanded(true);
  setAccountSubroute(route === "cartao-detalhe" ? "contas-cartoes" : route);

  pageTitle.textContent = routeTitles[route];
  quickAction.querySelector(".fab-add-label").textContent = "Adicionar";
}

function metricCard(label, value, icon, caption, tone = "brand") {
  const toneClass = tone === "income" ? "text-income" : tone === "expense" ? "text-expense" : "text-brand";

  return `
    <article class="metric-card">
      <div class="metric-top">
        <span>${label}</span>
        <span class="metric-icon ${toneClass}"><i class="fa-solid ${icon}"></i></span>
      </div>
      <strong class="metric-value">${value}</strong>
      <small class="metric-caption">${caption}</small>
    </article>
  `;
}

function transactionItem(transaction) {
  const amountClass = transaction.value >= 0 ? "amount-positive" : "amount-negative";

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
    </article>
  `;
}

function dashboardView() {
  return `
    <section class="app-page">
      <div class="page-hero">
        <div>
          <span class="page-eyebrow">Visão simples do seu dinheiro</span>
          <h1 class="page-title">Sua vida financeira clara, bonita e sob controle.</h1>
          <p class="page-subtitle">Acompanhe saldo, gastos, patrimônio e metas sem complexidade. Tudo organizado para decisões rápidas e tranquilas.</p>
        </div>
        <div class="hero-actions">
          <a class="btn-secondary" href="#transacoes"><i class="fa-solid fa-filter"></i> Ver transações</a>
          <button class="btn-primary" type="button" data-action="add-investment"><i class="fa-solid fa-plus"></i> Novo investimento</button>
        </div>
      </div>

      <div class="metrics-grid">
        ${metricCard("Saldo atual", formatCurrency(12450), "fa-wallet", "+8% em relação ao mês anterior")}
        ${metricCard("Receitas", formatCurrency(7250), "fa-arrow-trend-up", "Entradas deste mês", "income")}
        ${metricCard("Despesas", formatCurrency(4360), "fa-arrow-trend-down", "Saídas deste mês", "expense")}
        ${metricCard("Patrimônio", formatCurrency(16870), "fa-gem", "Investimentos e reserva")}
      </div>

      <div class="dashboard-grid">
        <div class="stack">
          <section class="premium-card">
            <div class="card-title-row">
              <h2>Últimas movimentações</h2>
              <a class="btn-secondary" href="#transacoes">Ver todas</a>
            </div>
            <div class="mini-list">${transactions.slice(0, 4).map(transactionItem).join("")}</div>
          </section>

          <div class="charts-grid">
            <section class="chart-card">
              <h2>Gastos por categoria</h2>
              <div class="bar-chart" aria-label="Gráfico de gastos por categoria">
                <span style="height: 74%" data-label="Casa"></span>
                <span style="height: 52%" data-label="Alim."></span>
                <span style="height: 42%" data-label="Lazer"></span>
                <span style="height: 34%" data-label="Transp."></span>
                <span style="height: 24%" data-label="Saúde"></span>
              </div>
            </section>

            <section class="chart-card">
              <h2>Evolução financeira</h2>
              <div class="line-chart" aria-label="Gráfico de evolução financeira">
                <span style="height: 34%" data-label="Fev"></span>
                <span style="height: 46%" data-label="Mar"></span>
                <span style="height: 58%" data-label="Abr"></span>
                <span style="height: 63%" data-label="Mai"></span>
                <span style="height: 76%" data-label="Jun"></span>
              </div>
            </section>
          </div>
        </div>

        <div class="stack">
          <section class="premium-card">
            <div class="card-title-row">
              <h2>Insights</h2>
              <span class="pill">Hoje</span>
            </div>
            <div class="mini-list">
              <div class="list-item insight-soft">
                <div class="item-left">
                  <span class="item-icon text-warning"><i class="fa-solid fa-circle-exclamation"></i></span>
                  <div>
                    <p class="item-title">Lazer subiu 35%</p>
                    <p class="item-meta">Você ainda está dentro do limite mensal.</p>
                  </div>
                </div>
              </div>
              <div class="list-item insight-soft">
                <div class="item-left">
                  <span class="item-icon text-income"><i class="fa-solid fa-circle-check"></i></span>
                  <div>
                    <p class="item-title">Alimentação abaixo do orçamento</p>
                    <p class="item-meta">Boa consistência nesta semana.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="premium-card">
            <div class="card-title-row">
              <h2>Metas financeiras</h2>
              <a class="btn-secondary" href="#metas">Abrir</a>
            </div>
            <div class="mini-list">${goals.slice(0, 2).map(goalCard).join("")}</div>
          </section>
        </div>
      </div>
    </section>
  `;
}

function transactionsView() {
  return `
    <section class="app-page">
      <div class="page-hero">
        <div>
          <span class="page-eyebrow">Transações</span>
          <h1 class="page-title">Movimentações fáceis de encontrar.</h1>
          <p class="page-subtitle">Filtre por período, categoria, conta, tipo ou busque pelo nome. A tabela continua limpa mesmo com muitos lançamentos.</p>
        </div>
        <button class="btn-primary" type="button" data-action="add-transaction"><i class="fa-solid fa-plus"></i> Nova transação</button>
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

  const category = document.querySelector("[data-filter='category']")?.value || "all";
  const account = document.querySelector("[data-filter='account']")?.value || "all";
  const type = document.querySelector("[data-filter='type']")?.value || "all";
  const period = document.querySelector("[data-filter='period']")?.value || "all";
  const search = document.querySelector("[data-filter='search']")?.value.toLowerCase() || "";

  const filtered = transactions.filter((transaction) => {
    const month = new Date(transaction.date).getMonth();
    const matchesPeriod = period === "all" || (period === "july" && month === 6) || (period === "june" && month === 5);
    const matchesCategory = category === "all" || transaction.category === category;
    const matchesAccount = account === "all" || transaction.account === account;
    const matchesType = type === "all" || transaction.type === type;
    const matchesSearch = transaction.description.toLowerCase().includes(search);

    return matchesPeriod && matchesCategory && matchesAccount && matchesType && matchesSearch;
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
        ${filtered
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
                <td><button class="icon-button" type="button" data-action="show-toast" aria-label="Abrir menu de ações"><i class="fa-solid fa-ellipsis"></i></button></td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function billsSummaryView() {
  const total = bills.reduce((sum, bill) => sum + bill.value, 0);
  const paid = bills.filter((bill) => bill.paid).reduce((sum, bill) => sum + bill.value, 0);
  const pendingBills = bills.filter((bill) => !bill.paid);
  const nextBill = [...pendingBills].sort((first, second) => first.dueDate.localeCompare(second.dueDate))[0];

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
        <div class="bills-list">${[...bills].sort((first, second) => first.dueDate.localeCompare(second.dueDate)).slice(0, 5).map((bill) => billCard(bill, true)).join("")}</div>
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

  const category = document.querySelector("[data-bill-filter='category']")?.value || "all";
  const status = document.querySelector("[data-bill-filter='status']")?.value || "all";
  const payment = document.querySelector("[data-bill-filter='payment']")?.value || "all";
  const period = document.querySelector("[data-bill-filter='period']")?.value || "all";
  const search = document.querySelector("[data-bill-filter='search']")?.value.toLowerCase() || "";

  const filtered = bills.filter((bill) => {
    const billStatus = getBillStatus(bill).label;
    const month = new Date(bill.dueDate).getMonth();
    const matchesPeriod = period === "all" || (period === "july" && month === 6) || (period === "june" && month === 5);
    const matchesCategory = category === "all" || bill.category === category;
    const matchesStatus = status === "all" || billStatus === status;
    const matchesPayment = payment === "all" || bill.payment === payment;
    const matchesSearch = bill.name.toLowerCase().includes(search);

    return matchesPeriod && matchesCategory && matchesStatus && matchesPayment && matchesSearch;
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

function cardDetailView() {
  const card = creditCards[0];
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

  return `
    <section class="app-page">
      <div class="page-hero">
        <div>
          <span class="page-eyebrow">Detalhes do cartão</span>
          <h1 class="page-title">${card.name} ••• ${card.lastDigits}</h1>
          <p class="page-subtitle">${card.notes || "Acompanhe limite, vencimentos e compras cadastradas neste cartão."}</p>
        </div>
        <div class="hero-actions">
          <button class="btn-secondary" type="button" data-action="show-toast"><i class="fa-solid fa-pen"></i> Editar</button>
          <button class="btn-danger" type="button" data-action="delete-card" data-card-name="${card.name}"><i class="fa-solid fa-trash"></i> Excluir</button>
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
        <div class="detail-stat"><span>Próxima Fatura</span><strong>${formatCurrency(card.nextInvoice)}</strong></div>
      </div>

      <section class="premium-card">
        <div class="card-title-row">
          <h2>Compras cadastradas</h2>
          <span class="pill">${card.purchases.length} compras</span>
        </div>
        <div class="mini-list">
          ${card.purchases
            .map(
              (purchase) => `
                <div class="history-item">
                  <div>
                    <strong class="item-title">${purchase.name}</strong>
                    <p class="item-meta">${purchase.category} • ${formatDateLabel(purchase.date)}</p>
                  </div>
                  <strong class="amount-negative">${formatCurrency(purchase.value)}</strong>
                </div>
              `
            )
            .join("")}
        </div>
      </section>
    </section>
  `;
}

function wealthView() {
  const cashTotal = accounts.reduce((sum, account) => sum + account.balance, 0);
  const investmentsTotal = investments.reduce((sum, investment) => sum + investment.current, 0);
  const invested = investments.reduce((sum, investment) => sum + investment.invested, 0);
  const availableCredit = creditCards.reduce((sum, card) => sum + (card.totalLimit - card.usedLimit), 0);
  const usedCredit = creditCards.reduce((sum, card) => sum + card.usedLimit, 0);
  const totalPatrimony = cashTotal + investmentsTotal;
  const purchasePower = cashTotal + availableCredit;

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
                `
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
                const usedPercent = Math.round((card.usedLimit / card.totalLimit) * 100);

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
    </section>
  `;
}

function getInvestmentCalendarElements() {
  return {
    calendar: document.querySelector("#investmentCalendar"),
    dateInput: document.querySelector("#investmentDate"),
    dateDisplay: document.querySelector("#investmentDateDisplay"),
  };
}

function setInvestmentDate(isoDate) {
  const { dateInput, dateDisplay } = getInvestmentCalendarElements();
  if (!dateInput || !dateDisplay) return;

  dateInput.value = isoDate;
  dateDisplay.value = formatDateLabel(isoDate);

  const [year, month, day] = isoDate.split("-").map(Number);
  investmentCalendarVisibleDate = new Date(year, month - 1, day);
  renderInvestmentCalendar();
}

function openInvestmentCalendar() {
  const { calendar } = getInvestmentCalendarElements();
  if (!calendar) return;

  calendar.classList.remove("is-hidden");
  renderInvestmentCalendar();
}

function closeInvestmentCalendar() {
  getInvestmentCalendarElements().calendar?.classList.add("is-hidden");
}

function toggleInvestmentCalendar() {
  const { calendar } = getInvestmentCalendarElements();
  if (!calendar) return;

  if (calendar.classList.contains("is-hidden")) {
    openInvestmentCalendar();
    return;
  }

  closeInvestmentCalendar();
}

function renderInvestmentCalendar() {
  const { calendar, dateInput } = getInvestmentCalendarElements();
  if (!calendar) return;

  const selectedDate = dateInput?.value || toIsoDate(new Date());
  const year = investmentCalendarVisibleDate.getFullYear();
  const month = investmentCalendarVisibleDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDate = new Date(firstDay);
  startDate.setDate(firstDay.getDate() - firstDay.getDay());

  const monthTitle = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(investmentCalendarVisibleDate);

  const todayIso = toIsoDate(new Date());
  const days = Array.from({ length: 42 }, (_, index) => {
    const dayDate = new Date(startDate);
    dayDate.setDate(startDate.getDate() + index);

    const isoDate = toIsoDate(dayDate);
    const isCurrentMonth = dayDate.getMonth() === month;
    const classes = [
      "investment-calendar-day",
      isCurrentMonth ? "" : "is-muted",
      isoDate === todayIso ? "is-today" : "",
      isoDate === selectedDate ? "is-selected" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return `<button class="${classes}" type="button" data-investment-calendar-day="${isoDate}">${dayDate.getDate()}</button>`;
  }).join("");

  calendar.innerHTML = `
    <div class="investment-calendar-header">
      <button class="investment-calendar-nav" type="button" data-investment-calendar-nav="prev" aria-label="Mês anterior">
        <i class="fa-solid fa-chevron-left"></i>
      </button>
      <strong class="investment-calendar-title">${monthTitle}</strong>
      <button class="investment-calendar-nav" type="button" data-investment-calendar-nav="next" aria-label="Próximo mês">
        <i class="fa-solid fa-chevron-right"></i>
      </button>
    </div>
    <div class="investment-calendar-weekdays" aria-hidden="true">
      <span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span>
    </div>
    <div class="investment-calendar-grid">${days}</div>
  `;
}

function initializeInvestmentCalendar() {
  const { dateInput } = getInvestmentCalendarElements();
  if (!dateInput) return;

  setInvestmentDate(dateInput.value || toIsoDate(new Date()));
  closeInvestmentCalendar();
}

function investmentDetailView() {
  const totalCurrent = investments.reduce((sum, investment) => sum + investment.current, 0);
  const totalInvested = investments.reduce((sum, investment) => sum + investment.invested, 0);
  const totalProfit = totalCurrent - totalInvested;
  const averageReturn = investments.length
    ? Math.round(investments.reduce((sum, investment) => sum + investment.returnRate, 0) / investments.length)
    : 0;
  const highestInvestment = investments.reduce(
    (highest, investment) => (investment.current > highest.current ? investment : highest),
    investments[0]
  );
  const maxInvestmentValue = Math.max(...investments.map((investment) => investment.current), 1);

  return `
    <section class="app-page">
      <div class="page-hero">
        <div>
          <span class="page-eyebrow">Detalhes</span>
          <h1 class="page-title">Todos os investimentos em detalhes.</h1>
          <p class="page-subtitle">Veja cada ativo da carteira, compare valores investidos, valor atual, lucro e rentabilidade em uma visão consolidada.</p>
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

      <div class="detail-grid">
        <section class="premium-card">
          <div class="card-title-row">
            <h2>Resumo por investimento</h2>
            <span class="pill">${investments.length} ativos</span>
          </div>
          <div class="mini-list">
            ${investments
              .map((investment) => {
                const profit = investment.current - investment.invested;
                const returnClass = profit >= 0 ? "text-income" : "text-expense";

                return `
                  <div class="history-item">
                    <div class="item-left">
                      <span class="investment-icon">${investment.icon}</span>
                      <div>
                        <strong class="item-title">${investment.name}</strong>
                        <p class="item-meta">${investment.category} • ${investment.institution}</p>
                      </div>
                    </div>
                    <div class="detail-investment-values">
                      <strong>${formatCurrency(investment.current)}</strong>
                      <span class="${returnClass}">${profit >= 0 ? "+" : ""}${formatCurrency(profit)} • ${investment.returnRate >= 0 ? "+" : ""}${investment.returnRate}%</span>
                    </div>
                  </div>
                `;
              })
              .join("")}
          </div>
        </section>
        <section class="chart-card">
          <div class="card-title-row">
            <h2>Distribuição da carteira</h2>
            <span class="pill">${formatCurrency(totalCurrent)}</span>
          </div>
          <div class="bar-chart">
            ${investments
              .map((investment) => {
                const height = Math.max(Math.round((investment.current / maxInvestmentValue) * 88), 18);
                return `<span style="height: ${height}%" data-label="${investment.name.slice(0, 8)}"></span>`;
              })
              .join("")}
          </div>
          <div class="mini-list">
            ${investments
              .map(
                (investment) => `
                  <div class="history-item">
                    <span>${investment.name}</span>
                    <strong>${Math.round((investment.current / totalCurrent) * 100)}%</strong>
                  </div>
                `
              )
              .join("")}
          </div>
        </section>
      </div>
    </section>
  `;
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
  return `
    <section class="app-page">
      <div class="page-hero">
        <div>
          <span class="page-eyebrow">Perfil</span>
          <h1 class="page-title">Preferências simples e seguras.</h1>
          <p class="page-subtitle">Ajuste tema, moeda, idioma e notificações sem sair da experiência do FinSight.</p>
        </div>
      </div>

      <div class="profile-grid">
        <section class="form-card">
          <div class="item-left">
            <span class="profile-picture">MS</span>
            <div>
              <h2>Michael Silva</h2>
              <p class="item-meta">michael@email.com</p>
            </div>
          </div>
          <div class="form-grid">
            <div class="field">
              <label for="theme">Tema</label>
              <select id="theme">
                <option>Claro</option>
                <option>Escuro</option>
                <option>Sistema</option>
              </select>
            </div>
            <div class="field">
              <label for="currency">Moeda</label>
              <select id="currency">
                <option>Real brasileiro (BRL)</option>
                <option>Dólar americano (USD)</option>
              </select>
            </div>
            <div class="field">
              <label for="language">Idioma</label>
              <select id="language">
                <option>Português</option>
                <option>English</option>
              </select>
            </div>
            <div class="field">
              <label for="email">Email</label>
              <input id="email" type="email" value="michael@email.com">
            </div>
          </div>
          <div class="form-actions">
            <button class="btn-primary" type="button" data-action="show-toast"><i class="fa-solid fa-check"></i> Salvar alterações</button>
          </div>
        </section>

        <section class="premium-card">
          <h2>Segurança e notificações</h2>
          <div class="settings-list">
            <div class="setting-row">
              <div>
                <strong class="item-title">Notificações</strong>
                <p class="item-meta">Receba lembretes úteis, sem excesso.</p>
              </div>
              <span class="switch" aria-hidden="true"></span>
            </div>
            <button class="setting-row" type="button" data-action="show-toast">
              <div>
                <strong class="item-title">Alterar senha</strong>
                <p class="item-meta">Atualize sua senha de acesso.</p>
              </div>
              <i class="fa-solid fa-chevron-right"></i>
            </button>
            <button class="setting-row" type="button" data-action="delete-account">
              <div>
                <strong class="item-title text-expense">Excluir conta</strong>
                <p class="item-meta">Sempre pediremos confirmação antes.</p>
              </div>
              <i class="fa-solid fa-chevron-right text-expense"></i>
            </button>
          </div>
        </section>
      </div>
    </section>
  `;
}

function renderRoute() {
  const route = getRoute();
  const viewRoute = route === "investimento-novo" ? "patrimonio" : route;
  setActiveRoute(viewRoute);

  app.innerHTML = `
    <section class="app-page">
      <div class="skeleton"></div>
      <div class="skeleton"></div>
    </section>
  `;

  window.setTimeout(() => {
    const views = {
      dashboard: dashboardView,
      transacoes: transactionsView,
      patrimonio: wealthView,
      "investimento-detalhe": investmentDetailView,
      "contas-resumo": billsSummaryView,
      "contas-despesas": billsView,
      "contas-cartoes": cardsView,
      "cartao-detalhe": cardDetailView,
      metas: goalsView,
      perfil: profileView,
    };

    app.innerHTML = views[viewRoute]();

    if (viewRoute === "transacoes") renderTransactionsTable();
    if (viewRoute === "contas-despesas") renderBillsList();
    if (route === "investimento-novo") openInvestmentModal();
  }, 120);
}

document.addEventListener("input", (event) => {
  if (event.target.closest("#transactionFilters")) renderTransactionsTable();
  if (event.target.closest("#billFilters")) renderBillsList();
});

document.addEventListener("change", (event) => {
  if (event.target.closest("#transactionFilters")) renderTransactionsTable();
  if (event.target.closest("#billFilters")) renderBillsList();
});

document.addEventListener("submit", (event) => {
  if (event.target.matches("#expenseForm")) {
    event.preventDefault();
    addExpenseFromForm();
    return;
  }

  if (event.target.matches("#investmentForm")) {
    event.preventDefault();
    addInvestmentFromForm();
    return;
  }

  if (event.target.matches("#billForm")) {
    event.preventDefault();
    addBillFromForm();
    return;
  }

  if (event.target.matches("#cardForm")) {
    event.preventDefault();
    addCardFromForm();
  }
});

document.addEventListener("click", (event) => {
  const investmentCalendarTrigger = event.target.closest("[data-investment-calendar-trigger]");
  const investmentCalendarNav = event.target.closest("[data-investment-calendar-nav]");
  const investmentCalendarDay = event.target.closest("[data-investment-calendar-day]");

  if (investmentCalendarTrigger) {
    toggleInvestmentCalendar();
    return;
  }

  if (investmentCalendarNav) {
    const direction = investmentCalendarNav.dataset.investmentCalendarNav === "next" ? 1 : -1;
    investmentCalendarVisibleDate = new Date(
      investmentCalendarVisibleDate.getFullYear(),
      investmentCalendarVisibleDate.getMonth() + direction,
      1
    );
    renderInvestmentCalendar();
    return;
  }

  if (investmentCalendarDay) {
    setInvestmentDate(investmentCalendarDay.dataset.investmentCalendarDay);
    closeInvestmentCalendar();
    return;
  }

  if (
    investmentModal &&
    !investmentModal.classList.contains("isHidden") &&
    !event.target.closest("#investmentCalendar") &&
    !event.target.closest("[data-investment-calendar-trigger]")
  ) {
    closeInvestmentCalendar();
  }

  const calendarTrigger = event.target.closest("[data-calendar-trigger]");
  const calendarNav = event.target.closest("[data-calendar-nav]");
  const calendarDay = event.target.closest("[data-calendar-day]");

  if (calendarTrigger) {
    toggleExpenseCalendar();
    return;
  }

  if (calendarNav) {
    const direction = calendarNav.dataset.calendarNav === "next" ? 1 : -1;
    calendarVisibleDate = new Date(calendarVisibleDate.getFullYear(), calendarVisibleDate.getMonth() + direction, 1);
    renderExpenseCalendar();
    return;
  }

  if (calendarDay) {
    setExpenseDate(calendarDay.dataset.calendarDay);
    closeExpenseCalendar();
    return;
  }

  if (
    expenseModal &&
    !expenseModal.classList.contains("isHidden") &&
    !event.target.closest("#expenseCalendar") &&
    !event.target.closest("[data-calendar-trigger]")
  ) {
    closeExpenseCalendar();
  }

  const expenseSelect = event.target.closest("[data-expense-select]");
  if (expenseSelect) {
    const selectedItem = event.target.closest("li");
    const isOpen = expenseSelect.classList.contains("is-open");

    document.querySelectorAll("[data-expense-select].is-open").forEach((select) => {
      if (select !== expenseSelect) select.classList.remove("is-open");
    });

    if (!isOpen) {
      expenseSelect.classList.add("is-open");
      return;
    }

    if (selectedItem) {
      const hiddenInput = expenseSelect.previousElementSibling;
      if (hiddenInput) hiddenInput.value = selectedItem.dataset.value;
      expenseSelect.prepend(selectedItem);
    }

    expenseSelect.classList.remove("is-open");
    collapseExpenseSelect(expenseSelect);
    return;
  }

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

  if (action === "add-bill") {
    openBillModal();
    return;
  }

  if (action === "add-card") {
    openCardModal();
    return;
  }

  if (action === "toggle-bill-paid") {
    const bill = bills.find((item) => item.id === Number(event.target.closest("[data-bill-id]")?.dataset.billId));
    if (bill) {
      bill.paid = !bill.paid;
      showToast(bill.paid ? "Conta marcada como paga." : "Conta voltou para pendente.");
      if (getRoute() === "contas-despesas") renderBillsList();
      if (getRoute() === "contas-resumo") renderRoute();
    }
    return;
  }

  if (action === "delete-bill") {
    const confirmed = window.confirm("Tem certeza que deseja excluir esta conta?");
    if (confirmed) {
      const billIndex = bills.findIndex((item) => item.id === Number(event.target.closest("[data-bill-id]")?.dataset.billId));
      if (billIndex >= 0) bills.splice(billIndex, 1);
      showToast("Conta excluída com segurança.");
      if (getRoute() === "contas-despesas") renderBillsList();
      if (getRoute() === "contas-resumo") renderRoute();
    }
    return;
  }

  if (action === "delete-card") {
    const confirmed = window.confirm("Tem certeza que deseja excluir este cartão?");
    if (confirmed) {
      const cardIndex = creditCards.findIndex((card) => card.name === event.target.closest("[data-card-name]")?.dataset.cardName);
      if (cardIndex >= 0) creditCards.splice(cardIndex, 1);
      showToast("Cartão excluído com segurança.");
      if (["contas-cartoes", "cartao-detalhe"].includes(getRoute())) renderRoute();
    }
    return;
  }

  if (action === "edit-bill") {
    showToast("Edição da conta pronta para ajuste.");
    return;
  }

  if (action === "delete-investment") {
    const confirmed = window.confirm("Tem certeza que deseja excluir este investimento?");
    if (confirmed) showToast("Investimento excluído com segurança.");
    return;
  }

  if (action === "delete-account") {
    const confirmed = window.confirm("Tem certeza que deseja excluir sua conta? Essa ação exige confirmação.");
    if (confirmed) showToast("Solicitação de exclusão registrada.");
    return;
  }

  if (action === "add-transaction") {
    openExpenseModal();
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

  showToast();
});

quickAction.addEventListener("click", () => {
  toggleQuickActionMenu();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeInvestmentCalendar();
    closeQuickActionMenu();
  }

  if (event.key === "Escape" && !expenseModal?.classList.contains("isHidden")) {
    closeExpenseDialog();
  }

  if (event.key === "Escape" && !investmentModal?.classList.contains("isHidden")) {
    closeInvestmentDialog();
  }

  if (event.key === "Escape" && !billModal?.classList.contains("isHidden")) {
    closeBillDialog();
  }

  if (event.key === "Escape" && !cardModal?.classList.contains("isHidden")) {
    closeCardDialog();
  }
});

initializeExpenseSelects();
initializeInvestmentCalendar();
window.addEventListener("hashchange", renderRoute);
renderRoute();
