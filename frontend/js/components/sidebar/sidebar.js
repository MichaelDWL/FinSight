const sidebarToggle = document.querySelector(".sidebar-toggle");

export function toggleSidebar() {
  if (!sidebarToggle) return;

  document.body.classList.toggle("sidebar-closed");

  const isOpen = !document.body.classList.contains("sidebar-closed");
  sidebarToggle.setAttribute("aria-expanded", String(isOpen));
  sidebarToggle.setAttribute("aria-label", isOpen ? "Fechar menu" : "Abrir menu");
}

sidebarToggle?.addEventListener("click", toggleSidebar);
