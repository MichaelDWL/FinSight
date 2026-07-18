import { escapeHtml } from "../../utils/dom.js";
import {
  STEP_IDS,
  INCOME_SOURCES,
  ACCOUNT_TYPES,
  BILL_SUGGESTIONS,
  PAYMENT_METHODS,
  RECURRENCE_OPTIONS,
  ALLOCATION_KEYS,
  PROFILES,
  NOTIFICATION_OPTIONS,
} from "./constants.js";
import { allocationSum, moneyFromPercent } from "./state.js";
import { formatMoney } from "./helpers.js";

export function renderWelcome() {
  return `
      <div class="onboarding-step onboarding-welcome">
        <div class="onboarding-hero-icon" aria-hidden="true">
          <i class="fa-solid fa-chart-simple"></i>
        </div>
        <h2 class="onboarding-title">Bem-vindo ao FinSight.</h2>
        <p class="onboarding-lead">Vamos configurar seu espaço financeiro.</p>
        <p class="onboarding-hint">Isso leva menos de 3 minutos.</p>
        <div class="onboarding-actions onboarding-actions-center">
          <button type="button" class="expense-primary-btn" data-ob-action="start">
            Começar
          </button>
          <button type="button" class="expense-secondary-btn" data-ob-action="skip-all">
            Pular configuração
          </button>
        </div>
      </div>
    `;
}

export function renderIncome(state) {
  const chips = INCOME_SOURCES.map(
    (item) => `
        <button type="button"
          class="onboarding-chip ${state.incomeSource === item.id ? "is-selected" : ""}"
          data-ob-income="${item.id}"
          aria-pressed="${state.incomeSource === item.id}">
          <i class="fa-solid ${item.icon}" aria-hidden="true"></i>
          <span>${item.label}</span>
        </button>
      `,
  ).join("");

  return `
      <div class="onboarding-step">
        <p class="onboarding-question">Como você recebe dinheiro?</p>
        <div class="onboarding-chip-grid" role="group" aria-label="Fonte de renda">
          ${chips}
        </div>
        <label class="expense-field onboarding-field">
          <span class="font-label">Qual sua renda mensal aproximada?</span>
          <div class="expense-input-wrapper expense-value-field">
            <i class="fa-solid fa-brazilian-real-sign"></i>
            <input type="number" class="input-basic" min="0" step="0.01"
              data-ob-field="monthlyIncome"
              value="${escapeHtml(state.monthlyIncome)}"
              placeholder="0,00" inputmode="decimal">
          </div>
        </label>
        <p class="onboarding-soft-note">Você poderá alterar esse valor a qualquer momento.</p>
      </div>
    `;
}

export function renderAccounts(state) {
  const forms =
    state.wantAccounts === true
      ? state.accounts
          .map(
            (account, index) => `
          <div class="onboarding-subcard" data-ob-account-index="${index}">
            <div class="onboarding-subcard-head">
              <strong>Conta ${index + 1}</strong>
              ${
                state.accounts.length > 1
                  ? `<button type="button" class="onboarding-icon-btn" data-ob-remove-account="${index}" aria-label="Remover conta">
                      <i class="fa-solid fa-trash"></i>
                    </button>`
                  : ""
              }
            </div>
            <div class="onboarding-form-grid">
              <label class="expense-field">
                <span class="font-label">Nome da conta</span>
                <div class="expense-input-wrapper">
                  <i class="fa-solid fa-wallet"></i>
                  <input class="input-basic" data-ob-account-field="name" data-index="${index}"
                    value="${escapeHtml(account.name)}" placeholder="Ex.: Conta principal">
                </div>
              </label>
              <label class="expense-field">
                <span class="font-label">Banco</span>
                <div class="expense-input-wrapper">
                  <i class="fa-solid fa-building-columns"></i>
                  <input class="input-basic" data-ob-account-field="bank" data-index="${index}"
                    value="${escapeHtml(account.bank)}" placeholder="Ex.: Nubank">
                </div>
              </label>
              <label class="expense-field">
                <span class="font-label">Saldo inicial</span>
                <div class="expense-input-wrapper expense-value-field">
                  <i class="fa-solid fa-brazilian-real-sign"></i>
                  <input type="number" class="input-basic" min="0" step="0.01"
                    data-ob-account-field="balance" data-index="${index}"
                    value="${escapeHtml(account.balance)}" placeholder="0,00">
                </div>
              </label>
              <label class="expense-field">
                <span class="font-label">Tipo da conta</span>
                <div class="expense-input-wrapper">
                  <i class="fa-solid fa-layer-group"></i>
                  <select class="input-basic" data-ob-account-field="type" data-index="${index}">
                    ${ACCOUNT_TYPES.map(
                      (type) =>
                        `<option value="${type.value}" ${
                          account.type === type.value ? "selected" : ""
                        }>${type.label}</option>`,
                    ).join("")}
                  </select>
                </div>
              </label>
            </div>
          </div>
        `,
          )
          .join("")
      : "";

  return `
      <div class="onboarding-step">
        <p class="onboarding-question">Deseja cadastrar uma conta bancária?</p>
        <div class="onboarding-choice-row" role="group" aria-label="Cadastrar conta">
          <button type="button" class="onboarding-choice ${state.wantAccounts === true ? "is-selected" : ""}" data-ob-want-accounts="yes">Sim</button>
          <button type="button" class="onboarding-choice ${state.wantAccounts === false ? "is-selected" : ""}" data-ob-want-accounts="no">Agora não</button>
        </div>
        ${
          state.wantAccounts === true
            ? `
          <div class="onboarding-stack">${forms}</div>
          <button type="button" class="expense-secondary-btn onboarding-add-btn" data-ob-action="add-account">
            <i class="fa-solid fa-plus"></i> Adicionar outra conta
          </button>
        `
            : ""
        }
      </div>
    `;
}

