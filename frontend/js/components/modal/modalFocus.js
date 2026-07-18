export function releaseModalFocus(modal, returnFocusTo = null) {
  const active = document.activeElement;
  if (active && modal?.contains(active)) {
    active.blur();
  }

  const target =
    returnFocusTo ||
    document.querySelector("#quickAction") ||
    document.querySelector("main") ||
    document.body;

  if (target && typeof target.focus === "function") {
    target.focus({ preventScroll: true });
  }
}

export function hideModal(modal, { returnFocusTo = null } = {}) {
  if (!modal) return;
  releaseModalFocus(modal, returnFocusTo);
  modal.classList.add("isHidden");
  modal.setAttribute("aria-hidden", "true");
}

export function showModal(modal) {
  if (!modal) return;
  modal.classList.remove("isHidden");
  modal.setAttribute("aria-hidden", "false");
}
