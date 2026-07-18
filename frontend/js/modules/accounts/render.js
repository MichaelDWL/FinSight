import { escapeHtml } from "../../utils/dom.js";
import { formatCurrency } from "../../utils/currency.js";
import {
  formatDateLabel,
  toIsoDate,
  relativeDayLabel,
  formatMonthYear,
} from "../../utils/dates.js";
import { resolveIcon } from "../../utils/icons.js";
import {
  accountTypeLabel,
  movementTypeLabel,
  invoiceStatusMeta,
} from "../../utils/labels.js";
import { metricCard } from "../../components/metric/metricCard.js";


export function getBillStatus(bill) {
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

export function billCard(bill, compact = false) {
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
          <h3 class="item-title">${escapeHtml(bill.name)}</h3>
          <p class="item-meta">${escapeHtml(bill.category)} • vence em ${formatDateLabel(bill.dueDate)}</p>
          ${compact ? "" : `<p class="item-meta">${escapeHtml(bill.account)} • ${escapeHtml(bill.payment)}</p>`}
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

export function accountSummary(account) {
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

export function renderSummary(bills, currentInvoices) {
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

export function renderBillsPage() {
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

export function renderBillsList(bills) {
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

export function render(accounts) {
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

function accountMovementRow(movement) {
  const amountClass =
    movement.flow === "in" ? "amount-positive" : "amount-negative";

  return `
    <div class="history-item">
      <div>
        <strong class="item-title">${escapeHtml(movement.description)}</strong>
        <p class="item-meta">${movement.category || movementTypeLabel(movement.type)} • ${formatDateLabel(movement.date)}</p>
      </div>
      <strong class="${amountClass}">${formatCurrency(movement.value)}</strong>
    </div>`;
}

export function renderDetail(accountDetailData) {
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
