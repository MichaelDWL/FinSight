import "./components/sidebar/sidebar.js";

/**
 * Bootstrap lazy: carrega o nucleo da app sob demanda.
 * Reduz parse/compile inicial; dashboards/admin entram via grafo de app.js
 * (proximos splits podem isolar admin/onboarding em chunks separados).
 */
async function boot() {
  try {
    await import("./app.js");
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
