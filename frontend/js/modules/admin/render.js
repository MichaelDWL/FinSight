import { escapeHtml } from "../../utils/dom.js";

const ROLE_OPTIONS = ["USER", "ADMIN", "SUPER_ADMIN", "SUPPORT", "MODERATOR"];
const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "ativa", label: "Ativa" },
  { value: "suspensa", label: "Suspensa" },
  { value: "inativa", label: "Inativa" },
];

function formatDateTime(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

function initials(name) {
  return String(name || "U")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function actionLabel(action) {
  const map = {
    LOGIN_SUCCESS: "Login realizado",
    LOGIN_FAILURE: "Falha de login",
    LOGOUT: "Logout",
    REGISTER: "Registro",
    REFRESH_TOKEN: "Renovacao de sessao",
    PASSWORD_CHANGE: "Troca de senha",
    PASSWORD_RESET_REQUEST: "Pedido de recuperacao",
    PASSWORD_RESET_COMPLETE: "Senha redefinida",
    PROFILE_UPDATE: "Perfil atualizado",
    ROLE_CHANGE: "Papel alterado",
    ACCOUNT_SUSPEND: "Conta suspensa",
    ACCOUNT_REACTIVATE: "Conta reativada",
    ACCOUNT_DELETE: "Conta excluida",
    FORCE_LOGOUT: "Logout forcado",
    ADMIN_ACCESS: "Acesso administrativo",
    EMAIL_VERIFY: "Email verificado",
  };
  return map[action] || action;
}

function statusBadge(status) {
  const map = {
    ativa: "admin-badge is-success",
    suspensa: "admin-badge is-warning",
    inativa: "admin-badge is-muted",
  };
  const labels = {
    ativa: "Ativa",
    suspensa: "Suspensa",
    inativa: "Inativa",
  };
  return `<span class="${map[status] || "admin-badge"}">${escapeHtml(labels[status] || status || "—")}</span>`;
}

function roleBadge(role) {
  return `<span class="admin-badge is-role">${escapeHtml(role || "USER")}</span>`;
}

export function render() {
  return `
    <section class="app-page admin-page">
      <div class="page-hero">
        <div>
          <span class="page-eyebrow">Administracao</span>
          <h1 class="page-title">Painel administrativo</h1>
          <p class="page-subtitle">
            Gerencie contas, papeis e status. Dados financeiros privados dos usuarios nao sao exibidos aqui.
          </p>
        </div>
      </div>

      <section class="form-card admin-toolbar">
        <form id="adminFilters" class="admin-filters">
          <label class="expense-field">
            <span class="font-label">Buscar</span>
            <div class="expense-input-wrapper">
              <i class="fa-solid fa-magnifying-glass"></i>
              <input class="input-basic" name="search" type="search" placeholder="Nome ou email" />
            </div>
          </label>
          <label class="expense-field">
            <span class="font-label">Status</span>
            <div class="expense-input-wrapper">
              <i class="fa-solid fa-circle-check"></i>
              <select class="input-basic" name="status">
                ${STATUS_OPTIONS.map((o) => `<option value="${o.value}">${o.label}</option>`).join("")}
              </select>
            </div>
          </label>
          <label class="expense-field">
            <span class="font-label">Papel</span>
            <div class="expense-input-wrapper">
              <i class="fa-solid fa-user-tag"></i>
              <select class="input-basic" name="role">
                <option value="">Todos os papeis</option>
                ${ROLE_OPTIONS.map((role) => `<option value="${role}">${role}</option>`).join("")}
              </select>
            </div>
          </label>
          <div class="admin-filter-actions">
            <button type="submit" class="btn-primary">Filtrar</button>
            <button type="button" class="btn-secondary" id="adminRefreshBtn">Atualizar</button>
          </div>
        </form>
      </section>

      <div class="admin-layout">
        <section class="table-shell admin-table-card">
          <div class="card-title-row">
            <h2 class="font-title-sm">Usuarios</h2>
            <p class="item-meta" id="adminUsersMeta">Carregando...</p>
          </div>
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Papel</th>
                  <th>Status</th>
                  <th>Ultimo login</th>
                  <th>Criado em</th>
                </tr>
              </thead>
              <tbody id="adminUsersBody">
                <tr><td colspan="5">Carregando usuarios...</td></tr>
              </tbody>
            </table>
          </div>
          <div class="admin-pagination">
            <button type="button" class="btn-secondary" id="adminPrevPage" disabled>Anterior</button>
            <span id="adminPageLabel">Pagina 1</span>
            <button type="button" class="btn-secondary" id="adminNextPage" disabled>Proxima</button>
          </div>
        </section>

        <aside class="form-card admin-detail" id="adminDetailPanel">
          <div class="admin-detail-empty">
            <i class="fa-solid fa-user-shield" aria-hidden="true"></i>
            <h2>Detalhes da conta</h2>
            <p>Selecione um usuario na lista para gerenciar cadastro, papel e status.</p>
          </div>
        </aside>
      </div>
    </section>
  `;
}


export { render as renderAdminPage };
