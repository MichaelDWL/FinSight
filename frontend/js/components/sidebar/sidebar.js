import { closeAllNavGroups, expandActiveNavGroup } from "../../core/app/navigation.js";

const sidebarToggle = document.querySelector(".sidebar-toggle");
const mobileMenuBtn = document.querySelector("#mobileMenuBtn");
const mobileDrawerClose = document.querySelector("#mobileDrawerClose");
const mobileDrawerOverlay = document.querySelector("#mobileDrawerOverlay");
const mobileDrawer = document.querySelector("#mobileDrawer");

let lastFocusBeforeDrawer = null;

function isMobileShell() {
  return window.matchMedia("(max-width: 767px)").matches;
}

function isTabletShell() {
  return window.matchMedia("(min-width: 768px) and (max-width: 1024px)").matches;
}

function collapseSidebar() {
  if (document.body.classList.contains("sidebar-closed")) return;

  document.body.classList.add("sidebar-closed");
  sidebarToggle?.setAttribute("aria-expanded", "false");
  sidebarToggle?.setAttribute("aria-label", "Abrir menu");
  closeAllNavGroups();
}

function syncViewportShell() {
  if (isMobileShell()) return;
  if (isTabletShell()) collapseSidebar();
}

export function openMobileDrawer() {
  if (!isMobileShell()) return;

  lastFocusBeforeDrawer = document.activeElement;
  document.body.classList.add("drawer-open");
  mobileMenuBtn?.setAttribute("aria-expanded", "true");
  mobileMenuBtn?.setAttribute("aria-label", "Fechar menu");
  mobileDrawerOverlay?.setAttribute("aria-hidden", "false");
  mobileDrawer?.setAttribute("aria-modal", "true");

  window.setTimeout(() => {
    mobileDrawerClose?.focus();
  }, 50);
}

export function closeMobileDrawer() {
  document.body.classList.remove("drawer-open");
  mobileMenuBtn?.setAttribute("aria-expanded", "false");
  mobileMenuBtn?.setAttribute("aria-label", "Abrir menu");
  mobileDrawerOverlay?.setAttribute("aria-hidden", "true");
  mobileDrawer?.removeAttribute("aria-modal");

  if (lastFocusBeforeDrawer && typeof lastFocusBeforeDrawer.focus === "function") {
    lastFocusBeforeDrawer.focus();
  } else {
    mobileMenuBtn?.focus();
  }
  lastFocusBeforeDrawer = null;
}

export function toggleMobileDrawer() {
  if (document.body.classList.contains("drawer-open")) {
    closeMobileDrawer();
  } else {
    openMobileDrawer();
  }
}

export function toggleSidebar() {
  if (!sidebarToggle) return;

  document.body.classList.toggle("sidebar-closed");

  const isOpen = !document.body.classList.contains("sidebar-closed");
  sidebarToggle.setAttribute("aria-expanded", String(isOpen));
  sidebarToggle.setAttribute("aria-label", isOpen ? "Fechar menu" : "Abrir menu");

  if (!isOpen) {
    closeAllNavGroups();
  } else {
    expandActiveNavGroup();
  }
}

sidebarToggle?.addEventListener("click", toggleSidebar);

mobileMenuBtn?.addEventListener("click", toggleMobileDrawer);
mobileDrawerClose?.addEventListener("click", closeMobileDrawer);
mobileDrawerOverlay?.addEventListener("click", closeMobileDrawer);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("drawer-open")) {
    closeMobileDrawer();
  }
});

window.addEventListener("hashchange", () => {
  if (document.body.classList.contains("drawer-open")) {
    closeMobileDrawer();
  }
});

mobileDrawer?.addEventListener("click", (event) => {
  const target = event.target.closest("a[href], [data-action]");
  if (!target || !document.body.classList.contains("drawer-open")) return;
  if (target.matches(".nav-group-toggle, [data-action^='toggle-']")) return;
  closeMobileDrawer();
});

window.matchMedia("(max-width: 767px)").addEventListener("change", (event) => {
  if (!event.matches) {
    closeMobileDrawer();
    syncViewportShell();
  }
});

window.matchMedia("(min-width: 768px) and (max-width: 1024px)").addEventListener(
  "change",
  (event) => {
    if (event.matches) collapseSidebar();
  },
);

syncViewportShell();
