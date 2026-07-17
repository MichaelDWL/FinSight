import { authApi, tryRefreshSession } from "../../services/api.js";

function getAppRoot() {
  return document.querySelector("#app") || document.body;
}

function passwordField({ name = "password", label = "Senha", autocomplete = "current-password" }) {
  return `
    <label class="auth-field">
      <span>${label}</span>
      <div class="auth-input-wrap">
        <i class="fa-solid fa-lock" aria-hidden="true"></i>
        <input name="${name}" type="password" autocomplete="${autocomplete}" required minlength="8" />
        <button
          type="button"
          class="auth-toggle-password"
          data-toggle-password
          aria-label="Mostrar senha"
          aria-pressed="false"
          title="Mostrar senha"
        >
          <i class="fa-solid fa-eye" aria-hidden="true"></i>
        </button>
      </div>
    </label>
  `;
}

export function renderAuthScreen({ mode = "login", onSuccess, message = "" } = {}) {
  const root = getAppRoot();
  const isRegister = mode === "register";
  const isForgot = mode === "forgot";
  const isReset = mode === "reset";

  let eyebrow = "Acesso seguro";
  let title = "Entrar no FinSight";
  let subtitle = "Continue acompanhando suas financas com clareza e controle.";
  if (isRegister) {
    eyebrow = "Nova conta";
    title = "Criar conta";
    subtitle = "Comece a organizar sua vida financeira em poucos minutos.";
  } else if (isForgot) {
    eyebrow = "Recuperacao";
    title = "Recuperar senha";
    subtitle = "Enviaremos um link seguro para o email informado.";
  } else if (isReset) {
    eyebrow = "Nova senha";
    title = "Redefinir senha";
    subtitle = "Escolha uma senha forte para proteger sua conta.";
  }

  root.innerHTML = `
    <section class="auth-shell">
      <div class="auth-card">
        <div class="auth-brand-row">
          <i class="fa-solid fa-chart-simple" aria-hidden="true"></i>
          <p class="auth-brand">FinSight</p>
        </div>
        <span class="auth-eyebrow">${eyebrow}</span>
        <h1>${title}</h1>
        <p class="auth-subtitle">${subtitle}</p>
        ${message ? `<p class="auth-banner">${message}</p>` : ""}
        <form id="authForm" class="auth-form" novalidate>
          ${
            isRegister
              ? `<label class="auth-field">
                  <span>Nome</span>
                  <div class="auth-input-wrap">
                    <i class="fa-solid fa-user" aria-hidden="true"></i>
                    <input name="name" type="text" autocomplete="name" required minlength="2" />
                  </div>
                </label>`
              : ""
          }
          ${
            !isReset
              ? `<label class="auth-field">
                  <span>Email</span>
                  <div class="auth-input-wrap">
                    <i class="fa-solid fa-envelope" aria-hidden="true"></i>
                    <input name="email" type="email" autocomplete="email" required />
                  </div>
                </label>`
              : ""
          }
          ${
            isLoginOrRegister(mode)
              ? passwordField({
                  autocomplete: isRegister ? "new-password" : "current-password",
                })
              : ""
          }
          ${
            isReset
              ? passwordField({ label: "Nova senha", autocomplete: "new-password" })
              : ""
          }
          <button type="submit" class="auth-submit">${submitLabel(mode)}</button>
        </form>
        <p id="authError" class="auth-error" hidden></p>
        <div class="auth-links">
          ${
            isLoginOrRegister(mode)
              ? isRegister
                ? `<button type="button" data-auth-mode="login">Ja tenho conta</button>`
                : `<button type="button" data-auth-mode="register">Criar conta</button>
                   <button type="button" data-auth-mode="forgot">Esqueci a senha</button>`
              : `<button type="button" data-auth-mode="login">Voltar ao login</button>`
          }
        </div>
      </div>
    </section>
  `;

  const form = root.querySelector("#authForm");
  const errorEl = root.querySelector("#authError");

  root.querySelectorAll("[data-auth-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      renderAuthScreen({ mode: btn.dataset.authMode, onSuccess });
    });
  });

  root.querySelectorAll("[data-toggle-password]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const wrap = btn.closest(".auth-input-wrap");
      const input = wrap?.querySelector("input");
      if (!input) return;
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      btn.setAttribute("aria-pressed", showing ? "false" : "true");
      btn.setAttribute("aria-label", showing ? "Mostrar senha" : "Ocultar senha");
      btn.title = showing ? "Mostrar senha" : "Ocultar senha";
      const icon = btn.querySelector("i");
      if (icon) {
        icon.className = showing ? "fa-solid fa-eye" : "fa-solid fa-eye-slash";
      }
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorEl.hidden = true;
    const data = Object.fromEntries(new FormData(form).entries());
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      if (mode === "login") {
        const result = await authApi.login({
          email: data.email,
          password: data.password,
        });
        onSuccess?.(result.user);
        return;
      }

      if (mode === "register") {
        const result = await authApi.register({
          name: data.name,
          email: data.email,
          password: data.password,
        });
        onSuccess?.(result.user);
        return;
      }

      if (mode === "forgot") {
        await authApi.forgotPassword({ email: data.email });
        renderAuthScreen({
          mode: "login",
          onSuccess,
          message: "Se o email existir, enviaremos instrucoes de recuperacao.",
        });
        return;
      }

      if (mode === "reset") {
        const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
        const token = params.get("token");
        if (!token) throw new Error("Token de recuperacao ausente.");
        await authApi.resetPassword({ token, password: data.password });
        renderAuthScreen({
          mode: "login",
          onSuccess,
          message: "Senha redefinida. Faca login com a nova senha.",
        });
      }
    } catch (error) {
      errorEl.textContent = error.message || "Falha na autenticacao.";
      errorEl.hidden = false;
    } finally {
      submitBtn.disabled = false;
    }
  });
}

function isLoginOrRegister(mode) {
  return mode === "login" || mode === "register";
}

function submitLabel(mode) {
  if (mode === "register") return "Criar conta";
  if (mode === "forgot") return "Enviar link";
  if (mode === "reset") return "Salvar senha";
  return "Entrar";
}

export async function ensureAuthenticated(onReady) {
  try {
    const user = await authApi.me();
    onReady?.(user);
    return user;
  } catch {
    // Access pode ter expirado — tenta refresh antes de forcar login.
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      try {
        const user = await authApi.me();
        onReady?.(user);
        return user;
      } catch {
        /* segue para tela de login */
      }
    }

    const hash = window.location.hash || "";
    if (hash.includes("reset-password")) {
      renderAuthScreen({ mode: "reset", onSuccess: onReady });
      return null;
    }
    if (hash.includes("verify-email")) {
      renderAuthScreen({
        mode: "login",
        onSuccess: onReady,
        message: "Confirme o email pelo link recebido e faca login.",
      });
      return null;
    }
    renderAuthScreen({ mode: "login", onSuccess: onReady });
    return null;
  }
}
