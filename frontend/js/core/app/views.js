import { store } from "../store.js";
import { escapeHtml } from "../../utils/dom.js";
import { formatCurrency } from "../../utils/currency.js";
import { getUserFirstName } from "./userHeader.js";
import { renderHomeDashboard } from "../../modules/home/render.js";
import {
  render as renderTransactionsPage,
  renderTable as renderTransactionsTableView,
} from "../../modules/transactions/render.js";
import * as accountsModule from "../../modules/accounts/render.js";
import * as cardsModule from "../../modules/cards/render.js";
import * as investmentsModule from "../../modules/investments/render.js";
import * as goalsModule from "../../modules/goals/render.js";
import { renderProfilePage } from "../../modules/profile/render.js";
import { renderAdminPage } from "../../modules/admin/render.js";

export function getTransactionStatus(transaction) {
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

export function transactionItem(transaction) {
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

export function dashboardView() {
  return renderHomeDashboard({
    dashboardData: store.dashboardData,
    transactions: store.transactions,
    investments: store.investments,
    creditCards: store.creditCards,
    goals: store.goals,
    firstName: getUserFirstName(),
  });
}

export function transactionsView() {
  return renderTransactionsPage();
}

export function renderTransactionsTable() {
  renderTransactionsTableView(store.transactions);
}

export function billsSummaryView() {
  return accountsModule.renderSummary(store.bills, store.currentInvoices);
}

export function billsView() {
  return accountsModule.renderBillsPage();
}

export function renderBillsList() {
  accountsModule.renderBillsList(store.bills);
}

export function cardsView() {
  return cardsModule.render(store.creditCards);
}

export function accountsView() {
  return accountsModule.render(store.accounts);
}

export function accountDetailView() {
  return accountsModule.renderDetail(store.accountDetailData);
}

export function cardDetailView() {
  return cardsModule.renderDetail(store.cardDetailData, store.creditCards);
}

export function restoreAllPurchases() {
  cardsModule.restoreAllPurchases(store.cardDetailData);
}

export function swapPurchasesContent(html) {
  cardsModule.swapPurchasesContent(html);
}

export function renderPurchasesList(purchases) {
  return cardsModule.renderPurchasesList(purchases);
}

export function renderInvoiceItems(items) {
  return cardsModule.renderInvoiceItems(items);
}

export function wealthView() {
  return investmentsModule.renderWealth(
    store.accounts,
    store.investments,
    store.creditCards,
    store.portfolioSummary,
  );
}

export function investmentDetailView() {
  return investmentsModule.renderDetail(store.investments);
}

export function mountInvestmentDetailCharts() {
  investmentsModule.mountDetailCharts(store.investments);
}

export function goalsView() {
  return goalsModule.render(store.goals);
}

export function profileView() {
  return renderProfilePage({
    user: store.currentUser,
    personalization: store.personalizationContext,
  });
}

export function adminView() {
  return renderAdminPage();
}