export function renderCards(state, accountOptions) {
  const forms =
    state.wantCards === true
      ? state.cards
          .map(
            (card, index) => `
          <div class="onboarding-subcard" data-ob-card-index="${index}">
            <div class="onboarding-subcard-head">
              <strong>Cartão ${index + 1}</strong>
              ${
                state.cards.length > 1
                  ? `<button type="button" class="onboarding-icon-btn" data-ob-remove-card="${index}" aria-label="Remover cartão">
                      <i class="fa-solid fa-trash"></i>
                    </button>`
                  : ""
              }
            </div>
            <div class="onboarding-form-grid">
              <label class="expense-field">
                <span class="font-label">Nome</span>
                <div class="expense-input-wrapper">
                  <i class="fa-solid fa-credit-card"></i>
                  <input class="input-basic" data-ob-card-field="name" data-index="${index}"
                    value="${escapeHtml(card.name)}" placeholder="Ex.: Cartão principal">
                </div>
              </label>
              <label class="expense-field">
                <span class="font-label">Últimos 3 números</span>
                <div class="expense-input-wrapper">
                  <i class="fa-solid fa-hashtag"></i>
                  <input class="input-basic" maxlength="3" inputmode="numeric"
                    data-ob-card-field="lastDigits" data-index="${index}"
                    value="${escapeHtml(card.lastDigits)}" placeholder="000">
                </div>
              </label>
              <label class="expense-field">
                <span class="font-label">Limite</span>
                <div class="expense-input-wrapper expense-value-field">
                  <i class="fa-solid fa-brazilian-real-sign"></i>
                  <input type="number" class="input-basic" min="0" step="0.01"
                    data-ob-card-field="limit" data-index="${index}"
                    value="${escapeHtml(card.limit)}" placeholder="0,00">
                </div>
              </label>
              <label class="expense-field">
                <span class="font-label">Dia do fechamento</span>
                <div class="expense-input-wrapper">
                  <i class="fa-regular fa-calendar"></i>
                  <input type="number" class="input-basic" min="1" max="31"
                    data-ob-card-field="closingDay" data-index="${index}"
                    value="${escapeHtml(card.closingDay)}">
                </div>
              </label>
              <label class="expense-field">
                <span class="font-label">Dia do vencimento</span>
                <div class="expense-input-wrapper">
                  <i class="fa-regular fa-calendar-check"></i>
                  <input type="number" class="input-basic" min="1" max="31"
                    data-ob-card-field="dueDay" data-index="${index}"
                    value="${escapeHtml(card.dueDay)}">
                </div>
              </label>
              <label class="expense-field">
                <span class="font-label">Conta vinculada</span>
                <div class="expense-input-wrapper">
                  <i class="fa-solid fa-link"></i>
                  <select class="input-basic" data-ob-card-field="accountId" data-index="${index}">
                    <option value="">Opcional</option>
                    ${accountOptions(card.accountId)}
                  </select>
                </div>
              </label>
            </div>
          </div>
        `,
          )
          .join("")
      : "";

  return `
      <div class="onboarding-step">
        <p class="onboarding-question">Você possui cartão de crédito?</p>
        <div class="onboarding-choice-row" role="group" aria-label="Possui cartão">
          <button type="button" class="onboarding-choice ${state.wantCards === true ? "is-selected" : ""}" data-ob-want-cards="yes">Sim</button>
          <button type="button" class="onboarding-choice ${state.wantCards === false ? "is-selected" : ""}" data-ob-want-cards="no">Não</button>
        </div>
        ${
          state.wantCards === true
            ? `
          <div class="onboarding-stack">${forms}</div>
          <button type="button" class="expense-secondary-btn onboarding-add-btn" data-ob-action="add-card">
            <i class="fa-solid fa-plus"></i> Adicionar outro cartão
          </button>
        `
            : ""
        }
      </div>
    `;
}

