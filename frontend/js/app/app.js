/**
 * Inicializacao da aplicacao autenticada.
 *
 * App.start() SO roda depois que o Auth confirmou a sessao. Ele monta o layout
 * (shell/chrome/modais), carrega a sidebar e entrega o controle ao nucleo da
 * SPA (core/app.js), que registra eventos, renderiza a rota e inicia modulos.
 *
 * Importante: os templates precisam existir no DOM antes de importar
 * core/app.js (elements.js resolve seus querySelector no import). Por isso a
 * montagem acontece aqui, e nunca antes da autenticacao.
 */
import { mountAppTemplates } from "../utils/template.js";

export const App = {
  async start(user) {
    await mountAppTemplates();
    await import("../components/sidebar/sidebar.js");
    const { startApp } = await import("../core/app.js");
    await startApp(user);
  },
};
