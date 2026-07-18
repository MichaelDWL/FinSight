import {
  expenseModal,
  expenseForm,
  investmentModal,
  investmentForm,
  billModal,
  billForm,
  cardModal,
  cardForm,
  accountModal,
  accountForm,
} from "./elements.js";
import { store } from "../store.js";
import { accountsService } from "../../services/accounts.js";
import { billsService } from "../../services/bills.js";
import { cardsService } from "../../services/cards.js";
import { investmentsService } from "../../services/investments.js";
import { transactionsService } from "../../services/transactions.js";
import { resolveIcon } from "../../utils/icons.js";
import { mapPaymentMethod, mapPaymentLabel } from "../../utils/payment.js";
import { normalizeCardLastDigits } from "../../utils/normalize.js";
import { toIsoDate, getIsoDateValue } from "../../utils/dates.js";
import {
  initCustomSelects,
  refreshCustomSelectValue,
} from "../../components/select/customSelect.js";
import {
  closeAllCustomCalendars,
  initCustomCalendars,
  refreshCustomCalendarValue,
  setCustomCalendarValue,
} from "../../components/calendar/customCalendar.js";
import { hideModal, showModal } from "../../components/modal/modalFocus.js";
import {
  buildInvestmentPayload,
  buildSimulationPayload,
  isFixedIncomeType,
  renderProjectionPanel,
  syncInvestmentFormFields,
} from "../../modules/investments/form.js";
import { getRoute } from "../router.js";
import {
  closeQuickActionMenu,
  setInvestmentsMenuExpanded,
  setAccountsMenuExpanded,
  setActiveRoute,
  setInvestmentSubroute,
} from "./navigation.js";
import { showToast } from "./toast.js";
import { reloadAndRender } from "./renderRoute.js";

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

export function updateCardColorPreview(color = "#0d6efd") {
  const picker = cardForm?.querySelector(".card-color-picker");
  const valueLabel = cardForm?.querySelector(".card-color-value");
  if (!picker) return;

  picker.style.setProperty("--selected-card-color", color);
  if (valueLabel) valueLabel.textContent = color.toUpperCase();
}

export function updateAccountColorPreview(color = "#0d6efd") {
  const picker = accountForm?.querySelector(".card-color-picker");
  const valueLabel = accountForm?.querySelector(".card-color-value");
  if (!picker) return;

  picker.style.setProperty("--selected-card-color", color);
  if (valueLabel) valueLabel.textContent = color.toUpperCase();
}

export function setAccountIcon(icon = "fa-building-columns") {
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

export function openExpenseModal(transaction = null) {
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

export function closeExpenseDialog({ reset = false } = {}) {
  if (!expenseModal) return;

  closeAllCustomCalendars();
  hideModal(expenseModal);

  if (reset) {
    expenseForm?.reset();
    store.editingTransactionId = null;
  }
}

export function openInvestmentModal(investment = null) {
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

export function scheduleInvestmentSimulation() {
  clearTimeout(store.investmentSimulationTimer);
  store.investmentSimulationTimer = setTimeout(() => {
    refreshInvestmentSimulation();
  }, 350);
}

export function closeInvestmentDialog({ reset = false } = {}) {
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

export function openBillModal(bill = null) {
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

export function closeBillDialog({ reset = false } = {}) {
  if (!billModal) return;

  closeAllCustomCalendars();
  hideModal(billModal);
  if (reset) {
    billForm?.reset();
    store.editingBillId = null;
  }
}

export function openCardModal(card = null) {
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

export function closeCardDialog({ reset = false } = {}) {
  if (!cardModal) return;

  hideModal(cardModal);
  if (reset) {
    cardForm?.reset();
    store.editingCardId = null;
  }
}

export function openAccountModal(account = null) {
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

export function closeAccountDialog({ reset = false } = {}) {
  if (!accountModal) return;

  hideModal(accountModal);
  if (reset) {
    accountForm?.reset();
    store.editingAccountId = null;
  }
}

export async function addExpenseFromForm() {
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

export async function addInvestmentFromForm() {
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

export async function addBillFromForm() {
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

export async function addCardFromForm() {
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

export async function addAccountFromForm() {
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
