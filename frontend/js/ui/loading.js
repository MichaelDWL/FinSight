/**
 * Tela de loading do bootstrap.
 * Fica visivel por padrao (markup no index.html) enquanto o Auth verifica a
 * sessao. Esconde com fade curto quando o conteudo (login ou app) ja esta
 * pintado por baixo do overlay — evitando qualquer piscada.
 */

const FADE_MS = 320;

function getEl() {
  return document.getElementById("loading-screen");
}

export const Loading = {
  show() {
    const el = getEl();
    if (!el) return;
    el.hidden = false;
    // force reflow para reiniciar a transicao caso tenha sido escondido antes
    void el.offsetWidth;
    el.classList.remove("is-hidden");
  },

  async hide() {
    const el = getEl();
    if (!el || el.hidden) return;
    el.classList.add("is-hidden");
    await new Promise((resolve) => setTimeout(resolve, FADE_MS));
    el.hidden = true;
  },
};
