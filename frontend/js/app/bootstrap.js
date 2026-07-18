/**
 * Bootstrap — unico ponto de entrada da aplicacao FinSight.
 *
 * Fluxo:
 *   Loading.show()
 *     -> Auth.initialize()  (verifica sessao / renova token)
 *       -> autenticado  : App.start(user)  (monta layout, menus, dashboard...)
 *       -> nao autenticado : renderiza Login
 *     -> revela #app por baixo do overlay
 *   Loading.hide()  (fade curto, sem piscadas)
 *
 * Nenhuma tela interna e renderizada antes da autenticacao.
 */
import { Loading } from "../ui/loading.js";
import { Auth } from "../core/auth.js";
import { App } from "./app.js";
import { resolveAuthScreen } from "./router.js";
import { session } from "../core/session.js";
import { renderAuthScreen } from "../modules/auth/authGate.js";

function revealApp() {
  const appEl = document.getElementById("app");
  if (appEl) appEl.hidden = false;
}

/**
 * Login bem-sucedido dentro da tela de auth: transiciona para a aplicacao
 * completa reaproveitando a tela de loading (evita ver o formulario enquanto o
 * dashboard carrega).
 */
async function onAuthSuccess(user) {
  session.setUser(user);
  Loading.show();
  try {
    await App.start(user);
  } finally {
    await Loading.hide();
  }
}

function renderLogin() {
  // Mantem o layout de tela cheia da autenticacao (sem shell montado).
  document.body.classList.add("is-auth-screen");
  const { mode, message } = resolveAuthScreen();
  renderAuthScreen({ mode, message, onSuccess: onAuthSuccess });
}

async function bootstrap() {
  // Durante o boot ainda nao sabemos se ha sessao. Marcamos como tela de auth
  // para que um "session-expired" disparado pela verificacao inicial NAO
  // acione logout + reload (evitando loop de recarregamento).
  document.body.classList.add("is-auth-screen");
  Loading.show();

  let user = null;
  try {
    user = await Auth.initialize();
  } catch (error) {
    // Falha na propria verificacao de sessao (ex.: rede) -> trata como deslogado.
    console.error("[FinSight] falha ao verificar sessao", error);
    user = null;
  }

  // Revela o #app AINDA por baixo do overlay de loading: o conteudo (e os
  // graficos) e medido/pintado com dimensoes reais, mas segue invisivel ate o
  // fade do loading — garantindo transicao sem piscadas.
  revealApp();

  try {
    if (user) {
      // Erros pos-autenticacao (ex.: dados) NAO devem derrubar para o Login:
      // mantemos o usuario na aplicacao, como no comportamento original.
      await App.start(user);
    } else {
      renderLogin();
    }
  } catch (error) {
    console.error("[FinSight] falha ao iniciar a aplicacao", error);
  } finally {
    await Loading.hide();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
} else {
  bootstrap();
}
