import { movementsService } from "../services/movements.js";

// Modal dinamico unico de "Nova Movimentacao".
// Fluxo: (1) escolha do tipo -> (2) formulario dinamico -> (3) resumo -> salvar.
// Reaproveita as classes visuais de .new-expense-card / .expense-field.

const TYPES = [
  {
    key: "receita",
    icon: "💰",
    title: "Receita",
    desc: "Entrada de dinheiro na sua conta.",
    accent: "#16a34a",
  },
  {
    key: "despesa",
    icon: "💸",
    title: "Despesa",
    desc: "Um gasto pontual do dia a dia.",
    accent: "#ef4444",
  },
  {
    key: "conta",
    icon: "🧾",
    title: "Conta Mensal",
    desc: "Contas fixas, assinaturas e recorrências.",
    accent: "#f59e0b",
  },
  {
    key: "cartao",
    icon: "💳",
    title: "Compra no Cartão",
    desc: "À vista ou parcelada na fatura.",
    accent: "#8b5cf6",
  },
  {
    key: "transferencia",
    icon: "🔄",
    title: "Transferência",
    desc: "Mova saldo entre suas contas.",
    accent: "#0ea5e9",
  },
];

const TYPE_MAP = Object.fromEntries(TYPES.map((type) => [type.key, type]));

const CATEGORIES = {
  receita: ["Salário", "Freelance", "Investimentos", "Outros"],
  despesa: [
    "Moradia",
    "Alimentação",
    "Transporte",
    "Saúde",
    "Lazer",
    "Educação",
    "Assinaturas",
    "Outros",
  ],
};
CATEGORIES.conta = CATEGORIES.despesa;
CATEGORIES.cartao = CATEGORIES.despesa;

const PAYMENTS = [
  { label: "Pix", code: "pix" },
  { label: "Cartão de Débito", code: "debito" },
  { label: "Cartão de Crédito", code: "cartao_credito" },
  { label: "Dinheiro", code: "dinheiro" },
  { label: "Boleto", code: "boleto" },
];

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function todayIso() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function toIso(value) {
  if (!value) return "";
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  const offset = parsed.getTimezoneOffset() * 60000;
  return new Date(parsed.getTime() - offset).toISOString().slice(0, 10);
}

