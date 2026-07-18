/**
 * Guarda de rotas do bootstrap.
 *
 * Todas as rotas internas da SPA sao privadas: sem sessao valida, o usuario
 * nunca chega a renderiza-las — o bootstrap decide entre Login e App antes de
 * qualquer tela interna aparecer. Este modulo apenas classifica a rota atual e
 * traduz o hash em uma decisao de navegacao/autenticacao.
 *
 * A tabela de rotas/titulos continua em core/router.js (preservada).
 */
import { routeTitles, getRoute } from "../core/router.js";

/** Hashes que representam telas de autenticacao (fluxo publico por link). */
const AUTH_HASHES = ["reset-password", "verify-email"];

/** Rotas privadas conhecidas (todas as internas). */
export const PRIVATE_ROUTES = Object.keys(routeTitles);

export function isPrivateRoute(route = getRoute()) {
  return PRIVATE_ROUTES.includes(route);
}

export function isAuthHash(hash = window.location.hash || "") {
  return AUTH_HASHES.some((entry) => hash.includes(entry));
}

/** Navega via hash routing (preserva o esquema atual). */
export function go(path) {
  const hash = path.startsWith("#") ? path : `#${path.replace(/^\/+/, "")}`;
  window.location.hash = hash;
}

/**
 * Decide qual tela de autenticacao renderizar quando NAO ha sessao, a partir
 * do hash atual (recuperacao de senha, verificacao de email ou login padrao).
 */
export function resolveAuthScreen(hash = window.location.hash || "") {
  if (hash.includes("reset-password")) {
    return { mode: "reset" };
  }
  if (hash.includes("verify-email")) {
    return {
      mode: "login",
      message: "Confirme o email pelo link recebido e faca login.",
    };
  }
  return { mode: "login" };
}
