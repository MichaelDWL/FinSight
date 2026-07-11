// Modal de confirmação elegante e reutilizável (substitui window.confirm).
// Uso: const ok = await confirmDialog({ title, message, confirmText, tone });
// Retorna uma Promise<boolean>.

let modalEl = null;
let els = null;
let resolver = null;

function onKey(event) {
  if (event.key === "Escape") close(false);
}

function close(result) {
  if (!modalEl) return;
  modalEl.classList.add("isHidden");
  modalEl.setAttribute("aria-hidden", "true");
  document.removeEventListener("keydown", onKey);
  const resolve = resolver;
  resolver = null;
  if (resolve) resolve(result);
}

function ensureModal() {
  if (modalEl) return;

  modalEl = document.createElement("div");
  modalEl.className = "modal confirm-modal isHidden";
  modalEl.setAttribute("aria-hidden", "true");
  modalEl.innerHTML = `
    <div class="confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="confirmTitle" aria-describedby="confirmMessage">
      <div class="confirm-icon" data-confirm-icon-wrap>
        <i class="fa-solid fa-circle-question" data-confirm-icon></i>
      </div>
      <h2 class="confirm-title" id="confirmTitle" data-confirm-title></h2>
      <p class="confirm-message" id="confirmMessage" data-confirm-message></p>
      <div class="confirm-actions">
        <button class="confirm-btn confirm-cancel" type="button" data-confirm-cancel></button>
        <button class="confirm-btn confirm-ok" type="button" data-confirm-ok></button>
      </div>
    </div>
  `;
  document.body.appendChild(modalEl);

  els = {
    card: modalEl.querySelector(".confirm-card"),
    iconWrap: modalEl.querySelector("[data-confirm-icon-wrap]"),
    icon: modalEl.querySelector("[data-confirm-icon]"),
    title: modalEl.querySelector("[data-confirm-title]"),
    message: modalEl.querySelector("[data-confirm-message]"),
    cancel: modalEl.querySelector("[data-confirm-cancel]"),
    ok: modalEl.querySelector("[data-confirm-ok]"),
  };

  modalEl.addEventListener("click", (event) => {
    if (event.target === modalEl) close(false);
  });
  els.cancel.addEventListener("click", () => close(false));
  els.ok.addEventListener("click", () => close(true));
}

export function confirmDialog({
  title = "Confirmar ação",
  message = "",
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  tone = "danger",
  icon = null,
} = {}) {
  ensureModal();

  return new Promise((resolve) => {
    resolver = resolve;

    const isDanger = tone === "danger";
    const defaultIcon = isDanger ? "fa-trash-can" : "fa-circle-question";

    els.title.textContent = title;
    els.message.textContent = message;
    els.ok.textContent = confirmText;
    els.cancel.textContent = cancelText;

    els.iconWrap.className = `confirm-icon ${isDanger ? "is-danger" : "is-primary"}`;
    els.icon.className = `fa-solid ${icon || defaultIcon}`;
    els.ok.className = `confirm-btn confirm-ok ${isDanger ? "is-danger" : "is-primary"}`;

    modalEl.classList.remove("isHidden");
    modalEl.setAttribute("aria-hidden", "false");
    els.card.classList.remove("confirm-pop");
    void els.card.offsetWidth;
    els.card.classList.add("confirm-pop");

    document.addEventListener("keydown", onKey);
    setTimeout(() => els.cancel.focus(), 30);
  });
}