export function renderBills(state, accountOptions) {
  const selectedIds = new Set((state.bills || []).map((item) => item.suggestionId));
  const suggestions = BILL_SUGGESTIONS.map(
    (item) => `
        <button type="button"
          class="onboarding-chip ${selectedIds.has(item.id) ? "is-selected" : ""}"
          data-ob-bill-toggle="${item.id}">
          <i class="fa-solid ${item.icon}" aria-hidden="true"></i>
          <span>${item.label}</span>
        </button>
      `,
  ).join("");

  const forms = (state.bills || [])
    .map(
      (bill, index) => `
        <div class="onboarding-subcard">
          <div class="onboarding-subcard-head">
            <strong>${escapeHtml(bill.label || "Conta")}</strong>
            <button type="button" class="onboarding-icon-btn" data-ob-remove-bill="${index}" aria-label="Remover">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div class="onboarding-form-grid">
            <label class="expense-field">
              <span class="font-label">Valor</span>
              <div class="expense-input-wrapper expense-value-field">
                <i class="fa-solid fa-brazilian-real-sign"></i>
                <input type="number" class="input-basic" min="0" step="0.01"
                  data-ob-bill-field="value" data-index="${index}"
                  value="${escapeHtml(bill.value)}" placeholder="0,00">
              </div>
            </label>
            <label class="expense-field">
              <span class="font-label">Dia do vencimento</span>
              <div class="expense-input-wrapper">
                <i class="fa-regular fa-calendar"></i>
                <input type="number" class="input-basic" min="1" max="31"
                  data-ob-bill-field="dueDay" data-index="${index}"
                  value="${escapeHtml(bill.dueDay)}">
              </div>
            </label>
            <label class="expense-field">
              <span class="font-label">Forma de pagamento</span>
              <div class="expense-input-wrapper">
                <i class="fa-solid fa-money-check"></i>
                <select class="input-basic" data-ob-bill-field="payment" data-index="${index}">
                  ${PAYMENT_METHODS.map(
                    (method) =>
                      `<option value="${method.value}" ${
                        bill.payment === method.value ? "selected" : ""
                      }>${method.label}</option>`,
                  ).join("")}
                </select>
              </div>
            </label>
            <label class="expense-field">
              <span class="font-label">Conta bancária</span>
              <div class="expense-input-wrapper">
                <i class="fa-solid fa-building-columns"></i>
                <select class="input-basic" data-ob-bill-field="accountId" data-index="${index}">
                  <option value="">Selecionar</option>
                  ${accountOptions(bill.accountId)}
                </select>
              </div>
            </label>
            <label class="expense-field">
              <span class="font-label">Recorrência</span>
              <div class="expense-input-wrapper">
                <i class="fa-solid fa-rotate"></i>
                <select class="input-basic" data-ob-bill-field="recurrence" data-index="${index}">
                  ${RECURRENCE_OPTIONS.map(
                    (option) =>
                      `<option value="${option.value}" ${
                        bill.recurrence === option.value ? "selected" : ""
                      }>${option.label}</option>`,
                  ).join("")}
                </select>
              </div>
            </label>
          </div>
        </div>
      `,
    )
    .join("");

  return `
      <div class="onboarding-step">
        <p class="onboarding-question">Deseja cadastrar contas recorrentes?</p>
        <div class="onboarding-choice-row" role="group" aria-label="Contas recorrentes">
          <button type="button" class="onboarding-choice ${state.wantBills === true ? "is-selected" : ""}" data-ob-want-bills="yes">Sim</button>
          <button type="button" class="onboarding-choice ${state.wantBills === false ? "is-selected" : ""}" data-ob-want-bills="no">Pular</button>
        </div>
        ${
          state.wantBills === true
            ? `
          <p class="onboarding-soft-note">Toque nas sugestões rápidas:</p>
          <div class="onboarding-chip-grid">${suggestions}</div>
          <div class="onboarding-stack">${forms || '<p class="onboarding-soft-note">Selecione ao menos uma sugestão.</p>'}</div>
        `
            : ""
        }
      </div>
    `;
}

