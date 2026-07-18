/**
 * Transações — renderização da página e tabela filtrada.
 */
import { escapeHtml } from "../../utils/dom.js";
import { formatCurrency } from "../../utils/currency.js";

export function render() {
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

export function renderTable(transactions = []) {
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
              <strong class="item-title">${escapeHtml(transaction.description)}</strong>
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
                <strong class="item-title">${escapeHtml(transaction.description)}</strong>
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
