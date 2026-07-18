/**
 * Autenticacao centralizada do FinSight.
 *
 * Concentra todo o ciclo de vida da sessao — verificacao, renovacao de token,
 * login/registro/recuperacao e logout — para que nao existam chamadas de
 * autenticacao espalhadas pela aplicacao. Endpoints, cookies, CSRF e JWT
 * continuam sendo tratados por services/api.js (nada muda no backend).
 */
import { authApi, tryRefreshSession } from "../services/api.js";
import { session } from "./session.js";

async function fetchCurrentUser() {
  const user = await authApi.me();
  return session.setUser(user);
}

export const Auth = {
  get user() {
    return session.user;
  },

  isAuthenticated() {
    return session.isAuthenticated;
  },

  /**
   * Verifica se ha sessao valida. Nao tenta refresh — use initialize() para o
   * fluxo completo do bootstrap.
   */
  async checkSession() {
    return fetchCurrentUser();
  },

  /** Renova o token de acesso (refresh cookie). */
  refreshToken() {
    return tryRefreshSession();
  },

  /**
   * Fluxo de inicializacao: tenta a sessao atual e, se o access expirou,
   * renova o token antes de desistir. Retorna o usuario ou null.
   */
  async initialize() {
    try {
      return await fetchCurrentUser();
    } catch {
      const refreshed = await tryRefreshSession();
      if (refreshed) {
        try {
          return await fetchCurrentUser();
        } catch {
          /* segue para login */
        }
      }
      session.clear();
      return null;
    }
  },

  async login({ email, password }) {
    const result = await authApi.login({ email, password });
    session.setUser(result?.user || null);
    return result;
  },

  async register({ name, email, password }) {
    const result = await authApi.register({ name, email, password });
    session.setUser(result?.user || null);
    return result;
  },

  forgotPassword({ email }) {
    return authApi.forgotPassword({ email });
  },

  resetPassword({ token, password }) {
    return authApi.resetPassword({ token, password });
  },

  async logout() {
    try {
      await authApi.logout();
    } catch {
      /* ignore — segue com o logout local */
    }
    session.clear();
    window.location.reload();
  },
};

// Mantem o contrato global usado por handlers/perfil e pelo evento
// "session-expired" (sem espalhar logica de logout pela app).
window.finsightLogout = () => Auth.logout();
