/**
 * Carrega fragments HTML reutilizáveis (shell + modais).
 * Paths relativos ao documento (templates/...) — funciona servindo em subpasta
 * (ex.: Live Server em /frontend/) e na raiz (Vercel rewrite /templates/*).
 */

const cache = new Map();

export async function loadTemplate(url) {
  if (cache.has(url)) return cache.get(url);
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) {
    throw new Error(`[FinSight] falha ao carregar template ${url} (${res.status})`);
  }
  const html = await res.text();
  cache.set(url, html);
  return html;
}

export async function mountTemplate(url, target, { position = "beforeend" } = {}) {
  const el =
    typeof target === "string" ? document.querySelector(target) : target;
  if (!el) throw new Error(`[FinSight] target não encontrado: ${target}`);
  const html = await loadTemplate(url);
  el.insertAdjacentHTML(position, html);
}

/**
 * Monta shell + chrome + modais na ordem do layout original.
 */
export async function mountAppTemplates() {
  await Promise.all([
    mountTemplate("templates/shell/header.html", "#shell-root"),
    mountTemplate("templates/shell/overlay.html", "#shell-root"),
    mountTemplate("templates/shell/sidebar.html", "#shell-root"),
  ]);

  await Promise.all([
    mountTemplate("templates/shell/bottom-nav.html", "#chrome-root"),
    mountTemplate("templates/shell/fab.html", "#chrome-root"),
    mountTemplate("templates/shell/toast.html", "#chrome-root"),
  ]);

  await Promise.all([
    mountTemplate("templates/modals/movement.html", "#modals-root"),
    mountTemplate("templates/modals/investment.html", "#modals-root"),
    mountTemplate("templates/modals/card.html", "#modals-root"),
    mountTemplate("templates/modals/account.html", "#modals-root"),
    mountTemplate("templates/modals/onboarding.html", "#modals-root"),
  ]);
}
