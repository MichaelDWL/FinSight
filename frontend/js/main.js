import { mountAppTemplates } from "./utils/template.js";

/**
 * Bootstrap: templates -> sidebar -> nucleo da app.
 */
async function boot() {
  try {
    await mountAppTemplates();
    await import("./components/sidebar/sidebar.js");
    await import("./core/app.js");
  } catch (error) {
    console.error("[FinSight] falha ao carregar app", error);
    const root = document.getElementById("app") || document.body;
    const el = document.createElement("p");
    el.setAttribute("role", "alert");
    el.textContent = "Nao foi possivel carregar o aplicativo. Recarregue a pagina.";
    root.prepend(el);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