export function renderProfile(state) {
  const cards = PROFILES.map((profile) => {
    const selected = state.profileId === profile.id;
    const bars = ALLOCATION_KEYS.map((item) => {
      const pct = profile.allocation[item.key] || 0;
      return `
          <div class="onboarding-profile-bar">
            <span>${item.label}</span>
            <strong>${pct}%</strong>
            <div class="onboarding-profile-track" aria-hidden="true">
              <span style="width:${pct}%; background:${item.color}"></span>
            </div>
          </div>
        `;
    }).join("");

    return `
        <button type="button"
          class="onboarding-profile-card ${selected ? "is-selected" : ""}"
          data-ob-profile="${profile.id}"
          aria-pressed="${selected}">
          <span class="onboarding-profile-emoji" aria-hidden="true">${profile.emoji}</span>
          <strong>${profile.title}</strong>
          <span class="onboarding-profile-desc">${profile.description}</span>
          <div class="onboarding-profile-bars">${bars}</div>
        </button>
      `;
  }).join("");

  return `
      <div class="onboarding-step">
        <p class="onboarding-question">Qual é seu principal objetivo financeiro?</p>
        <div class="onboarding-profile-grid">${cards}</div>
      </div>
    `;
}

export function renderRing(sum) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, sum));
  const offset = circumference - (clamped / 100) * circumference;
  const ok = clamped === 100;
  return `
      <div class="onboarding-ring ${ok ? "is-complete" : ""}" role="img" aria-label="Soma ${clamped}%">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle class="onboarding-ring-track" cx="50" cy="50" r="${radius}"></circle>
          <circle class="onboarding-ring-value" cx="50" cy="50" r="${radius}"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${offset}"></circle>
        </svg>
        <div class="onboarding-ring-label">
          <strong>${clamped}%</strong>
          <span>${ok ? "Completo" : "Ajuste"}</span>
        </div>
      </div>
    `;
}

export function renderSliders(state) {
  const sum = allocationSum(state.allocation);
  const rows = ALLOCATION_KEYS.map((item) => {
    const value = Number(state.allocation[item.key]) || 0;
    return `
        <label class="onboarding-slider-row">
          <div class="onboarding-slider-head">
            <span style="--dot:${item.color}">${item.label}</span>
            <strong data-ob-slider-value="${item.key}">${value}%</strong>
          </div>
          <input type="range" min="0" max="100" step="1"
            class="onboarding-slider"
            data-ob-slider="${item.key}"
            value="${value}"
            aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}"
            aria-label="${item.label}">
        </label>
      `;
  }).join("");

  return `
      <div class="onboarding-customize-layout">
        ${renderRing(sum)}
        <div class="onboarding-sliders">${rows}</div>
      </div>
    `;
}

export function renderCustomize(state) {
  return `
      <div class="onboarding-step">
        <p class="onboarding-question">Personalize seu planejamento.</p>
        <p class="onboarding-soft-note">A soma deve permanecer em 100%. Ao alterar um valor, os demais se ajustam automaticamente.</p>
        ${renderSliders(state)}
      </div>
    `;
}

export function renderSimulationCards(state) {
  const income = Number(state.monthlyIncome) || 0;
  return ALLOCATION_KEYS.map((item) => {
    const amount = moneyFromPercent(income, state.allocation[item.key]);
    const pct = Number(state.allocation[item.key]) || 0;
    return `
        <article class="onboarding-sim-card">
          <span class="onboarding-sim-dot" style="background:${item.color}"></span>
          <div>
            <strong>${item.label}</strong>
            <p>${pct}% · ${formatMoney(amount)}</p>
          </div>
        </article>
      `;
  }).join("");
}

