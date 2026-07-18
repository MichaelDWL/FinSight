import { store } from "../store.js";
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
