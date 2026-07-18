import { escapeHtml } from "../../utils/dom.js";
import {
  ALLOCATION_KEYS,
  INCOME_SOURCES,
  NOTIFICATION_OPTIONS,
  PROFILES,
} from "../onboarding/constants.js";

export function render({
  user = {},
  personalization = null,
} = {}) {
  const userName = user.name || "Usuario FinSight";
  const userEmail = user.email || "sem-email@finsight.local";
  const initials = userName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const profile = personalization?.profile || {};
  const allocation = profile.allocation || {
    contas: 50,
    investimentos: 20,
    metas: 10,
    lazer: 10,
    desenvolvimento: 10,
  };
  const notifications = new Set(profile.notifications || []);
  const profileType = profile.type || "equilibrado";

  const profileOptions = [
    ...PROFILES.map(
      (item) =>
        `<option value="${item.id}" ${profileType === item.id ? "selected" : ""}>${item.emoji} ${item.title}</option>`,
    ),
    `<option value="custom" ${profileType === "custom" ? "selected" : ""}>Personalizado</option>`,
  ].join("");

  const incomeOptions = INCOME_SOURCES.map(
    (item) =>
      `<option value="${item.id}" ${profile.incomeSource === item.id ? "selected" : ""}>${item.label}</option>`,
  ).join("");

  const allocationFields = ALLOCATION_KEYS.map(
    (item) => `
      <label class="expense-field">
        <span class="font-label">${item.label} (%)</span>
        <div class="expense-input-wrapper">
          <i class="fa-solid fa-percent"></i>
          <input
            class="input-basic"
            type="number"
            min="0"
            max="100"
            step="1"
            name="alloc_${item.key}"
            data-alloc-key="${item.key}"
            value="${Number(allocation[item.key]) || 0}"
          >
        </div>
      </label>
    `,
  ).join("");

  const notificationChecks = NOTIFICATION_OPTIONS.map(
    (item) => `
      <label class="onboarding-check profile-notification-check">
        <input type="checkbox" name="notification" value="${item.id}" ${
          notifications.has(item.id) ? "checked" : ""
        }>
        <span>${item.label}</span>
      </label>
    `,
  ).join("");

  return `
    <section class="app-page">
      <div class="page-hero">
        <div>
          <span class="page-eyebrow">Perfil</span>
          <h1 class="page-title">Preferências e personalização</h1>
          <p class="page-subtitle">Ajuste renda, perfil financeiro, orçamento e notificações. O FinSight se adapta automaticamente.</p>
          <button type="button" class="btn-secondary" id="logoutBtn" style="margin-top:0.75rem">
            <i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i> Sair
          </button>
        </div>
      </div>

      <div class="profile-grid">
        <section class="form-card profile-main-card">
          <header class="profile-identity">
            <span class="profile-picture profile-picture--page">${initials}</span>
            <div class="profile-identity-copy">
              <h2>${escapeHtml(userName)}</h2>
              <p class="item-meta">${escapeHtml(userEmail)}</p>
            </div>
          </header>

          <form id="profilePersonalizationForm" class="new-expense-form profile-form" novalidate>
            <div class="form-grid">
              <label class="expense-field">
                <span class="font-label">Nome</span>
                <div class="expense-input-wrapper">
                  <i class="fa-solid fa-user"></i>
                  <input class="input-basic" id="profileName" name="name" type="text" value="${escapeHtml(userName)}">
                </div>
              </label>
              <label class="expense-field">
                <span class="font-label">Email</span>
                <div class="expense-input-wrapper">
                  <i class="fa-solid fa-envelope"></i>
                  <input class="input-basic" id="profileEmail" name="email" type="email" value="${escapeHtml(userEmail)}">
                </div>
              </label>
              <label class="expense-field">
                <span class="font-label">Perfil financeiro</span>
                <div class="expense-input-wrapper">
                  <i class="fa-solid fa-user-astronaut"></i>
                  <select class="input-basic" id="profileType" name="profileType">
                    ${profileOptions}
                  </select>
                </div>
              </label>
              <label class="expense-field">
                <span class="font-label">Fonte de renda</span>
                <div class="expense-input-wrapper">
                  <i class="fa-solid fa-briefcase"></i>
                  <select class="input-basic" id="incomeSource" name="incomeSource">
                    <option value="">Não informado</option>
                    ${incomeOptions}
                  </select>
                </div>
              </label>
              <label class="expense-field">
                <span class="font-label">Renda mensal</span>
                <div class="expense-input-wrapper expense-value-field">
                  <i class="fa-solid fa-brazilian-real-sign"></i>
                  <input class="input-basic" id="monthlyIncome" name="monthlyIncome" type="number" min="0" step="0.01" value="${Number(profile.monthlyIncome) || 0}">
                </div>
              </label>
            </div>

            <h3 class="font-title-sm" style="margin-top:1rem">Distribuição do orçamento</h3>
            <p class="item-meta">A soma deve permanecer em 100%. Ao salvar, metas e limites são recalculados.</p>
            <div class="form-grid" id="profileAllocationGrid">
              ${allocationFields}
            </div>
            <p class="item-meta" id="allocationSumHint">Soma: 100%</p>

            <div class="form-actions">
              <button class="btn-primary" type="submit">
                <i class="fa-solid fa-check"></i> Salvar personalização
              </button>
            </div>
          </form>
        </section>

        <section class="premium-card">
          <h2>Notificações inteligentes</h2>
          <p class="item-meta">Escolha o que o FinSight deve monitorar para você.</p>
          <div class="onboarding-check-grid profile-notifications">
            ${notificationChecks}
          </div>
          <div class="settings-list" style="margin-top:1rem">
            <button class="setting-row" type="button" data-action="change-password">
              <div>
                <strong class="item-title">Alterar senha</strong>
                <p class="item-meta">Atualize sua senha de acesso.</p>
              </div>
              <i class="fa-solid fa-chevron-right"></i>
            </button>
            <button class="setting-row" type="button" data-action="export-data">
              <div>
                <strong class="item-title">Exportar meus dados</strong>
                <p class="item-meta">Download JSON (portabilidade LGPD).</p>
              </div>
              <i class="fa-solid fa-download"></i>
            </button>
            <button class="setting-row" type="button" data-action="delete-account">
              <div>
                <strong class="item-title text-expense">Excluir conta</strong>
                <p class="item-meta">Anonimiza dados pessoais (LGPD).</p>
              </div>
              <i class="fa-solid fa-chevron-right text-expense"></i>
            </button>
            <p class="item-meta" style="margin-top:0.75rem">
              <a href="/privacy.html" target="_blank" rel="noopener noreferrer">Politica de Privacidade</a>
            </p>
          </div>
        </section>
      </div>
    </section>
  `;
}


export { render as renderProfilePage };
