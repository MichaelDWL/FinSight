import { hideModal, showModal } from "../../ui/modalFocus.js";
import { initCustomSelects } from "../../ui/customSelect.js";
import { mountChart, destroyAllCharts } from "../../charts/ChartWrapper.js";
import { chartService, formatBRL } from "../../services/chartService.js";
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
  emptyAccount,
  emptyCard,
  emptyBill,
  createInitialState,
} from "./constants.js";
import {
  loadPersistedState,
  persistState,
  markOnboardingDone,
  isOnboardingPending,
  setAllocationPercent,
  allocationSum,
  moneyFromPercent,
} from "./state.js";
import { applyOnboardingSetup } from "./applySetup.js";

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

function formatMoney(value) {
  return currency.format(Number(value) || 0);
}

function progressPercent(stepIndex) {
  return Math.round(((stepIndex + 1) / STEP_IDS.length) * 100);
}

function stepsLeft(stepIndex) {
  return Math.max(STEP_IDS.length - stepIndex - 1, 0);
}

export function createOnboardingWizard({
  onComplete,
  onSkip,
  showToast,
  getAccounts = () => [],
} = {}) {
  const modal = document.querySelector("#onboardingModal");
  const body = document.querySelector("#onboardingBody");
  const progressFill = document.querySelector("#onboardingProgressFill");
  const progressLabel = document.querySelector("#onboardingProgressLabel");
  const closeBtn = document.querySelector("#closeOnboardingModal");

  if (!modal || !body) {
    return {
      open() {},
      close() {},
      maybeOpen() {},
      isPending: () => false,
    };
  }

  let state = createInitialState();
  let summaryCache = null;

  function save() {
    persistState(state);
  }

  function syncProgress() {
    const pct = progressPercent(state.stepIndex);
    const left = stepsLeft(state.stepIndex);
    if (progressFill) progressFill.style.width = `${pct}%`;
    if (progressLabel) {
      progressLabel.textContent =
        left === 0
          ? "Última etapa"
          : left === 1
            ? "Falta 1 etapa"
            : `Faltam ${left} etapas`;
    }
    modal.setAttribute("aria-valuenow", String(pct));
  }

  function animateStep() {
    const step = body.querySelector(".onboarding-step");
    if (!step) return;
    step.classList.remove("onboarding-step-in");
    void step.offsetWidth;
    step.classList.add("onboarding-step-in");
  }

  function accountOptions(selectedId = "") {
    const draftAccounts = (state.accounts || [])
      .map((item, index) => ({
        id: `draft-${index}`,
        name: item.name || `Conta ${index + 1}`,
      }))
      .filter((item) => item.name);
    const live = getAccounts() || [];
    const list = [...live, ...draftAccounts];
    if (!list.length) {
      return `<option value="">Nenhuma conta ainda</option>`;
    }
    return list
      .map(
        (item) =>
          `<option value="${escapeHtml(item.id)}" ${
            String(item.id) === String(selectedId) ? "selected" : ""
          }>${escapeHtml(item.name)}</option>`,
      )
      .join("");
  }

  function renderWelcome() {
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

  function renderIncome() {
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

  function renderAccounts() {
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

  function renderCards() {
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

  function renderBills() {
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

  function renderProfile() {
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

  function renderRing(sum) {
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

  function renderSliders() {
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

  function renderCustomize() {
    return `
      <div class="onboarding-step">
        <p class="onboarding-question">Personalize seu planejamento.</p>
        <p class="onboarding-soft-note">A soma deve permanecer em 100%. Ao alterar um valor, os demais se ajustam automaticamente.</p>
        ${renderSliders()}
      </div>
    `;
  }

  function renderSimulationCards() {
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

  function renderSimulation() {
    const income = Number(state.monthlyIncome) || 0;
    return `
      <div class="onboarding-step">
        <p class="onboarding-question">Sua simulação mensal</p>
        <p class="onboarding-soft-note">
          Com base em ${formatMoney(income)}. Ajuste os percentuais e veja tudo atualizar em tempo real.
        </p>
        ${renderSliders()}
        <div class="onboarding-sim-grid">${renderSimulationCards()}</div>
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

  function renderNotifications() {
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

  function renderFinish() {
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

  function renderFooter() {
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

  function buildOnboardingDonut(items) {
    const labels = items.map((item) => item.category);
    const series = items.map((item) => item.value);
    const colors = items.map((item) => item.color);

    return {
      chart: {
        type: "donut",
        height: 280,
        fontFamily: "Inter, sans-serif",
        toolbar: { show: false },
        animations: { enabled: true, speed: 350 },
      },
      colors,
      labels,
      series,
      legend: {
        position: "bottom",
        fontSize: "12px",
        fontWeight: 500,
        markers: { width: 8, height: 8, radius: 8 },
        itemMargin: { horizontal: 8, vertical: 4 },
      },
      dataLabels: { enabled: false },
      stroke: { width: 2, colors: ["#fff"] },
      plotOptions: {
        pie: {
          expandOnClick: false,
          donut: {
            size: "72%",
            labels: {
              show: true,
              name: {
                show: true,
                fontSize: "12px",
                fontWeight: 600,
                color: "#4a5568",
                offsetY: -4,
              },
              value: {
                show: true,
                fontSize: "14px",
                fontWeight: 700,
                color: "#0f2d4f",
                offsetY: 4,
                formatter: (value) => formatBRL(value),
              },
              total: {
                show: true,
                showAlways: true,
                label: "Total",
                fontSize: "12px",
                fontWeight: 600,
                color: "#4a5568",
                formatter: (w) => {
                  const total = w.globals.seriesTotals.reduce((sum, v) => sum + v, 0);
                  return formatBRL(total);
                },
              },
            },
          },
        },
      },
      tooltip: {
        y: {
          formatter: (value) => formatBRL(value),
        },
      },
      responsive: [
        {
          breakpoint: 640,
          options: {
            chart: { height: 260 },
            legend: { position: "bottom" },
          },
        },
      ],
    };
  }

  function buildOnboardingBars(items) {
    return {
      ...chartService.barChart({
        categories: items.map((item) => item.category),
        series: [{ name: "Valor", data: items.map((item) => item.value) }],
        colors: items.map((item) => item.color),
        height: 280,
      }),
      legend: { show: false },
      chart: {
        type: "bar",
        height: 280,
        fontFamily: "Inter, sans-serif",
        toolbar: { show: false },
        animations: { enabled: true, speed: 350 },
      },
      plotOptions: {
        bar: {
          borderRadius: 8,
          columnWidth: "52%",
          distributed: true,
        },
      },
      dataLabels: { enabled: false },
      xaxis: {
        categories: items.map((item) => item.category),
        labels: {
          rotate: -25,
          style: { fontSize: "11px" },
        },
      },
      yaxis: {
        labels: {
          formatter: (value) => formatBRL(value),
        },
      },
    };
  }

  function mountSimulationCharts() {
    const income = Number(state.monthlyIncome) || 0;
    const items = ALLOCATION_KEYS.map((item) => ({
      category: item.label,
      value: moneyFromPercent(income, state.allocation[item.key]),
      color: item.color,
    })).filter((item) => item.value > 0);

    const donutEl = body.querySelector("#onboardingDonutChart");
    const barEl = body.querySelector("#onboardingBarChart");

    if (!items.length) {
      if (donutEl) {
        donutEl.innerHTML =
          '<p class="onboarding-soft-note">Informe sua renda para ver a distribuição.</p>';
      }
      if (barEl) {
        barEl.innerHTML =
          '<p class="onboarding-soft-note">Sem valores para exibir ainda.</p>';
      }
      return;
    }

    if (donutEl) {
      const chart = mountChart(donutEl, buildOnboardingDonut(items));
      requestAnimationFrame(() => chart?.windowResizeHandler?.());
    }
    if (barEl) {
      const chart = mountChart(barEl, buildOnboardingBars(items));
      requestAnimationFrame(() => chart?.windowResizeHandler?.());
    }
  }

  function updateLiveAllocationUi() {
    const sum = allocationSum(state.allocation);
    const ring = body.querySelector(".onboarding-ring");
    if (ring) {
      ring.outerHTML = renderRing(sum);
    }

    for (const item of ALLOCATION_KEYS) {
      const value = Number(state.allocation[item.key]) || 0;
      const label = body.querySelector(`[data-ob-slider-value="${item.key}"]`);
      const slider = body.querySelector(`[data-ob-slider="${item.key}"]`);
      if (label) label.textContent = `${value}%`;
      if (slider && Number(slider.value) !== value) {
        slider.value = String(value);
        slider.setAttribute("aria-valuenow", String(value));
      }
    }

    const simGrid = body.querySelector(".onboarding-sim-grid");
    if (simGrid) {
      simGrid.innerHTML = renderSimulationCards();
      mountSimulationCharts();
    }
  }

  function render() {
    destroyAllCharts(body);
    const stepId = STEP_IDS[state.stepIndex];
    const renderers = {
      welcome: renderWelcome,
      income: renderIncome,
      accounts: renderAccounts,
      cards: renderCards,
      bills: renderBills,
      profile: renderProfile,
      customize: renderCustomize,
      simulation: renderSimulation,
      notifications: renderNotifications,
      finish: renderFinish,
    };

    body.innerHTML = `${(renderers[stepId] || renderWelcome)()}${renderFooter()}`;
    syncProgress();
    animateStep();
    save();
    initCustomSelects(body);

    if (stepId === "simulation") {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => mountSimulationCharts());
      });
    }
  }

  function goTo(index) {
    state.stepIndex = Math.max(0, Math.min(STEP_IDS.length - 1, index));
    render();
  }

  function next() {
    goTo(state.stepIndex + 1);
  }

  function back() {
    goTo(state.stepIndex - 1);
  }

  async function finish() {
    if (state.applying) return;
    state.applying = true;
    render();

    try {
      summaryCache = await applyOnboardingSetup(state);
      markOnboardingDone({ skipped: false });
      state.completed = true;
      hideModal(modal);
      if (typeof onComplete === "function") {
        await onComplete(summaryCache);
      }
      showToast?.("Seu FinSight foi personalizado com sucesso.");
    } catch (error) {
      console.error(error);
      showToast?.(error.message || "Não foi possível concluir a configuração.");
      state.applying = false;
      render();
    }
  }

  function skipAll() {
    markOnboardingDone({ skipped: true });
    state.skipped = true;
    hideModal(modal);
    onSkip?.();
    showToast?.("Você pode configurar depois nas preferências.");
  }

  function bindEvents() {
    closeBtn?.addEventListener("click", () => {
      save();
      hideModal(modal);
      showToast?.("Progresso salvo. Você pode continuar depois.");
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (modal.classList.contains("isHidden")) return;
      save();
      hideModal(modal);
      showToast?.("Progresso salvo. Você pode continuar depois.");
    });

    body.addEventListener("click", (event) => {
      const target = event.target.closest("[data-ob-action], [data-ob-income], [data-ob-want-accounts], [data-ob-want-cards], [data-ob-want-bills], [data-ob-profile], [data-ob-bill-toggle], [data-ob-remove-account], [data-ob-remove-card], [data-ob-remove-bill]");
      if (!target) return;

      if (target.dataset.obAction === "start") {
        next();
        return;
      }
      if (target.dataset.obAction === "skip-all") {
        skipAll();
        return;
      }
      if (target.dataset.obAction === "back") {
        back();
        return;
      }
      if (target.dataset.obAction === "next" || target.dataset.obAction === "skip-step") {
        next();
        return;
      }
      if (target.dataset.obAction === "finish") {
        finish();
        return;
      }
      if (target.dataset.obAction === "add-account") {
        state.accounts.push(emptyAccount());
        render();
        return;
      }
      if (target.dataset.obAction === "add-card") {
        state.cards.push(emptyCard());
        render();
        return;
      }

      if (target.dataset.obIncome) {
        state.incomeSource = target.dataset.obIncome;
        save();
        render();
        return;
      }

      if (target.dataset.obWantAccounts) {
        state.wantAccounts = target.dataset.obWantAccounts === "yes";
        if (state.wantAccounts && !state.accounts.length) {
          state.accounts = [emptyAccount()];
        }
        save();
        render();
        return;
      }

      if (target.dataset.obWantCards) {
        state.wantCards = target.dataset.obWantCards === "yes";
        if (state.wantCards && !state.cards.length) {
          state.cards = [emptyCard()];
        }
        save();
        render();
        return;
      }

      if (target.dataset.obWantBills) {
        state.wantBills = target.dataset.obWantBills === "yes";
        save();
        render();
        return;
      }

      if (target.dataset.obProfile) {
        const profile = PROFILES.find((item) => item.id === target.dataset.obProfile);
        if (profile) {
          state.profileId = profile.id;
          state.allocation = { ...profile.allocation };
          save();
          render();
        }
        return;
      }

      if (target.dataset.obBillToggle) {
        const suggestion = BILL_SUGGESTIONS.find(
          (item) => item.id === target.dataset.obBillToggle,
        );
        if (!suggestion) return;
        const exists = state.bills.findIndex(
          (item) => item.suggestionId === suggestion.id,
        );
        if (exists >= 0) {
          state.bills.splice(exists, 1);
        } else {
          state.bills.push({
            ...emptyBill(),
            suggestionId: suggestion.id,
            label: suggestion.label,
            category: suggestion.category,
          });
        }
        state.wantBills = true;
        save();
        render();
        return;
      }

      if (target.dataset.obRemoveAccount != null) {
        const index = Number(target.dataset.obRemoveAccount);
        state.accounts.splice(index, 1);
        if (!state.accounts.length) state.accounts = [emptyAccount()];
        render();
        return;
      }

      if (target.dataset.obRemoveCard != null) {
        const index = Number(target.dataset.obRemoveCard);
        state.cards.splice(index, 1);
        if (!state.cards.length) state.cards = [emptyCard()];
        render();
        return;
      }

      if (target.dataset.obRemoveBill != null) {
        const index = Number(target.dataset.obRemoveBill);
        state.bills.splice(index, 1);
        render();
      }
    });

    body.addEventListener("input", (event) => {
      syncFieldFromEvent(event.target);
    });

    // Custom select dispara "change" (não "input")
    body.addEventListener("change", (event) => {
      syncFieldFromEvent(event.target);
    });
  }

  function syncFieldFromEvent(target) {
    if (!target) return;

    if (target.dataset.obField === "monthlyIncome") {
      state.monthlyIncome = target.value;
      save();
      return;
    }

    if (target.dataset.obAccountField != null) {
      const index = Number(target.dataset.index);
      if (state.accounts[index]) {
        state.accounts[index][target.dataset.obAccountField] = target.value;
        save();
      }
      return;
    }

    if (target.dataset.obCardField != null) {
      const index = Number(target.dataset.index);
      if (state.cards[index]) {
        state.cards[index][target.dataset.obCardField] = target.value;
        save();
      }
      return;
    }

    if (target.dataset.obBillField != null) {
      const index = Number(target.dataset.index);
      if (state.bills[index]) {
        state.bills[index][target.dataset.obBillField] = target.value;
        save();
      }
      return;
    }

    if (target.dataset.obSlider) {
      state.allocation = setAllocationPercent(
        state.allocation,
        target.dataset.obSlider,
        target.value,
      );
      save();
      updateLiveAllocationUi();
      return;
    }

    if (target.dataset.obNotification) {
      const id = target.dataset.obNotification;
      if (target.checked) {
        if (!state.notifications.includes(id)) state.notifications.push(id);
      } else {
        state.notifications = state.notifications.filter((item) => item !== id);
      }
      save();
    }
  }

  function open({ force = false } = {}) {
    const saved = loadPersistedState();
    if (saved && !force) {
      state = { ...createInitialState(), ...saved, applying: false };
      if (state.completed || state.skipped) return;
    } else if (force) {
      state = createInitialState();
    }

    showModal(modal);
    render();
  }

  function maybeOpen() {
    if (!isOnboardingPending()) return false;
    open();
    return true;
  }

  function close() {
    save();
    hideModal(modal);
  }

  bindEvents();

  return {
    open,
    close,
    maybeOpen,
    isPending: isOnboardingPending,
  };
}
