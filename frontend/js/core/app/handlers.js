import {
  expenseModal,
  investmentModal,
  investmentForm,
  billModal,
  cardModal,
  accountModal,
  quickActionMenu,
} from "./elements.js";
import { store } from "../store.js";
import { getRoute } from "../router.js";
import { invoicesService } from "../../services/invoices.js";
import { billsService } from "../../services/bills.js";
import { cardsService } from "../../services/cards.js";
import { accountsService } from "../../services/accounts.js";
import { investmentsService } from "../../services/investments.js";
import { privacyService } from "../../services/privacy.js";
import { confirmDialog } from "../../components/modal/confirmModal.js";
import { closeAllCustomCalendars } from "../../components/calendar/customCalendar.js";
import { syncInvestmentFormFields } from "../../modules/investments/form.js";
import {
  closeExpenseDialog,
  closeInvestmentDialog,
  closeBillDialog,
  closeCardDialog,
  closeAccountDialog,
  setAccountIcon,
  openExpenseModal,
  openInvestmentModal,
  openBillModal,
  openCardModal,
  openAccountModal,
  updateCardColorPreview,
  updateAccountColorPreview,
  scheduleInvestmentSimulation,
  addExpenseFromForm,
  addInvestmentFromForm,
  addBillFromForm,
  addCardFromForm,
  addAccountFromForm,
} from "./modals.js";
import {
  closeQuickActionMenu,
  toggleInvestmentsMenu,
  toggleAccountsMenu,
  toggleDashboardsMenu,
} from "./navigation.js";
import {
  renderTransactionsTable,
  renderBillsList,
  restoreAllPurchases,
  swapPurchasesContent,
  renderInvoiceItems,
} from "./views.js";
import {
  reloadDashboardWithPeriod,
  renderAnalyticsDashboardPage,
} from "./analyticsDashboard.js";
import { reloadAndRender } from "./renderRoute.js";
import { movementModal } from "./movement.js";
import { showToast } from "./toast.js";

export function onFiltersInput(event) {
  if (event.target.closest("#transactionFilters")) renderTransactionsTable();
  if (event.target.closest("#billFilters")) renderBillsList();
  if (event.target.matches("#cardColor"))
    updateCardColorPreview(event.target.value);
  if (event.target.matches("#accountColor"))
    updateAccountColorPreview(event.target.value);
}

export function onFiltersChange(event) {
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

export function onInvestmentFormInput(event) {
  if (event.target.closest("#investmentForm")) {
    scheduleInvestmentSimulation();
  }
}

export async function onFormSubmit(event) {
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

export async function onDocumentClick(event) {
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

export function onDocumentKeydown(event) {
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