export function renderSimulation(state) {
  const income = Number(state.monthlyIncome) || 0;
  return `
      <div class="onboarding-step">
        <p class="onboarding-question">Sua simulação mensal</p>
        <p class="onboarding-soft-note">
          Com base em ${formatMoney(income)}. Ajuste os percentuais e veja tudo atualizar em tempo real.
        </p>
        ${renderSliders(state)}
        <div class="onboarding-sim-grid">${renderSimulationCards(state)}</div>
        <div class="onboarding-charts">
          <div class="onboarding-chart-card">
            <h3 class="font-label">Distribuição</h3>
            <div id="onboardingDonutChart" data-chart="onboarding-donut"></div>
          </div>
          <div class="onboarding-chart-card">
            <h3 class="font-label">Valores</h3>
            <div id="onboardingBarChart" data-chart="onboarding-bar"></div>
          </div>
        </div>
      </div>
    `;
}

export function renderNotifications(state) {
  const items = NOTIFICATION_OPTIONS.map((item) => {
    const checked = state.notifications.includes(item.id);
    return `
        <label class="onboarding-check">
          <input type="checkbox" data-ob-notification="${item.id}" ${checked ? "checked" : ""}>
          <span>${item.label}</span>
        </label>
      `;
  }).join("");

  return `
      <div class="onboarding-step">
        <p class="onboarding-question">Quais notificações deseja receber?</p>
        <div class="onboarding-check-grid">${items}</div>
      </div>
    `;
}

export function renderFinish(state) {
  const profile = PROFILES.find((item) => item.id === state.profileId) || PROFILES[0];
  const accountsCount =
    state.wantAccounts === true
      ? state.accounts.filter((item) => String(item.name || "").trim()).length
      : 0;
  const cardsCount =
    state.wantCards === true
      ? state.cards.filter((item) => String(item.name || "").trim()).length
      : 0;
  const goalsEstimate = ALLOCATION_KEYS.filter(
    (item) => moneyFromPercent(state.monthlyIncome, state.allocation[item.key]) > 0,
  ).length;

  return `
      <div class="onboarding-step onboarding-finish">
        <div class="onboarding-hero-icon is-success" aria-hidden="true">
          <i class="fa-solid fa-check"></i>
        </div>
        <h2 class="onboarding-title">Seu FinSight está pronto.</h2>
        <p class="onboarding-lead">Montamos um espaço sob medida para você.</p>
        <ul class="onboarding-summary-list">
          <li><i class="fa-solid fa-building-columns"></i> ${accountsCount} conta(s) cadastrada(s)</li>
          <li><i class="fa-solid fa-credit-card"></i> ${cardsCount} cartão(ões) cadastrado(s)</li>
          <li><i class="fa-solid fa-user"></i> Perfil ${escapeHtml(profile.title)}</li>
          <li><i class="fa-solid fa-bullseye"></i> Metas e limites personalizados</li>
          <li><i class="fa-solid fa-tags"></i> Categorias iniciais criadas</li>
          <li><i class="fa-solid fa-chart-pie"></i> Dashboards personalizados</li>
          <li><i class="fa-solid fa-bell"></i> ${state.notifications.length} alertas inteligentes</li>
        </ul>
        <p class="onboarding-soft-note">Estimativa de metas mensais: ${goalsEstimate} categorias com orçamento.</p>
        <div class="onboarding-actions onboarding-actions-center">
          <button type="button" class="expense-primary-btn" data-ob-action="finish" ${
            state.applying ? "disabled" : ""
          }>
            ${state.applying ? "Configurando..." : "Ir para o FinSight"}
          </button>
        </div>
      </div>
    `;
}

export function renderFooter(state) {
  const stepId = STEP_IDS[state.stepIndex];
  if (stepId === "welcome" || stepId === "finish") return "";

  return `
      <div class="onboarding-footer">
        <button type="button" class="expense-secondary-btn" data-ob-action="back">
          Voltar
        </button>
        <button type="button" class="onboarding-skip-btn" data-ob-action="skip-step">
          Pular etapa
        </button>
        <button type="button" class="expense-primary-btn" data-ob-action="next">
          Próximo
        </button>
      </div>
    `;
}
