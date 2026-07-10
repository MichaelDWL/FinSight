const sidebarToggle = document.querySelector(".sidebar-toggle");

export function toggleSidebar() {
  if (!sidebarToggle) return;

  document.body.classList.toggle("sidebar-closed");

  const isOpen = !document.body.classList.contains("sidebar-closed");
  sidebarToggle.setAttribute("aria-expanded", String(isOpen));
  sidebarToggle.setAttribute("aria-label", isOpen ? "Fechar menu" : "Abrir menu");

  if (!isOpen) {
    const investmentsGroup = document.querySelector("[data-nav-group='investments']");
    investmentsGroup?.classList.remove("nav-group-open");
    investmentsGroup?.querySelector("[data-action='toggle-investments-menu']")?.setAttribute("aria-expanded", "false");

    const accountsGroup = document.querySelector("[data-nav-group='accounts']");
    accountsGroup?.classList.remove("nav-group-open");
    accountsGroup?.querySelector("[data-action='toggle-accounts-menu']")?.setAttribute("aria-expanded", "false");
  }
}

sidebarToggle?.addEventListener("click", toggleSidebar);
