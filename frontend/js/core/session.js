/**
 * Estado de sessao do usuario (nivel autenticacao).
 * Fonte unica de verdade sobre "estou logado?" durante o ciclo de vida da app.
 * O perfil completo continua sendo espelhado em store.currentUser pela app.
 */

export const session = {
  user: null,

  get isAuthenticated() {
    return Boolean(this.user);
  },

  setUser(user) {
    this.user = user || null;
    return this.user;
  },

  clear() {
    this.user = null;
  },
};