function formatDateBr(iso) {
  const value = toIso(iso);
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function paymentLabelFromCode(code) {
  const found = PAYMENTS.find((item) => item.code === code);
  if (found) return found.label;
  const byLabel = PAYMENTS.find(
    (item) => item.label.toLowerCase() === String(code || "").toLowerCase(),
  );
  return byLabel ? byLabel.label : "Pix";
}

export function createMovementModal({
  getAccounts,
  getCards,
  onSaved,
  showToast,
}) {
  const modal = document.querySelector("#movementModal");
  const body = document.querySelector("#movementBody");
  const titleEl = document.querySelector("#movementModalTitle");
  const subtitleEl = document.querySelector("#movementSubtitle");
  const tagEl = document.querySelector("#movementTag");
  const closeBtn = document.querySelector("#closeMovementModal");

  if (!modal || !body) {
    return { open() {}, openType() {}, openEdit() {}, close() {} };
  }

  const state = { type: null, step: "type", editId: null, saving: false };

  function hasAccounts() {
    return (getAccounts() || []).length > 0;
  }

  function accountsOptions(selectedId, { includeEmpty = true } = {}) {
    const list = getAccounts() || [];
    if (!list.length) {
      return `<option value="" disabled selected>Nenhuma conta cadastrada</option>`;
    }
    const options = includeEmpty
      ? [`<option value="">Nenhuma (não afeta saldo)</option>`]
      : [];
    for (const account of list) {
      const selected = String(account.id) === String(selectedId) ? " selected" : "";
      options.push(
        `<option value="${escapeHtml(account.id)}"${selected}>${escapeHtml(account.name)}</option>`,
      );
    }
    return options.join("");
  }

  function cardsOptions(selectedId) {
    const list = getCards() || [];
    if (!list.length) return "";
    return list
      .map((card) => {
        const selected = String(card.id) === String(selectedId) ? " selected" : "";
        return `<option value="${escapeHtml(card.id)}"${selected}>${escapeHtml(card.name)}</option>`;
      })
      .join("");
  }

  function categoryOptions(type, selected) {
    return (CATEGORIES[type] || [])
      .map((category) => {
        const isSelected =
          String(category).toLowerCase() === String(selected || "").toLowerCase()
            ? " selected"
            : "";
        return `<option value="${escapeHtml(category)}"${isSelected}>${escapeHtml(category)}</option>`;
      })
      .join("");
  }

  function paymentOptions(selectedCode) {
    return PAYMENTS.map((item) => {
      const selected = item.code === selectedCode ? " selected" : "";
      return `<option value="${item.code}"${selected}>${escapeHtml(item.label)}</option>`;
    }).join("");
  }

  function field({ label, icon, control, wide = false, attrs = "" }) {
    return `
      <label class="expense-field${wide ? " expense-field-wide" : ""}"${attrs ? ` ${attrs}` : ""}>
        <span class="font-label">${label}</span>
        <div class="expense-input-wrapper">
          <i class="fa-solid ${icon}"></i>
          ${control}
        </div>
      </label>`;
  }

  function selectField({
    label,
    icon,
    name,
    options,
    wide = false,
    attrs = "",
    required = false,
  }) {
    return field({
      label,
      icon,
      wide,
      attrs,
      control: `<select name="${name}" class="input-basic"${required ? " required" : ""}>${options}</select>`,
    });
  }

  function updateHeader(type) {
    if (!type) {
      titleEl.textContent = "O que você deseja registrar?";
      subtitleEl.textContent =
        "Escolha um tipo para começar. Mostramos apenas o que importa.";
      tagEl.textContent = "Nova movimentação";
      return;
    }
    const config = TYPE_MAP[type];
    const editing = Boolean(state.editId);
    tagEl.textContent = `${config.icon} ${config.title}`;
    titleEl.textContent = editing
      ? `Editar ${config.title}`
      : config.title;
    subtitleEl.textContent = config.desc;
  }

  function animate() {
    const step = body.firstElementChild;
    if (!step) return;
    step.classList.remove("movement-step-in");
    void step.offsetWidth;
    step.classList.add("movement-step-in");
  }

  function renderTypeStep() {
    state.step = "type";
    updateHeader(null);
    const cards = TYPES.map(
      (type) => `
      <button type="button" class="movement-type-card" data-type="${type.key}" style="--type-accent:${type.accent}">
        <span class="movement-type-icon">${type.icon}</span>
        <span class="movement-type-info">
          <strong>${type.title}</strong>
          <span>${type.desc}</span>
        </span>
        <i class="fa-solid fa-chevron-right movement-type-chevron"></i>
      </button>`,
    ).join("");
    body.innerHTML = `<div class="movement-step"><div class="movement-type-grid">${cards}</div></div>`;
    animate();
  }

  function renderFormStep(type, record = null) {
    state.step = "form";
    state.type = type;
    updateHeader(type);

    const values = record || {};
    const dateValue = toIso(values.date || values.dueDate) || todayIso();
    const accountId = values.accountId || "";
    const category = values.category || "";
    const paymentCode = values.paymentCode || "";
    const description = values.description || "";
    const amount = values.value != null ? Math.abs(Number(values.value)) : "";
    const notes = values.notes || "";

    let fields = "";
    let warning = "";

    if (type === "receita") {
      fields = `
        ${field({ label: "Descrição", icon: "fa-pen", wide: true, control: `<input type="text" name="description" class="input-basic" required placeholder="Ex.: Salário de janeiro" value="${escapeHtml(description)}">` })}
        ${field({ label: "Valor", icon: "fa-brazilian-real-sign", control: `<input type="number" name="value" class="input-basic" required min="0.01" step="0.01" placeholder="0,00" value="${escapeHtml(amount)}">` })}
        ${field({ label: "Data", icon: "fa-regular fa-calendar-days", control: `<input type="date" name="date" class="input-basic" required value="${dateValue}">` })}
        ${selectField({ label: "Conta", icon: "fa-building-columns", name: "accountId", options: accountsOptions(accountId, { includeEmpty: false }), required: true })}
        ${selectField({ label: "Categoria", icon: "fa-tags", name: "category", options: categoryOptions(type, category) })}
        ${field({ label: "Observação", icon: "fa-note-sticky", wide: true, control: `<input type="text" name="notes" class="input-basic" placeholder="Opcional" value="${escapeHtml(notes)}">` })}
      `;
    } else if (type === "despesa") {
      const paymentValue = paymentCode || "pix";
      const isCredit = paymentValue === "cartao_credito";
      const cardOpts = cardsOptions(values.cardId);
      const hidden = (cond) => (cond ? " movement-hidden" : "");
      const cardControl = cardOpts
        ? `<select name="cardId" class="input-basic">${cardOpts}</select>`
        : `<input type="text" class="input-basic" value="Nenhum cartão cadastrado" disabled>`;
      fields = `
        ${field({ label: "Descrição", icon: "fa-pen", wide: true, control: `<input type="text" name="description" class="input-basic" required placeholder="Ex.: Supermercado" value="${escapeHtml(description)}">` })}
        ${field({ label: "Valor", icon: "fa-brazilian-real-sign", control: `<input type="number" name="value" class="input-basic" required min="0.01" step="0.01" placeholder="0,00" value="${escapeHtml(amount)}">` })}
        ${field({ label: "Data", icon: "fa-regular fa-calendar-days", control: `<input type="date" name="date" class="input-basic" required value="${dateValue}">` })}
        ${selectField({ label: "Categoria", icon: "fa-tags", name: "category", options: categoryOptions(type, category) })}
        ${selectField({ label: "Forma de pagamento", icon: "fa-money-bill-wave", name: "payment", options: paymentOptions(paymentValue), attrs: `data-role="despesa-payment"` })}
        <label class="expense-field${hidden(isCredit)}" data-role="conta-field">
          <span class="font-label">Conta</span>
          <div class="expense-input-wrapper">
            <i class="fa-solid fa-building-columns"></i>
            <select name="accountId" class="input-basic"${isCredit ? "" : " required"}>${accountsOptions(accountId, { includeEmpty: false })}</select>
          </div>
        </label>
        <label class="expense-field${hidden(!isCredit)}" data-role="cartao-field">
          <span class="font-label">Cartão</span>
          <div class="expense-input-wrapper">
            <i class="fa-solid fa-credit-card"></i>
            ${cardControl}
          </div>
        </label>
        <label class="expense-field${hidden(!isCredit)}" data-role="parcelas-field">
          <span class="font-label">Parcelas</span>
          <div class="expense-input-wrapper">
            <i class="fa-solid fa-layer-group"></i>
            <input type="number" name="installments" class="input-basic" min="1" max="48" step="1" value="${escapeHtml(values.installments || 1)}">
          </div>
        </label>
        ${field({ label: "Observação", icon: "fa-note-sticky", wide: true, control: `<input type="text" name="notes" class="input-basic" placeholder="Opcional" value="${escapeHtml(notes)}">` })}
      `;
    } else if (type === "conta") {
      const recurringYes = values.recurring ? " selected" : "";
      const recurringNo = values.recurring ? "" : " selected";
      fields = `
        ${field({ label: "Nome da conta", icon: "fa-file-invoice-dollar", wide: true, control: `<input type="text" name="description" class="input-basic" required placeholder="Ex.: Energia, Internet, Aluguel" value="${escapeHtml(description)}">` })}
        ${field({ label: "Valor", icon: "fa-brazilian-real-sign", control: `<input type="number" name="value" class="input-basic" required min="0.01" step="0.01" placeholder="0,00" value="${escapeHtml(amount)}">` })}
        ${field({ label: "Vencimento", icon: "fa-regular fa-calendar-days", control: `<input type="date" name="date" class="input-basic" required value="${dateValue}">` })}
        ${selectField({ label: "Categoria", icon: "fa-tags", name: "category", options: categoryOptions(type, category) })}
        ${selectField({ label: "Conta bancária", icon: "fa-building-columns", name: "accountId", options: accountsOptions(accountId) })}
        ${selectField({ label: "Forma de pagamento", icon: "fa-money-bill-wave", name: "payment", options: paymentOptions(paymentCode || "boleto") })}
        ${selectField({ label: "Recorrente", icon: "fa-rotate-right", name: "recurring", options: `<option value="nao"${recurringNo}>Não</option><option value="sim"${recurringYes}>Sim</option>` })}
        ${field({ label: "Observação", icon: "fa-note-sticky", wide: true, control: `<input type="text" name="notes" class="input-basic" placeholder="Opcional" value="${escapeHtml(notes)}">` })}
      `;
    } else if (type === "cartao") {
      const cardOptions = cardsOptions(values.cardId);
      if (!cardOptions) {
        warning = `<p class="movement-warning"><i class="fa-solid fa-triangle-exclamation"></i> Cadastre um cartão antes de registrar uma compra.</p>`;
      }
      fields = `
        ${field({ label: "Descrição", icon: "fa-pen", wide: true, control: `<input type="text" name="description" class="input-basic" required placeholder="Ex.: Notebook" value="${escapeHtml(description)}">` })}
        ${selectField({ label: "Cartão", icon: "fa-credit-card", name: "cardId", options: cardOptions })}
        ${field({ label: "Valor total", icon: "fa-brazilian-real-sign", control: `<input type="number" name="value" class="input-basic" required min="0.01" step="0.01" placeholder="0,00" value="${escapeHtml(amount)}">` })}
        ${field({ label: "Parcelas", icon: "fa-layer-group", control: `<input type="number" name="installments" class="input-basic" min="1" max="48" step="1" value="${escapeHtml(values.installments || 1)}">` })}
        ${field({ label: "Data da compra", icon: "fa-regular fa-calendar-days", control: `<input type="date" name="date" class="input-basic" required value="${dateValue}">` })}
        ${selectField({ label: "Categoria", icon: "fa-tags", name: "category", options: categoryOptions(type, category) })}
        ${field({ label: "Observação", icon: "fa-note-sticky", wide: true, control: `<input type="text" name="notes" class="input-basic" placeholder="Opcional" value="${escapeHtml(notes)}">` })}
      `;
    } else if (type === "transferencia") {
      fields = `
        ${selectField({ label: "Conta de origem", icon: "fa-arrow-up-from-bracket", name: "fromAccountId", options: accountsOptions(values.fromAccountId, { includeEmpty: false }) })}
        ${selectField({ label: "Conta de destino", icon: "fa-arrow-down-to-bracket", name: "toAccountId", options: accountsOptions(values.toAccountId, { includeEmpty: false }) })}
        ${field({ label: "Valor", icon: "fa-brazilian-real-sign", control: `<input type="number" name="value" class="input-basic" required min="0.01" step="0.01" placeholder="0,00" value="${escapeHtml(amount)}">` })}
        ${field({ label: "Data", icon: "fa-regular fa-calendar-days", control: `<input type="date" name="date" class="input-basic" required value="${dateValue}">` })}
        ${field({ label: "Observação", icon: "fa-note-sticky", wide: true, control: `<input type="text" name="notes" class="input-basic" placeholder="Opcional" value="${escapeHtml(notes)}">` })}
      `;
    }

    const needsAccount = ["receita", "despesa", "conta", "transferencia"].includes(type);
    if (needsAccount && !hasAccounts()) {
      warning = `<p class="movement-warning"><i class="fa-solid fa-triangle-exclamation"></i> Cadastre uma conta antes de registrar esta movimentação, para que o saldo seja atualizado corretamente.</p>`;
    }

    // Despesa no credito depende de cartao (nao de conta); os demais tipos que
    // dependem de conta ficam bloqueados enquanto nao houver nenhuma cadastrada.
    const missingAccount = ["receita", "conta", "transferencia"].includes(type) && !hasAccounts();
    const nextDisabled =
      (type === "cartao" && !cardsOptions()) || missingAccount ? " disabled" : "";

    body.innerHTML = `
      <div class="movement-step">
        <form class="new-expense-form movement-form" novalidate>
          ${warning}
          <div class="inputs-list">${fields}</div>
          <div class="new-expense-actions">
            <button type="button" class="expense-secondary-btn" data-back>
              <i class="fa-solid fa-arrow-left"></i> Voltar
            </button>
            <button type="submit" class="expense-primary-btn"${nextDisabled}>
              Revisar <i class="fa-solid fa-arrow-right"></i>
            </button>
          </div>
        </form>
      </div>`;
    animate();
    if (type === "despesa") wireDespesaPaymentToggle();
    body.querySelector("input, select")?.focus();
  }

  // Despesa no cartao de credito espelha a compra no cartao: troca a "Conta"
  // pelo "Cartão" + "Parcelas" assim que a forma de pagamento muda.
  function wireDespesaPaymentToggle() {
    const form = body.querySelector("form");
    if (!form) return;
    const paymentSelect = form.querySelector('[data-role="despesa-payment"] select');
    const contaField = form.querySelector('[data-role="conta-field"]');
    const cartaoField = form.querySelector('[data-role="cartao-field"]');
    const parcelasField = form.querySelector('[data-role="parcelas-field"]');
    if (!paymentSelect) return;

    const contaSelect = contaField?.querySelector('select[name="accountId"]');
    const cardSelect = cartaoField?.querySelector('select[name="cardId"]');

    const sync = () => {
      const isCredit = paymentSelect.value === "cartao_credito";
      contaField?.classList.toggle("movement-hidden", isCredit);
      cartaoField?.classList.toggle("movement-hidden", !isCredit);
      parcelasField?.classList.toggle("movement-hidden", !isCredit);
      // Mantem o "required" apenas no campo visivel, evitando travar o submit
      // com um controle oculto obrigatorio.
      if (contaSelect) contaSelect.required = !isCredit && hasAccounts();
      if (cardSelect) cardSelect.required = isCredit;
    };

    paymentSelect.addEventListener("change", sync);
    sync();
  }

  function collectForm() {
    const form = body.querySelector("form");
    if (!form || !form.reportValidity()) return null;

    const data = new FormData(form);
    const type = state.type;
    const value = Number(data.get("value")) || 0;
    const notes = (data.get("notes") || "").toString().trim() || null;

    if (type === "transferencia") {
      const fromAccountId = data.get("fromAccountId") || "";
      const toAccountId = data.get("toAccountId") || "";
      if (!fromAccountId || !toAccountId) {
        showToast("Selecione as contas de origem e destino.");
        return null;
      }
      if (fromAccountId === toAccountId) {
        showToast("As contas de origem e destino devem ser diferentes.");
        return null;
      }
      return {
        type,
        payload: {
          tipo: "transferencia",
          description: "Transferência entre contas",
          value,
          date: data.get("date"),
          fromAccountId,
          toAccountId,
          notes,
        },
      };
    }

    const description = (data.get("description") || "").toString().trim();
    const category = data.get("category") || null;
    const accountId = data.get("accountId") || null;
    const date = data.get("date");

    if (type === "receita") {
      if (!accountId) {
        showToast("Selecione a conta que receberá esta receita.");
        return null;
      }
      return {
        type,
        payload: { tipo: "receita", description, value, date, accountId, category, notes },
      };
    }

    if (type === "despesa") {
      const payment = data.get("payment") || "pix";
      if (payment === "cartao_credito") {
        const cardId = data.get("cardId") || null;
        if (!cardId) {
          showToast("Cadastre e selecione um cartão para despesas no crédito.");
          return null;
        }
        return {
          type,
          payload: {
            tipo: "despesa",
            description,
            value,
            date,
            category,
            payment,
            cardId,
            installments: Math.max(1, Number(data.get("installments")) || 1),
            notes,
          },
        };
      }
      if (!accountId) {
        showToast("Selecione a conta que pagará esta despesa.");
        return null;
      }
      return {
        type,
        payload: {
          tipo: "despesa",
          description,
          value,
          date,
          accountId,
          category,
          payment,
          notes,
        },
      };
    }

    if (type === "conta") {
      if (!accountId) {
        showToast("Selecione a conta vinculada a esta conta mensal.");
        return null;
      }
      return {
        type,
        payload: {
          tipo: "conta",
          description,
          value,
          date,
          dueDate: date,
          accountId,
          category,
          payment: data.get("payment") || "boleto",
          recurring: data.get("recurring") === "sim",
          notes,
        },
      };
    }

    if (type === "cartao") {
      return {
        type,
        payload: {
          tipo: "cartao",
          description,
          value,
          date,
          cardId: data.get("cardId") || null,
          category,
          installments: Math.max(1, Number(data.get("installments")) || 1),
          notes,
        },
      };
    }

    return null;
  }

  function accountName(id) {
    const account = (getAccounts() || []).find(
      (item) => String(item.id) === String(id),
    );
    return account ? account.name : "-";
  }

  function cardName(id) {
    const card = (getCards() || []).find((item) => String(item.id) === String(id));
    return card ? card.name : "-";
  }

  function summaryRows(type, payload) {
    const rows = [];
    const push = (label, value) => rows.push({ label, value });

    const isCardExpense = type === "despesa" && payload.cardId;

    if (type === "transferencia") {
      push("Tipo", "🔄 Transferência");
      push("De", accountName(payload.fromAccountId));
      push("Para", accountName(payload.toAccountId));
      push("Valor", currency.format(payload.value));
      push("Data", formatDateBr(payload.date));
    } else if (type === "cartao" || isCardExpense) {
      const installments = payload.installments || 1;
      push("Tipo", isCardExpense ? "💸 Despesa no cartão" : "💳 Compra no Cartão");
      push("Descrição", payload.description);
      push("Cartão", cardName(payload.cardId));
      push("Valor total", currency.format(payload.value));
      push(
        "Parcelas",
        installments > 1
          ? `${installments}x de ${currency.format(payload.value / installments)}`
          : "À vista",
      );
      push("Categoria", payload.category || "-");
      push("Data", formatDateBr(payload.date));
    } else {
      push("Tipo", `${TYPE_MAP[type].icon} ${TYPE_MAP[type].title}`);
      push("Descrição", payload.description);
      push("Valor", currency.format(payload.value));
      push(type === "conta" ? "Vencimento" : "Data", formatDateBr(payload.date));
      push("Categoria", payload.category || "-");
      if (payload.accountId) push("Conta", accountName(payload.accountId));
      if (payload.payment) push("Pagamento", paymentLabelFromCode(payload.payment));
      if (type === "conta") push("Recorrente", payload.recurring ? "Sim" : "Não");
    }

    if (payload.notes) push("Observação", payload.notes);
    return rows;
  }

  function renderReviewStep(collected) {
    state.step = "review";
    const rows = summaryRows(collected.type, collected.payload)
      .map(
        (row) => `
        <div class="movement-summary-row">
          <span>${escapeHtml(row.label)}</span>
          <strong>${escapeHtml(row.value)}</strong>
        </div>`,
      )
      .join("");

    body.innerHTML = `
      <div class="movement-step">
        <div class="movement-summary">${rows}</div>
        <div class="new-expense-actions">
          <button type="button" class="expense-secondary-btn" data-back-form>
            <i class="fa-solid fa-arrow-left"></i> Voltar
          </button>
          <button type="button" class="expense-primary-btn" data-confirm>
            <i class="fa-solid fa-check"></i> ${state.editId ? "Salvar alterações" : "Confirmar e salvar"}
          </button>
        </div>
      </div>`;
    animate();
    state.pending = collected;
  }

  function buildUpdatePayload(collected) {
    const { type, payload } = collected;
    const update = {
      description: payload.description,
      value: payload.value,
      date: payload.date,
      notes: payload.notes,
      accountId: payload.accountId || null,
      category: payload.category || null,
    };
    if (type === "conta") {
      update.dueDate = payload.date;
    }
    if (payload.payment) update.payment = payload.payment;
    return update;
  }

  async function confirmSave() {
    if (state.saving || !state.pending) return;
    state.saving = true;
    const confirmBtn = body.querySelector("[data-confirm]");
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Salvando...`;
    }

    try {
      if (state.editId) {
        await movementsService.update(
          state.editId,
          buildUpdatePayload(state.pending),
        );
      } else {
        await movementsService.create(state.pending.payload);
      }
      close();
      if (typeof onSaved === "function") {
        await onSaved(
          state.editId
            ? "Movimentação atualizada com sucesso."
            : "Movimentação registrada com sucesso.",
        );
      }
    } catch (error) {
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = `<i class="fa-solid fa-check"></i> ${state.editId ? "Salvar alterações" : "Confirmar e salvar"}`;
      }
      showToast(error?.message || "Não foi possível salvar a movimentação.");
    } finally {
      state.saving = false;
    }
  }

  function openModal() {
    modal.classList.remove("isHidden");
    modal.setAttribute("aria-hidden", "false");
  }

  function close() {
    modal.classList.add("isHidden");
    modal.setAttribute("aria-hidden", "true");
    state.type = null;
    state.editId = null;
    state.pending = null;
    state.saving = false;
    body.innerHTML = "";
  }

  function open() {
    state.editId = null;
    renderTypeStep();
    openModal();
  }

  function openType(type) {
    if (!TYPE_MAP[type]) return open();
    state.editId = null;
    renderFormStep(type);
    openModal();
  }

  function openEdit(record, kind) {
    if (!record) return open();
    const accounts = getAccounts() || [];
    const findAccount = (name) =>
      accounts.find(
        (item) =>
          String(item.name).toLowerCase() === String(name || "").toLowerCase(),
      );

    if (kind === "conta") {
      state.editId = record.id;
      renderFormStep("conta", {
        description: record.name || record.description,
        value: record.value,
        date: record.dueDate || record.date,
        category: record.category,
        accountId: record.accountId || findAccount(record.account)?.id || "",
        paymentCode: record.paymentCode || record.payment,
        recurring: Boolean(record.recurring),
        notes: record.notes,
      });
      openModal();
      return;
    }

    const isIncome = String(record.type || "").toLowerCase().includes("receita");
    const type = isIncome ? "receita" : "despesa";
    state.editId = record.id;
    renderFormStep(type, {
      description: record.description,
      value: record.value,
      date: record.date,
      category: record.category,
      accountId: record.accountId || findAccount(record.account)?.id || "",
      paymentCode: record.paymentCode || record.payment,
      notes: record.notes,
    });
    openModal();
  }

  body.addEventListener("click", (event) => {
    if (event.target.closest("[data-type]")) {
      const type = event.target.closest("[data-type]").dataset.type;
      renderFormStep(type);
      return;
    }
    if (event.target.closest("[data-back]")) {
      renderTypeStep();
      return;
    }
    if (event.target.closest("[data-back-form]")) {
      renderFormStep(state.type, restoreForm());
      return;
    }
    if (event.target.closest("[data-confirm]")) {
      confirmSave();
    }
  });

  // Ao voltar do resumo, repopula o formulario com o que foi digitado.
  function restoreForm() {
    const payload = state.pending?.payload;
    if (!payload) return null;
    return {
      description: payload.description,
      value: payload.value,
      date: payload.date || payload.dueDate,
      category: payload.category,
      accountId: payload.accountId,
      paymentCode: payload.payment,
      recurring: payload.recurring,
      installments: payload.installments,
      cardId: payload.cardId,
      fromAccountId: payload.fromAccountId,
      toAccountId: payload.toAccountId,
      notes: payload.notes,
    };
  }

  body.addEventListener("submit", (event) => {
    if (!event.target.matches("form")) return;
    event.preventDefault();
    const collected = collectForm();
    if (collected) renderReviewStep(collected);
  });

  closeBtn?.addEventListener("click", close);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });

  return { open, openType, openEdit, close };
}
