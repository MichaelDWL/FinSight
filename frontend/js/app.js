const app = document.querySelector("#app");
const pageTitle = document.querySelector("#pageTitle");
const toast = document.querySelector("#toast");
const quickAction = document.querySelector("#quickAction");
const expenseModal = document.querySelector("#expenseModal");
const expenseForm = document.querySelector("#expenseForm");
const closeExpenseModal = document.querySelector("#closeExpenseModal");
const cancelExpenseForm = document.querySelector("#cancelExpenseForm");
const expenseCalendar = document.querySelector("#expenseCalendar");
const expenseDateInput = document.querySelector("#date-expense");
const expenseDateDisplay = document.querySelector("#date-expense-display");

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

function getRoute() {
  const route = window.location.hash.replace("#", "") || "dashboard";
  return routeTitles[route] ? route : "dashboard";
}

function setActiveRoute(route) {
  const activeRoute = ["investimento-novo", "investimento-detalhe"].includes(route) ? "patrimonio" : route;

  document.querySelectorAll("[data-route]").forEach((link) => {
    const isActive = link.dataset.route === activeRoute;
    link.classList.toggle("nav-link-active", isActive);
    link.closest(".nav-item")?.classList.toggle("nav-active", isActive);
  });

  pageTitle.textContent = routeTitles[route];
  quickAction.querySelector(".fab-add-label").textContent =
    route === "investimento-novo" ? "Salvar" : "Adicionar";
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
          <a class="btn-primary" href="#investimento-novo"><i class="fa-solid fa-plus"></i> Novo investimento</a>
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

function wealthView() {
  const total = investments.reduce((sum, investment) => sum + investment.current, 0);
  const invested = investments.reduce((sum, investment) => sum + investment.invested, 0);

  return `
    <section class="app-page">
      <div class="page-hero">
        <div>
          <span class="page-eyebrow">Patrimônio</span>
          <h1 class="page-title">Tudo que você construiu em um só lugar.</h1>
          <p class="page-subtitle">Acompanhe sua reserva, investimentos e crescimento sem precisar entender termos complexos.</p>
        </div>
        <a class="btn-primary" href="#investimento-novo"><i class="fa-solid fa-plus"></i> Adicionar investimento</a>
      </div>

      <div class="metrics-grid">
        ${metricCard("Patrimônio total", formatCurrency(total), "fa-gem", "Valor atual consolidado")}
        ${metricCard("Total investido", formatCurrency(invested), "fa-piggy-bank", "Quanto você aplicou")}
        ${metricCard("Investimentos", investments.length, "fa-layer-group", "Itens acompanhados")}
        ${metricCard("Lucro", formatCurrency(total - invested), "fa-arrow-trend-up", "Rentabilidade acumulada", "income")}
      </div>

      <div class="wealth-grid">
        <section class="premium-card">
          <div class="card-title-row">
            <h2>Lista dos investimentos</h2>
            <span class="pill">${investments.length} ativos</span>
          </div>
          <div class="investments-grid">${investments.map((investment) => investmentCard(investment)).join("")}</div>
        </section>

        <section class="chart-card">
          <h2>Distribuição simples</h2>
          <div class="bar-chart">
            <span style="height: 88%" data-label="Reserva"></span>
            <span style="height: 54%" data-label="Cripto"></span>
            <span style="height: 68%" data-label="R. fixa"></span>
          </div>
        </section>
      </div>
    </section>
  `;
}

function newInvestmentView() {
  return `
    <section class="app-page">
      <div class="page-hero">
        <div>
          <span class="page-eyebrow">Novo investimento</span>
          <h1 class="page-title">Cadastre só o essencial.</h1>
          <p class="page-subtitle">O formulário foi desenhado para ser rápido. A prévia mostra como o investimento aparecerá na sua carteira.</p>
        </div>
      </div>

      <div class="form-layout">
        <form class="form-card" id="investmentForm">
          <h2>Adicionar investimento</h2>
          <div class="form-grid">
            <div class="field">
              <label for="investmentName">Nome</label>
              <input id="investmentName" name="name" type="text" required placeholder="Ex.: Nubank">
            </div>
            <div class="field">
              <label for="investmentCategory">Categoria</label>
              <select id="investmentCategory" name="category">
                <option>Poupança</option>
                <option>Renda fixa</option>
                <option>Cripto</option>
                <option>Fundo</option>
                <option>Ações</option>
              </select>
            </div>
            <div class="field">
              <label for="investmentInstitution">Instituição</label>
              <input id="investmentInstitution" name="institution" type="text" placeholder="Ex.: Nubank">
            </div>
            <div class="field investment-date-field">
              <label for="investmentDateDisplay">Data</label>
              <div class="investment-date-input" data-investment-calendar-trigger>
                <i class="fa-regular fa-calendar-days"></i>
                <input id="investmentDateDisplay" type="text" readonly placeholder="Selecione a data">
                <input id="investmentDate" name="date" type="hidden">
              </div>
              <div class="investment-calendar is-hidden" id="investmentCalendar" aria-label="Calendário do investimento"></div>
            </div>
            <div class="field">
              <label for="investmentInvested">Valor investido</label>
              <input id="investmentInvested" name="invested" type="number" min="0" step="0.01" placeholder="0,00">
            </div>
            <div class="field">
              <label for="investmentCurrent">Valor atual</label>
              <input id="investmentCurrent" name="current" type="number" min="0" step="0.01" placeholder="0,00">
            </div>
            <div class="field field-wide">
              <label for="investmentNotes">Observações</label>
              <textarea id="investmentNotes" name="notes" placeholder="Adicione uma observação curta, se quiser."></textarea>
            </div>
          </div>
          <div class="form-actions">
            <a class="btn-secondary" href="#patrimonio">Cancelar</a>
            <button class="btn-primary" type="submit"><i class="fa-solid fa-check"></i> Salvar</button>
          </div>
        </form>

        <aside class="premium-card preview-card">
          <div class="card-title-row">
            <h2>Prévia</h2>
            <span class="pill">Ao vivo</span>
          </div>
          <div id="investmentPreview"></div>
        </aside>
      </div>
    </section>
  `;
}

function updateInvestmentPreview() {
  const preview = document.querySelector("#investmentPreview");
  const form = document.querySelector("#investmentForm");
  if (!preview || !form) return;

  const formData = new FormData(form);
  const invested = Number(formData.get("invested")) || 0;
  const current = Number(formData.get("current")) || 0;
  const returnRate = invested > 0 ? Math.round(((current - invested) / invested) * 100) : 0;

  preview.innerHTML = investmentCard({
    icon: formData.get("category") === "Cripto" ? "₿" : "🏦",
    name: formData.get("name") || "Nome do investimento",
    category: formData.get("category") || "Categoria",
    institution: formData.get("institution") || "Instituição",
    invested,
    current,
    date: formData.get("date") || new Date().toISOString(),
    returnRate,
  });
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
  updateInvestmentPreview();
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
  const investment = investments[0];
  const profit = investment.current - investment.invested;

  return `
    <section class="app-page">
      <div class="page-hero">
        <div>
          <span class="page-eyebrow">Detalhes</span>
          <h1 class="page-title">${investment.name}</h1>
          <p class="page-subtitle">${investment.notes}</p>
        </div>
        <div class="hero-actions">
          <button class="btn-secondary" type="button" data-action="show-toast"><i class="fa-solid fa-pen"></i> Editar</button>
          <button class="btn-danger" type="button" data-action="delete-investment"><i class="fa-solid fa-trash"></i> Excluir</button>
        </div>
      </div>

      <div class="detail-stat-grid">
        <div class="detail-stat"><span>Instituição</span><strong>${investment.institution}</strong></div>
        <div class="detail-stat"><span>Categoria</span><strong>${investment.category}</strong></div>
        <div class="detail-stat"><span>Valor investido</span><strong>${formatCurrency(investment.invested)}</strong></div>
        <div class="detail-stat"><span>Valor atual</span><strong>${formatCurrency(investment.current)}</strong></div>
        <div class="detail-stat"><span>Lucro</span><strong class="text-income">${formatCurrency(profit)}</strong></div>
        <div class="detail-stat"><span>Rentabilidade</span><strong class="text-income">+${investment.returnRate}%</strong></div>
      </div>

      <div class="detail-grid">
        <section class="premium-card">
          <h2>Histórico de atualizações</h2>
          <div class="mini-list">
            <div class="history-item"><span>Hoje</span><strong>${formatCurrency(investment.current)}</strong></div>
            <div class="history-item"><span>Junho de 2026</span><strong>${formatCurrency(8200)}</strong></div>
            <div class="history-item"><span>Maio de 2026</span><strong>${formatCurrency(7900)}</strong></div>
          </div>
        </section>
        <section class="chart-card">
          <h2>Evolução do investimento</h2>
          <div class="line-chart">
            <span style="height: 44%" data-label="Mar"></span>
            <span style="height: 50%" data-label="Abr"></span>
            <span style="height: 58%" data-label="Mai"></span>
            <span style="height: 72%" data-label="Jun"></span>
            <span style="height: 86%" data-label="Jul"></span>
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
  setActiveRoute(route);

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
      "investimento-novo": newInvestmentView,
      "investimento-detalhe": investmentDetailView,
      metas: goalsView,
      perfil: profileView,
    };

    app.innerHTML = views[route]();

    if (route === "transacoes") renderTransactionsTable();
    if (route === "investimento-novo") {
      initializeInvestmentCalendar();
      updateInvestmentPreview();
    }
  }, 120);
}

document.addEventListener("input", (event) => {
  if (event.target.closest("#transactionFilters")) renderTransactionsTable();
  if (event.target.closest("#investmentForm")) updateInvestmentPreview();
});

document.addEventListener("change", (event) => {
  if (event.target.closest("#transactionFilters")) renderTransactionsTable();
  if (event.target.closest("#investmentForm")) updateInvestmentPreview();
});

document.addEventListener("submit", (event) => {
  if (event.target.matches("#expenseForm")) {
    event.preventDefault();
    addExpenseFromForm();
    return;
  }

  if (!event.target.matches("#investmentForm")) return;

  event.preventDefault();
  showToast("Investimento salvo com sucesso.");
  window.location.hash = "patrimonio";
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
    getRoute() === "investimento-novo" &&
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

  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;

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

  if (action === "add-goal") {
    showToast("Nova meta pronta para cadastro.");
    return;
  }

  showToast();
});

quickAction.addEventListener("click", () => {
  const route = getRoute();

  if (route === "dashboard" || route === "transacoes") {
    openExpenseModal();
    return;
  }

  if (route === "patrimonio" || route === "investimento-detalhe") {
    window.location.hash = "investimento-novo";
    return;
  }

  if (route === "metas") {
    showToast("Nova meta pronta para cadastro.");
    return;
  }

  if (route === "investimento-novo") {
    document.querySelector("#investmentForm")?.requestSubmit();
    return;
  }

  window.location.hash = "transacoes";
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeInvestmentCalendar();
  }

  if (event.key === "Escape" && !expenseModal?.classList.contains("isHidden")) {
    closeExpenseDialog();
  }
});

initializeExpenseSelects();
window.addEventListener("hashchange", renderRoute);
renderRoute();
