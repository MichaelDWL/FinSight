import { adminService } from "../../services/admin.js";
import { confirmDialog } from "../../components/modal/confirmModal.js";
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


export function bind(root, { showToast, currentUser } = {}) {
  const state = {
    page: 1,
    pageSize: 12,
    total: 0,
    items: [],
    selectedId: null,
    selected: null,
    logs: [],
    query: { search: "", status: "", role: "" },
  };

  const filtersForm = root.querySelector("#adminFilters");
  const bodyEl = root.querySelector("#adminUsersBody");
  const metaEl = root.querySelector("#adminUsersMeta");
  const detailEl = root.querySelector("#adminDetailPanel");
  const pageLabel = root.querySelector("#adminPageLabel");
  const prevBtn = root.querySelector("#adminPrevPage");
  const nextBtn = root.querySelector("#adminNextPage");

  async function loadUsers() {
    metaEl.textContent = "Carregando...";
    bodyEl.innerHTML = `<tr><td colspan="5">Carregando usuarios...</td></tr>`;
    try {
      const data = await adminService.listUsers({
        ...state.query,
        page: state.page,
        pageSize: state.pageSize,
      });
      state.items = data.items || [];
      state.total = data.total || 0;
      renderTable();
      if (state.selectedId) {
        const stillThere = state.items.find((u) => u.id === state.selectedId);
        if (stillThere) await selectUser(state.selectedId);
      }
    } catch (error) {
      bodyEl.innerHTML = `<tr><td colspan="5">${escapeHtml(error.message)}</td></tr>`;
      metaEl.textContent = "Falha ao carregar";
      showToast?.(error.message || "Nao foi possivel carregar usuarios.");
    }
  }

  function renderTable() {
    const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
    metaEl.textContent = `${state.total} usuario(s)`;
    pageLabel.textContent = `Pagina ${state.page} de ${totalPages}`;
    prevBtn.disabled = state.page <= 1;
    nextBtn.disabled = state.page >= totalPages;

    if (!state.items.length) {
      bodyEl.innerHTML = `<tr><td colspan="5">Nenhum usuario encontrado.</td></tr>`;
      return;
    }

    bodyEl.innerHTML = state.items
      .map((user) => {
        const active = user.id === state.selectedId ? "is-selected" : "";
        return `
          <tr class="admin-row ${active}" data-user-id="${user.id}" tabindex="0">
            <td>
              <div class="admin-user-cell">
                <span class="admin-avatar" aria-hidden="true">${escapeHtml(initials(user.name))}</span>
                <div>
                  <strong>${escapeHtml(user.name)}</strong>
                  <div class="item-meta">${escapeHtml(user.email)}</div>
                </div>
              </div>
            </td>
            <td>${roleBadge(user.role)}</td>
            <td>${statusBadge(user.status)}</td>
            <td>${escapeHtml(formatDateTime(user.lastLoginAt))}</td>
            <td>${escapeHtml(formatDateTime(user.createdAt))}</td>
          </tr>
        `;
      })
      .join("");
  }

  async function selectUser(userId) {
    state.selectedId = userId;
    renderTable();
    detailEl.innerHTML = `<p class="item-meta">Carregando detalhes...</p>`;
    try {
      const [user, logs] = await Promise.all([
        adminService.getUser(userId),
        adminService.userAuditLogs(userId, { limit: 8 }),
      ]);
      state.selected = user;
      state.logs = logs || [];
      renderDetail();
    } catch (error) {
      detailEl.innerHTML = `<p class="auth-error">${escapeHtml(error.message)}</p>`;
    }
  }

  function renderDetail() {
    const user = state.selected;
    if (!user) return;

    const isSelf = currentUser?.id === user.id;
    const logsHtml = state.logs.length
      ? state.logs
          .map(
            (log) => `
          <li>
            <span class="admin-log-dot" aria-hidden="true"></span>
            <div class="admin-log-copy">
              <strong>${escapeHtml(actionLabel(log.acao))}</strong>
              <span>${escapeHtml(formatDateTime(log.created_at))} · ${escapeHtml(log.resultado)}</span>
            </div>
          </li>`
          )
          .join("")
      : `<li>
          <span class="admin-log-dot" aria-hidden="true"></span>
          <div class="admin-log-copy"><strong>Sem eventos recentes</strong><span>Nenhum log para esta conta.</span></div>
        </li>`;

    detailEl.innerHTML = `
      <div class="admin-detail-body">
        <header class="admin-detail-hero">
          <span class="admin-avatar is-lg" aria-hidden="true">${escapeHtml(initials(user.name))}</span>
          <div class="admin-detail-hero-copy">
            <h2>${escapeHtml(user.name)}</h2>
            <p class="item-meta">${escapeHtml(user.email)}</p>
            <div class="admin-detail-badges">
              ${roleBadge(user.role)}
              ${statusBadge(user.status)}
            </div>
          </div>
        </header>

        <section class="admin-section">
          <h3 class="admin-section-title">Resumo da conta</h3>
          <dl class="admin-meta-grid">
            <div><dt>Criado em</dt><dd>${escapeHtml(formatDateTime(user.createdAt))}</dd></div>
            <div><dt>Ultimo login</dt><dd>${escapeHtml(formatDateTime(user.lastLoginAt))}</dd></div>
            <div><dt>Email verificado</dt><dd>${escapeHtml(formatDateTime(user.emailVerifiedAt))}</dd></div>
            <div><dt>Suspenso em</dt><dd>${escapeHtml(formatDateTime(user.suspendedAt))}</dd></div>
          </dl>
        </section>

        <section class="admin-section">
          <h3 class="admin-section-title">Cadastro</h3>
          <form id="adminEditForm" class="admin-edit-form">
            <label class="expense-field">
              <span class="font-label">Nome</span>
              <div class="expense-input-wrapper">
                <i class="fa-solid fa-user"></i>
                <input class="input-basic" name="name" value="${escapeHtml(user.name)}" required />
              </div>
            </label>
            <label class="expense-field">
              <span class="font-label">Email</span>
              <div class="expense-input-wrapper">
                <i class="fa-solid fa-envelope"></i>
                <input class="input-basic" name="email" type="email" value="${escapeHtml(user.email)}" required />
              </div>
            </label>
            <label class="expense-field">
              <span class="font-label">Papel</span>
              <div class="expense-input-wrapper">
                <i class="fa-solid fa-user-shield"></i>
                <select class="input-basic" name="role" ${isSelf ? "disabled" : ""}>
                  ${ROLE_OPTIONS.map(
                    (role) =>
                      `<option value="${role}" ${user.role === role ? "selected" : ""}>${role}</option>`
                  ).join("")}
                </select>
              </div>
            </label>
            <div class="admin-form-actions">
              <button type="submit" class="btn-primary">
                <i class="fa-solid fa-floppy-disk" aria-hidden="true"></i>
                Salvar cadastro
              </button>
            </div>
          </form>
        </section>

        <section class="admin-section">
          <h3 class="admin-section-title">Acoes</h3>
          <div class="admin-actions-grid">
            ${
              user.status === "suspensa"
                ? `<button type="button" class="btn-secondary" data-admin-action="reactivate">
                     <i class="fa-solid fa-play" aria-hidden="true"></i> Reativar
                   </button>`
                : `<button type="button" class="btn-secondary" data-admin-action="suspend" ${isSelf ? "disabled" : ""}>
                     <i class="fa-solid fa-pause" aria-hidden="true"></i> Suspender
                   </button>`
            }
            <button type="button" class="btn-secondary" data-admin-action="force-logout">
              <i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i> Forcar logout
            </button>
            <button type="button" class="btn-secondary" data-admin-action="reset-password">
              <i class="fa-solid fa-key" aria-hidden="true"></i> Redefinir senha
            </button>
            <button type="button" class="btn-danger" data-admin-action="delete" ${isSelf ? "disabled" : ""}>
              <i class="fa-solid fa-trash" aria-hidden="true"></i> Excluir conta
            </button>
          </div>
        </section>

        <section class="admin-section">
          <div class="admin-privacy-note">
            <i class="fa-solid fa-shield-halved" aria-hidden="true"></i>
            <p>Por privacidade, receitas, despesas, investimentos e cartoes nao sao acessiveis neste painel.</p>
          </div>
        </section>

        <section class="admin-section admin-logs">
          <h3 class="admin-section-title">Logs de acesso</h3>
          <ul>${logsHtml}</ul>
        </section>
      </div>
    `;

    detailEl.querySelector("#adminEditForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const payload = Object.fromEntries(new FormData(form).entries());
      try {
        await adminService.updateUser(user.id, {
          name: payload.name,
          email: payload.email,
        });
        if (!isSelf && payload.role && payload.role !== user.role) {
          await adminService.changeRole(user.id, payload.role);
        }
        showToast?.("Usuario atualizado.");
        await loadUsers();
        await selectUser(user.id);
      } catch (error) {
        showToast?.(error.message || "Falha ao atualizar usuario.");
      }
    });

    detailEl.querySelectorAll("[data-admin-action]").forEach((btn) => {
      btn.addEventListener("click", () => handleAction(btn.dataset.adminAction));
    });
  }

  async function handleAction(action) {
    const user = state.selected;
    if (!user) return;

    try {
      if (action === "suspend") {
        const ok = await confirmDialog({
          title: "Suspender conta",
          message: `Suspender ${user.name}? O usuario perdera acesso imediatamente.`,
          confirmText: "Suspender",
          tone: "danger",
        });
        if (!ok) return;
        const reason = window.prompt("Motivo da suspensao (opcional):") || undefined;
        await adminService.suspend(user.id, reason);
        showToast?.("Conta suspensa.");
      }

      if (action === "reactivate") {
        await adminService.reactivate(user.id);
        showToast?.("Conta reativada.");
      }

      if (action === "force-logout") {
        await adminService.forceLogout(user.id);
        showToast?.("Sessoes encerradas.");
      }

      if (action === "reset-password") {
        await adminService.resetPassword(user.id);
        showToast?.("Link de redefinicao enviado.");
      }

      if (action === "delete") {
        const ok = await confirmDialog({
          title: "Excluir permanentemente",
          message: `Excluir ${user.name} e todos os dados relacionados? Esta acao nao pode ser desfeita.`,
          confirmText: "Excluir",
          tone: "danger",
        });
        if (!ok) return;
        await adminService.deleteUser(user.id);
        state.selectedId = null;
        state.selected = null;
        detailEl.innerHTML = `
          <div class="admin-detail-empty">
            <i class="fa-solid fa-user-shield" aria-hidden="true"></i>
            <h2>Conta excluida</h2>
            <p>Selecione outro usuario para continuar.</p>
          </div>
        `;
        showToast?.("Conta excluida.");
        await loadUsers();
        return;
      }

      await loadUsers();
      if (state.selectedId) await selectUser(state.selectedId);
    } catch (error) {
      showToast?.(error.message || "Falha na operacao administrativa.");
    }
  }

  filtersForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(filtersForm).entries());
    state.query = {
      search: data.search || "",
      status: data.status || "",
      role: data.role || "",
    };
    state.page = 1;
    await loadUsers();
  });

  root.querySelector("#adminRefreshBtn")?.addEventListener("click", () => loadUsers());
  prevBtn.addEventListener("click", async () => {
    if (state.page <= 1) return;
    state.page -= 1;
    await loadUsers();
  });
  nextBtn.addEventListener("click", async () => {
    const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
    if (state.page >= totalPages) return;
    state.page += 1;
    await loadUsers();
  });

  bodyEl.addEventListener("click", (event) => {
    const row = event.target.closest("[data-user-id]");
    if (row) selectUser(row.dataset.userId);
  });

  bodyEl.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const row = event.target.closest("[data-user-id]");
    if (!row) return;
    event.preventDefault();
    selectUser(row.dataset.userId);
  });

  loadUsers();
}

export { bind as bindAdminPage };
